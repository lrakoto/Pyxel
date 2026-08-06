/**
 * Zero-dependency .aseprite -> sprite sheet compiler.
 *
 * Reads every .aseprite file under assets/sprites/, splices the visible,
 * non-reference layers for every frame into RGBA pixels, and then packs all
 * frames into one atlas plus a manifest JSON in public/sprites/.
 *
 *   node tools/aseprite-import.mjs [srcDir] [outDir]
 *
 * Defaults: assets/sprites -> public/sprites. The Vite plugin in
 * vite.config.ts watches assets/sprites/ and re-runs this during dev, so an
 * art drop takes effect without a server restart.
 */
import { readdirSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { resolve, join, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { unzlibSync } from 'fflate';
import { PNG } from 'pngjs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

const ASE_MAGIC = 0xa5e0;
const FRAME_MAGIC = 0xf1fa;

/**
 * Binary reader over the bytes of one .aseprite file. All multi-byte fields
 * are little-endian per the spec; the reader keeps a cursor so the chunk
 * walker below can pull fields in order.
 */
class Reader {
  constructor(buf) {
    this.buf = buf;
    this.view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    this.pos = 0;
  }

  u8() { return this.view.getUint8(this.pos++); }
  /** Aseprite strings don't include the NUL in the length. */
  str() {
    const len = this.u16();
    const s = this.view.buffer.slice(this.view.byteOffset + this.pos, this.view.byteOffset + this.pos + len);
    this.pos += len;
    return new TextDecoder().decode(s);
  }
  u16() { const v = this.view.getUint16(this.pos, true); this.pos += 2; return v; }
  i16() { const v = this.view.getInt16(this.pos, true); this.pos += 2; return v; }
  u32() { const v = this.view.getUint32(this.pos, true); this.pos += 4; return v; }
  i32() { const v = this.view.getInt32(this.pos, true); this.pos += 4; return v; }
  f32() { const v = this.view.getFloat32(this.pos, true); this.pos += 4; return v; }
  /** 16.16 fixed point (slice pivot coords). */
  fixed() { return this.i32() / 65536; }
  bytes(n) { const out = this.buf.subarray(this.pos, this.pos + n); this.pos += n; return out; }
  seek(p) { this.pos = p; }
}

/** One flattened RGBA frame ready to pack. */
function makeCell(w, h) {
  return { pixels: new Uint8ClampedArray(w * h * 4) };
}

/**
 * Parses one .aseprite file. The format is chunk-based; for the game's use
 * case we only need: layer visibility / blend / opacity, cel images, frame
 * durations, tags, and an optional pivot slice. Palettes / colour profiles /
 * user data are skipped over rather than validated.
 */
function parseAseprite(buf, id) {
  const r = new Reader(buf);
  if (r.u32() !== buf.length) {
    // File size mismatch: tolerate, some tools write zero here.
  }
  if (r.u16() !== ASE_MAGIC) throw new Error(`${id}: not an aseprite file (bad magic)`);
  const frameCount = r.u16();
  const w = r.u16();
  const h = r.u16();
  const bpp = r.u16();
  if (bpp !== 32) throw new Error(`${id}: expected 32bpp RGBA; got ${bpp}bpp`);
  const flags = r.u32(); // layer-opacity validity lives here; individual layers still carry it
  const defaultSpeedMs = r.u16();
  r.u32(); r.u32(); // reserved
  r.u8(); // transparent palette index (present at all color depths; unused for RGBA)
  r.bytes(3);
  r.u16(); // num colors
  r.u8(); r.u8(); // pixel w/h ratio
  r.i16(); r.i16(); // grid x/y
  r.u16(); r.u16(); // grid w/h
  r.bytes(84); // future

  // Layers live across frames but the layout itself is defined on frame 0.
  const layers = [];
  const frames = [];
  const pendingCels = []; // {frameIdx, layerIdx, x, y, opacity, zIndex, pixels}
  let pivot = null;
  const frameDurations = [];
  const tags = [];

  for (let f = 0; f < frameCount; f++) {
    const frameStart = r.pos;
    r.u32(); // frame byte size
    if (r.u16() !== FRAME_MAGIC) throw new Error(`${id}: bad frame magic at frame ${f}`);
    let chunkCount = r.u16();
    const durationMs = r.u16() || defaultSpeedMs;
    frameDurations.push(durationMs / 1000);
    r.bytes(2);
    if (chunkCount === 0xffff) chunkCount = r.u32();

    for (let c = 0; c < chunkCount; c++) {
      const chunkStart = r.pos;
      const chunkSize = r.u32();
      const chunkType = r.u16();
      const chunkEnd = chunkStart + chunkSize;

      if (chunkType === 0x2004) {
        // Layer chunk: flags, type, name. Group layers exist only to
        // structure the tree; cels still reference flat layer indices, so we
        // keep them in the array with a "skipsRender" note.
        const lFlags = r.u16();
        const layerType = r.u16();
        r.u16(); // child level — hierarchy only matters for visibility inheritance
        r.u16(); r.u16(); // default w/h
        r.u16(); // blend mode (we composite normal-only)
        const opacity = r.u8();
        r.bytes(3);
        const name = r.str();
        if (layerType === 2) r.u32(); // tileset index
        if (flags & 4) r.bytes(16); // layer UUID
        layers.push({ visible: (lFlags & 1) !== 0, group: layerType === 1, opacity, name });
      } else if (chunkType === 0x2005) {
        // Cel chunk: where a layer's pixels go this frame.
        const layerIdx = r.u16();
        const x = r.i16();
        const y = r.i16();
        const opacity = r.u8();
        const celType = r.u16();
        const zIndex = r.i16();
        r.bytes(5);
        if (celType === 0) {
          const cw = r.u16();
          const ch = r.u16();
          const pixels = r.bytes(cw * ch * (bpp / 8));
          pendingCels.push({ frameIdx: f, layerIdx, x, y, opacity, zIndex, pixels, w: cw, h: ch });
        } else if (celType === 1) {
          const targetFrame = r.u16(); // linked frame — resolve in a second pass
          pendingCels.push({ frameIdx: f, layerIdx, x, y, opacity, zIndex, linkedFrame: targetFrame, pixels: null, w: 0, h: 0 });
        } else if (celType === 2) {
          const cw = r.u16();
          const ch = r.u16();
          const compressed = r.bytes(chunkEnd - r.pos);
          const pixels = unzlibSync(compressed);
          pendingCels.push({ frameIdx: f, layerIdx, x, y, opacity, zIndex, pixels, w: cw, h: ch });
        }
        // type 3 = compressed tilemap: not used in our art
      } else if (chunkType === 0x2018) {
        const tagCount = r.u16();
        r.bytes(8);
        for (let t = 0; t < tagCount; t++) {
          const from = r.u16();
          const to = r.u16();
          const direction = r.u8();
          const repeat = r.u16();
          r.bytes(6);
          r.bytes(3); r.u8(); // legacy colour + extra
          const name = r.str();
          tags.push({ name, from, to, direction, repeat });
        }
      } else if (chunkType === 0x2022) {
        const keyCount = r.u32();
        const sFlags = r.u32();
        r.u32(); // reserved
        r.str(); // slice name
        for (let k = 0; k < keyCount; k++) {
          r.u32(); // frame number
          const sx = r.i32();
          const sy = r.i32();
          const sw = r.u32();
          const sh = r.u32();
          if (sFlags & 1) { r.i32(); r.i32(); r.u32(); r.u32(); } // 9-patch center
          if (sFlags & 2 && k === 0 && pivot === null) {
            pivot = { x: sx + r.fixed(), y: sy + r.fixed() };
          } else if (sFlags & 2) { r.fixed(); r.fixed(); }
        }
      }
      // 0x2004/0x2016/0x2019/0x2020 etc: skip to the next chunk.
      r.seek(chunkEnd);
    }
    r.seek(frameStart + r.view.getUint32(frameStart, true));
  }

  // Resolve linked cels into real pixels by copying the referenced frame's
  // cel for the same layer. Aseprite guarantees the link target exists.
  const celKey = (frameIdx, layerIdx) => `${frameIdx}:${layerIdx}`;
  const celMap = new Map();
  for (const cel of pendingCels) if (cel.pixels) celMap.set(celKey(cel.frameIdx, cel.layerIdx), cel);
  for (const cel of pendingCels) {
    if (cel.pixels || cel.linkedFrame === undefined) continue;
    const src = celMap.get(celKey(cel.linkedFrame, cel.layerIdx));
    if (!src) continue;
    cel.pixels = src.pixels;
    cel.w = src.w;
    cel.h = src.h;
  }

  // Splice each frame: hidden / group layers contribute nothing.
  const cellFrames = [];
  for (let f = 0; f < frameCount; f++) {
    const cell = makeCell(w, h);
    const frameCels = pendingCels
      .filter((c) => c.frameIdx === f && c.pixels && layers[c.layerIdx] && layers[c.layerIdx].visible && !layers[c.layerIdx].group)
      .sort((a, b) => (a.zIndex - b.zIndex) || (a.layerIdx - b.layerIdx));

    for (const cel of frameCels) {
      const layer = layers[cel.layerIdx];
      const alphaMul = (layer.opacity / 255) * (cel.opacity / 255);
      for (let cy = 0; cy < cel.h; cy++) {
        const dy = cel.y + cy;
        if (dy < 0 || dy >= h) continue;
        for (let cx = 0; cx < cel.w; cx++) {
          const dx = cel.x + cx;
          if (dx < 0 || dx >= w) continue;
          const src = (cy * cel.w + cx) * 4;
          const dst = (dy * w + dx) * 4;
          const sa = (cel.pixels[src + 3] / 255) * alphaMul;
          if (sa === 0) continue;
          // Source-over composite, since multiple visible layers per frame
          // is the rule rather than the exception.
          const da = cell.pixels[dst + 3] / 255;
          const outA = sa + da * (1 - sa);
          if (outA === 0) continue;
          for (let ch = 0; ch < 3; ch++) {
            cell.pixels[dst + ch] =
              (cel.pixels[src + ch] * sa + cell.pixels[dst + ch] * da * (1 - sa)) / outA;
          }
          cell.pixels[dst + 3] = outA * 255;
        }
      }
    }
    cellFrames.push(cell);
  }

  return {
    id,
    w, h,
    pivot: pivot ?? { x: w / 2, y: h / 2 },
    frames: cellFrames.map((cell, i) => ({ cell, duration: frameDurations[i] })),
    tags,
  };
}

/**
 * Shelf-packs frames left-to-right, top-to-bottom. Frames are uniformly
 * sized (one canvas per .aseprite) so the packing is trivial; the atlas is
 * still written with PNG's own dimensions, so nothing downstream assumes
 * a fixed grid.
 */
function pack(sheets) {
  // Sort by height desc for better shelf usage, but remember original order.
  const all = [];
  for (const sheet of sheets) {
    for (let i = 0; i < sheet.frames.length; i++) {
      all.push({ sheet, frameIdx: i, cell: sheet.frames[i].cell });
    }
  }
  all.sort((a, b) => b.sheet.h - a.sheet.h);

  const totalArea = all.reduce((s, f) => s + f.sheet.w * f.sheet.h, 0);
  const atlasW = Math.max(64, nextPow2(Math.ceil(Math.sqrt(totalArea) * 1.3)));
  let x = 0, y = 0, shelfH = 0, maxY = 0;

  for (const f of all) {
    const w = f.sheet.w, h = f.sheet.h;
    if (x + w > atlasW) { x = 0; y += shelfH; shelfH = 0; }
    if (y + h > maxY) maxY = y + h;
    f.atlasX = x;
    f.atlasY = y;
    x += w;
    shelfH = Math.max(shelfH, h);
  }
  const atlasH = nextPow2(maxY);

  const pixels = new Uint8ClampedArray(atlasW * atlasH * 4);
  for (const f of all) {
    const w = f.sheet.w, h = f.sheet.h;
    for (let row = 0; row < h; row++) {
      const srcStart = row * w * 4;
      const dstStart = ((f.atlasY + row) * atlasW + f.atlasX) * 4;
      pixels.set(f.cell.pixels.subarray(srcStart, srcStart + w * 4), dstStart);
    }
    f.frameMeta = { x: f.atlasX, y: f.atlasY, w, h, duration: f.sheet.frames[f.frameIdx].duration };
  }

  // Build the manifest in source-file (pre-sort) order.
  const manifest = { version: 1, atlas: 'sprites.png', sheets: {} };
  for (const sheet of sheets) {
    const tags = {};
    for (const t of sheet.tags) tags[t.name.toLowerCase()] = { from: t.from, to: t.to, direction: t.direction, repeat: t.repeat };
    manifest.sheets[sheet.id] = {
      id: sheet.id,
      atlasW, atlasH,
      cellW: sheet.w,
      cellH: sheet.h,
      pivotX: sheet.pivot.x,
      pivotY: sheet.pivot.y,
      frames: sheet.frames.map((f, i) => all.find((a) => a.sheet === sheet && a.frameIdx === i)?.frameMeta),
      tags,
    };
  }

  const png = new PNG({ width: atlasW, height: atlasH });
  png.data = Buffer.from(pixels.buffer, pixels.byteOffset, pixels.byteLength);
  return { manifest, pngBuffer: PNG.sync.write(png) };
}

function nextPow2(n) {
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}

function run() {
  const srcDir = resolve(__dirname, process.argv[2] ?? '../assets/sprites');
  const outDir = resolve(__dirname, process.argv[3] ?? '../public/sprites');
  mkdirSync(outDir, { recursive: true });

  if (!existsSync(srcDir)) {
    console.log(`[sprites] no source dir at ${srcDir} — writing empty manifest`);
    writeFileSync(join(outDir, 'manifest.json'), JSON.stringify({ version: 1, atlas: 'sprites.png', sheets: {} }, null, 2));
    return;
  }

  const files = readdirSync(srcDir).filter((f) => extname(f) === '.aseprite');
  if (!files.length) {
    console.log('[sprites] no .aseprite files found — writing empty manifest');
    writeFileSync(join(outDir, 'manifest.json'), JSON.stringify({ version: 1, atlas: 'sprites.png', sheets: {} }, null, 2));
    return;
  }

  const sheets = [];
  for (const file of files) {
    const id = basename(file, '.aseprite');
    const buf = readFileSync(join(srcDir, file));
    try {
      sheets.push(parseAseprite(buf, id));
    } catch (err) {
      console.error(`[sprites] failed to parse ${file}: ${err.message}`);
      process.exitCode = 1;
    }
  }
  if (!sheets.length) return;

  const { manifest, pngBuffer } = pack(sheets);
  writeFileSync(join(outDir, 'sprites.png'), pngBuffer);
  writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  const totalFrames = Object.values(manifest.sheets).reduce((n, s) => n + s.frames.length, 0);
  console.log(`[sprites] compiled ${sheets.length} sheet(s), ${totalFrames} frame(s) -> ${outDir}`);
}

run();
