import * as THREE from 'three';

/**
 * All placeholder art is generated procedurally so the project runs with zero
 * binary assets. Each builder returns a NearestFilter CanvasTexture so pixels
 * stay crisp when the low-res frame is upscaled.
 */

type DrawFn = (ctx: CanvasRenderingContext2D, w: number, h: number) => void;

export function canvasTexture(w: number, h: number, draw: DrawFn): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  draw(canvas.getContext('2d')!, w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Builds a sprite from a pixel map: one character per pixel, '.' = transparent. */
export function spriteTexture(rows: string[], palette: Record<string, string>): THREE.CanvasTexture {
  return canvasTexture(rows[0].length, rows.length, (ctx) => {
    rows.forEach((row, y) => {
      [...row].forEach((ch, x) => {
        const color = palette[ch];
        if (color) {
          ctx.fillStyle = color;
          ctx.fillRect(x, y, 1, 1);
        }
      });
    });
  });
}

const WINDOW_WARM = '#d9a05a';
const WINDOW_COOL = '#7fb8d9';

interface FacadePalette {
  wall: string;
  shade: string;
  trim: string;
}

const FACADE_PALETTES: FacadePalette[] = [
  { wall: '#252b36', shade: '#1d222b', trim: '#2f3745' }, // blue-grey
  { wall: '#2a2733', shade: '#211f29', trim: '#363344' }, // violet-grey
  { wall: '#23292c', shade: '#1b2023', trim: '#2e3639' }, // teal-grey
  { wall: '#2b2624', shade: '#211d1c', trim: '#383130' }, // warm grey
];

const CANOPY_HUES = ['#5a2730', '#1f4a4a', '#4a3a1f', '#33254a'];

/**
 * Street-facing building: floors of varied windows (lit ones get interior
 * hints — curtains, blinds, shadow), AC units, grime streaks, a drain pipe,
 * and a storefront ground floor with canopy, doorway, and shutter.
 * Sized in pixels at ~13 px per world unit.
 */
export function facadeTexture(wPx: number, hPx: number): THREE.CanvasTexture {
  return canvasTexture(wPx, hPx, (ctx) => {
    const pal = FACADE_PALETTES[(Math.random() * FACADE_PALETTES.length) | 0];

    ctx.fillStyle = pal.wall;
    ctx.fillRect(0, 0, wPx, hPx);
    for (let i = 0; i < wPx * hPx * 0.06; i++) {
      ctx.fillStyle = Math.random() < 0.5 ? pal.shade : pal.trim;
      ctx.globalAlpha = 0.35;
      ctx.fillRect(Math.random() * wPx, Math.random() * hPx, 1.5, 1.5);
    }
    ctx.globalAlpha = 1;

    // parapet
    ctx.fillStyle = pal.shade;
    ctx.fillRect(0, 0, wPx, 5);
    ctx.fillStyle = pal.trim;
    ctx.fillRect(0, 5, wPx, 1.5);

    // window grid, one style per building
    const groundH = 26;
    const floorH = 15 + ((Math.random() * 3) | 0);
    const style = (Math.random() * 3) | 0;
    const winW = style === 2 ? 9 : 6;
    const winH = style === 0 ? 10 : 7;
    const gapX = 5 + ((Math.random() * 3) | 0);
    const cols = Math.max(1, Math.floor((wPx - 6) / (winW + gapX)));
    const startX = (wPx - cols * (winW + gapX) + gapX) / 2;

    for (let fy = 9; fy + winH + 2 < hPx - groundH; fy += floorH) {
      for (let c = 0; c < cols; c++) {
        const wx = startX + c * (winW + gapX);
        ctx.fillStyle = '#0c0f15';
        ctx.fillRect(wx - 1, fy - 1, winW + 2, winH + 2);
        const roll = Math.random();
        if (roll < 0.3) {
          ctx.fillStyle = Math.random() < 0.6 ? WINDOW_WARM : WINDOW_COOL;
          ctx.fillRect(wx, fy, winW, winH);
          ctx.fillStyle = 'rgba(0,0,0,0.35)';
          if (Math.random() < 0.5) ctx.fillRect(wx, fy + winH * 0.55, winW, winH * 0.45);
          if (Math.random() < 0.4) ctx.fillRect(wx + winW * 0.55, fy, winW * 0.45, winH);
          if (Math.random() < 0.3) {
            for (let b = fy + 1; b < fy + winH; b += 2.5) ctx.fillRect(wx, b, winW, 1);
          }
        } else {
          ctx.fillStyle = roll < 0.65 ? '#101622' : '#0d1219';
          ctx.fillRect(wx, fy, winW, winH);
          ctx.fillStyle = 'rgba(110,140,180,0.12)';
          ctx.fillRect(wx, fy, winW, 2);
        }
        ctx.fillStyle = pal.trim;
        ctx.fillRect(wx - 1, fy + winH + 1, winW + 2, 1.5);
        if (Math.random() < 0.35) {
          ctx.fillStyle = 'rgba(8,10,14,0.4)';
          ctx.fillRect(wx + ((Math.random() * winW) | 0), fy + winH + 2, 1.5, 4 + Math.random() * 6);
        }
        if (Math.random() < 0.22) {
          ctx.fillStyle = '#3a4150';
          ctx.fillRect(wx + 1, fy + winH + 2, 5, 4);
          ctx.fillStyle = '#262c38';
          ctx.fillRect(wx + 2, fy + winH + 3, 3, 2);
        }
      }
    }

    // drain pipe down one edge
    if (Math.random() < 0.55) {
      const pipeX = Math.random() < 0.5 ? 2 : wPx - 4;
      ctx.fillStyle = '#151a23';
      ctx.fillRect(pipeX, 6, 2.5, hPx - 6);
      ctx.fillStyle = '#0c0f15';
      for (let py = 14; py < hPx; py += 22) ctx.fillRect(pipeX - 0.5, py, 3.5, 2);
    }

    // storefront ground floor
    const gy = hPx - groundH;
    ctx.fillStyle = pal.shade;
    ctx.fillRect(0, gy, wPx, groundH);
    ctx.fillStyle = CANOPY_HUES[(Math.random() * CANOPY_HUES.length) | 0];
    ctx.fillRect(2, gy, wPx - 4, 4);
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(2, gy + 4, wPx - 4, 1.5);

    const doorX = 6 + Math.random() * (wPx - 22);
    const doorLit = Math.random() < 0.6;
    ctx.fillStyle = '#0c0f15';
    ctx.fillRect(doorX - 1, gy + 7, 11, groundH - 9);
    ctx.fillStyle = doorLit ? '#d98e4a' : '#131a26';
    ctx.fillRect(doorX, gy + 8, 9, groundH - 11);
    if (doorLit) {
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(doorX + 6, gy + 8, 3, groundH - 11);
    }

    const shX = doorX > wPx / 2 ? 5 : doorX + 14;
    const shW = Math.min(wPx - shX - 5, 18);
    if (shW > 8) {
      ctx.fillStyle = '#161b24';
      ctx.fillRect(shX, gy + 8, shW, groundH - 12);
      ctx.fillStyle = '#1f2530';
      for (let sy = gy + 9; sy < gy + groundH - 5; sy += 3) ctx.fillRect(shX, sy, shW, 1);
    }
  });
}

/** Neon sign: white-hot core text with a colored halo, on a dark housing. */
export function neonSignTexture(text: string, color: string): THREE.CanvasTexture {
  return canvasTexture(256, 80, (ctx, w, h) => {
    ctx.fillStyle = '#05060a';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.8;
    ctx.strokeRect(4.5, 4.5, w - 9, h - 9);
    ctx.globalAlpha = 1;
    ctx.font = 'bold 34px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = color;
    ctx.shadowBlur = 14;
    ctx.fillStyle = color;
    ctx.fillText(text, w / 2, h / 2 + 2, w - 24);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, w / 2, h / 2 + 2, w - 24);
  });
}

