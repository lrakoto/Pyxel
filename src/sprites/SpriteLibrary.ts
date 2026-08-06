/**
 * SpriteLibrary: the runtime half of the Aseprite pipeline. Loads the packed
 * atlas + manifest (produced by tools/aseprite-import.mjs), builds one shared
 * NearestFilter texture per frame, and exposes tag-based animation windows.
 * All textures are cached so a hundred pedestrians don't upload a hundred
 * copies of the same pixels.
 */
import * as THREE from 'three';
import type { AsepriteSheetMeta, AsepriteTagMeta, SpriteManifest } from './types';

export interface SpriteFrame {
  texture: THREE.Texture;
  /** Frame duration in seconds, as authored in Aseprite. */
  duration: number;
  /** Atlas cell width/height in texels (all frames in a sheet match). */
  w: number;
  h: number;
}

export interface SpriteSheet {
  id: string;
  /** Pivot in cell texels (Aseprite slice, else centred) — the sprite's "feet" anchor. */
  pivotX: number;
  pivotY: number;
  frames: SpriteFrame[];
  tags: Record<string, AsepriteTagMeta>;
  /** Aspect (w/h) of a frame — useful when you only want to set a world height. */
  aspect: number;
}

let manifestPromise: Promise<SpriteManifest> | null = null;
let atlasTexture: THREE.Texture | null = null;
const textureCache = new Map<string, SpriteFrame>();

/**
 * Loads (once) the manifest from /sprites/manifest.json. Kept as a singleton
 * promise so callers can freely `await getManifest()` from many places without
 * racing the network.
 */
function getManifest(base = '/sprites'): Promise<SpriteManifest> {
  manifestPromise ??= fetch(`${base}/manifest.json`)
    .then((r) => {
      if (!r.ok) throw new Error(`sprite manifest: HTTP ${r.status}`);
      return r.json() as Promise<SpriteManifest>;
    })
    .catch((err) => {
      console.warn('[sprites] manifest unavailable; procedural art stays in use', err);
      return { version: 1, atlas: 'sprites.png', sheets: {} } as SpriteManifest;
    });
  return manifestPromise;
}

function getAtlas(base = '/sprites', url = 'sprites.png'): Promise<THREE.Texture> {
  if (atlasTexture) return Promise.resolve(atlasTexture);
  return new Promise((resolve) => {
    new THREE.TextureLoader().load(
      `${base}/${url}`,
      (tex) => {
        tex.magFilter = THREE.NearestFilter;
        tex.minFilter = THREE.NearestFilter;
        tex.generateMipmaps = false;
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.flipY = false;
        atlasTexture = tex;
        resolve(tex);
      },
      undefined,
      (err) => {
        console.warn('[sprites] atlas failed to load', err);
        // Return a 1×1 transparent texture so callers don't crash; the
        // sheet will simply be empty and the procedural fallback takes over.
        const empty = new THREE.Texture();
        atlasTexture = empty;
        resolve(empty);
      },
    );
  });
}

/** Builds one SpriteFrame for an atlas region, or reuses the cached one. */
function frameFor(sheetId: string, idx: number, meta: { x: number; y: number; w: number; h: number }, atlasW: number, atlasH: number): SpriteFrame {
  const key = `${sheetId}:${idx}`;
  const cached = textureCache.get(key);
  if (cached) return cached;

  const base = atlasTexture!;
  const tex = new THREE.Texture();
  tex.image = base.image;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.flipY = false;
  // Atlas y runs top-to-bottom; UVs run bottom-to-top with flipY off.
  tex.repeat.set(meta.w / atlasW, meta.h / atlasH);
  tex.offset.set(meta.x / atlasW, 1 - (meta.y + meta.h) / atlasH);

  const frame: SpriteFrame = { texture: tex, duration: 0, w: meta.w, h: meta.h };
  textureCache.set(key, frame);
  return frame;
}

/**
 * High-level loader the rest of the game uses. Returns null if the requested
 * sheet isn't in the compiled manifest — callers fall back to the procedural
 * pixel-map texture in that case, which keeps the game working before real
 * art exists.
 */
export async function loadSheet(id: string, base = '/sprites'): Promise<SpriteSheet | null> {
  const manifest = await getManifest(base);
  const sheetMeta: AsepriteSheetMeta | undefined = manifest.sheets[id];
  if (!sheetMeta) return null;
  await getAtlas(base, manifest.atlas);
  if (!atlasTexture || !('image' in atlasTexture) || !atlasTexture.image) return null;

  const frames = sheetMeta.frames.map((f, i) => {
    const frame = frameFor(id, i, f, sheetMeta.atlasW, sheetMeta.atlasH);
    frame.duration = f.duration;
    return frame;
  });

  return {
    id,
    pivotX: sheetMeta.pivotX,
    pivotY: sheetMeta.pivotY,
    frames,
    tags: sheetMeta.tags,
    aspect: sheetMeta.cellW / sheetMeta.cellH,
  };
}

/** True when the compiled manifest actually contains `id`. */
export async function hasSheet(id: string, base = '/sprites'): Promise<boolean> {
  const manifest = await getManifest(base);
  return id in manifest.sheets;
}