/** Night sky gradient with a smoggy horizon glow and a distant tower skyline. */
export function skyTexture(): THREE.CanvasTexture {
  return canvasTexture(512, 256, (ctx, w, h) => {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#04050c');
    grad.addColorStop(0.65, '#0c1326');
    grad.addColorStop(1, '#27172e');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) {
      const bw = 8 + Math.random() * 24;
      const bh = 30 + Math.random() * 110;
      const x = Math.random() * w;
      ctx.fillStyle = '#070a14';
      ctx.fillRect(x, h - bh, bw, bh);
      const windows = Math.floor(bw * bh * 0.004);
      ctx.fillStyle = Math.random() < 0.5 ? WINDOW_WARM : WINDOW_COOL;
      for (let k = 0; k < windows; k++) {
        ctx.globalAlpha = 0.4 + Math.random() * 0.5;
        ctx.fillRect(x + 2 + Math.random() * (bw - 4), h - bh + 2 + Math.random() * (bh - 8), 1.5, 1.5);
      }
      ctx.globalAlpha = 1;
    }
  });
}

const NEON_ACCENTS = ['#36e0ff', '#ff3da0', '#ffb03a', '#b14dff'];

/**
 * Mid-distance city strip: contiguous varied silhouettes with rooftop
 * clutter (antennas, beacons, water tanks), sparse dim windows, and the
 * occasional neon strip — bridges the 3D street and the painted skyline.
 * Transparent above the roofline so the plate shows through.
 */
export function midCityTexture(): THREE.CanvasTexture {
  const w = 1024;
  const h = 160;
  return canvasTexture(w, h, (ctx) => {
    let x = 0;
    while (x < w) {
      const bw = 24 + Math.random() * 56;
      const bh = 36 + Math.random() * 72;
      const top = h - bh;
      const shade = 12 + Math.floor(Math.random() * 6);
      ctx.fillStyle = `rgb(${shade}, ${shade + 3}, ${shade + 8})`;
      ctx.fillRect(x, top, bw, bh);
      // one edge faintly lit by city glow
      ctx.fillStyle = 'rgba(80, 110, 150, 0.25)';
      ctx.fillRect(x, top, 1.5, bh);

      const cols = Math.floor(bw / 7);
      const rows = Math.floor(bh / 9);
      for (let cy = 0; cy < rows; cy++) {
        for (let cx = 0; cx < cols; cx++) {
          if (Math.random() > 0.12) continue;
          ctx.globalAlpha = 0.45 + Math.random() * 0.4;
          ctx.fillStyle = Math.random() < 0.55 ? WINDOW_WARM : WINDOW_COOL;
          ctx.fillRect(x + 3 + cx * 7, top + 4 + cy * 9, 2.5, 3);
        }
      }
      ctx.globalAlpha = 1;

      if (Math.random() < 0.7) {
        const ax = x + 4 + Math.random() * (bw - 8);
        const ah = 8 + Math.random() * 18;
        ctx.fillStyle = '#0a0d14';
        ctx.fillRect(ax, top - ah, 1.5, ah);
        if (Math.random() < 0.6) {
          ctx.globalAlpha = 0.9;
          ctx.fillStyle = '#ff4455';
          ctx.fillRect(ax - 0.5, top - ah - 2, 2.5, 2.5);
          ctx.globalAlpha = 1;
        }
      }
      if (Math.random() < 0.4 && bw > 18) {
        const tx = x + 3 + Math.random() * (bw - 14);
        ctx.fillStyle = '#0b0f17';
        ctx.fillRect(tx, top - 7, 10, 7);
      }
      if (Math.random() < 0.22) {
        const c = NEON_ACCENTS[Math.floor(Math.random() * NEON_ACCENTS.length)];
        ctx.shadowColor = c;
        ctx.shadowBlur = 6;
        ctx.fillStyle = c;
        ctx.globalAlpha = 0.8;
        if (Math.random() < 0.5) {
          ctx.fillRect(x + bw - 5, top + 6, 2, Math.min(28, bh * 0.4));
        } else {
          ctx.fillRect(x + 4, top + 8, Math.min(bw - 8, 22), 5);
        }
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
      }
      // gaps between buildings let the painted skyline show through
      x += bw + (Math.random() < 0.55 ? 4 + Math.random() * 20 : 0);
    }
  });
}

/**
 * Street surface, structured like the REPLACED reference: a concrete walkway
 * along the buildings (texture top = far side), a lit curb edge, then rough
 * wet asphalt toward the camera with specular glint pixels.
 */
export function streetTexture(): THREE.CanvasTexture {
  const w = 256;
  const h = 128;
  const tex = canvasTexture(w, h, (ctx) => {
    // walkway
    ctx.fillStyle = '#171b22';
    ctx.fillRect(0, 0, w, 56);
    ctx.fillStyle = '#10141a';
    for (let x = 0; x < w; x += 32) ctx.fillRect(x, 0, 1.5, 56);
    ctx.fillRect(0, 26, w, 1);
    for (let i = 0; i < 700; i++) {
      ctx.fillStyle = Math.random() < 0.5 ? '#131720' : '#1c212b';
      ctx.fillRect(Math.random() * w, Math.random() * 56, 1.5, 1.5);
    }
    // curb: lit face, drop shadow
    ctx.fillStyle = '#3d4658';
    ctx.fillRect(0, 56, w, 3);
    ctx.fillStyle = '#05070b';
    ctx.fillRect(0, 59, w, 2);
    // asphalt rubble
    ctx.fillStyle = '#0e1117';
    ctx.fillRect(0, 61, w, h - 61);
    const shades = ['#0a0d12', '#12161e', '#181d27', '#0c0f15'];
    for (let i = 0; i < 2600; i++) {
      ctx.fillStyle = shades[(Math.random() * shades.length) | 0];
      ctx.fillRect(Math.random() * w, 61 + Math.random() * (h - 61), 1 + Math.random() * 2, 1 + Math.random());
    }
    // specular glints — bright single pixels that sparkle under the lights
    for (let i = 0; i < 90; i++) {
      ctx.fillStyle = Math.random() < 0.3 ? '#d8e4f4' : '#7e93b4';
      ctx.globalAlpha = 0.5 + Math.random() * 0.5;
      ctx.fillRect(Math.random() * w, 64 + Math.random() * (h - 66), 1.5, 1);
    }
    ctx.globalAlpha = 1;
    // tar patches
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = 'rgba(5,7,10,0.5)';
      ctx.fillRect(Math.random() * w, 65 + Math.random() * (h - 70), 14 + Math.random() * 30, 5 + Math.random() * 9);
    }
  });
  tex.wrapS = THREE.RepeatWrapping;
  tex.repeat.set(6, 1);
  return tex;
}
