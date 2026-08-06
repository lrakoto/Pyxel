/**
 * The on-disk JSON produced by tools/aseprite-import.mjs for a single
 * compiled .aseprite file. The runtime `SpriteLibrary` consumes this; it is
 * intentionally close to Aseprite's own concepts (frames, tags, pivot) so an
 * artist's .aseprite file maps straight onto it.
 */
export interface AsepriteFrameMeta {
  /** Atlas x offset in texels. */
  x: number;
  /** Atlas y offset in texels. */
  y: number;
  /** Frame width in texels. */
  w: number;
  /** Frame height in texels. */
  h: number;
  /** How long this frame shows for, in seconds (from the file or tag). */
  duration: number;
}

export interface AsepriteTagMeta {
  /** First frame index (inclusive) within this tag. */
  from: number;
  /** Last frame index (inclusive) — `to` may equal `from`. */
  to: number;
  /** 0 = forward, 1 = reverse, 2 = ping-pong, 3 = ping-pong reverse. */
  direction: 0 | 1 | 2 | 3;
  /** How many times Aseprite says to play it; 0 = loop forever in UI. */
  repeat: number;
}

export interface AsepriteSheetMeta {
  /** Basename of the source file, minus extension, e.g. "cole". */
  id: string;
  /** Atlas texture width / height in texels. */
  atlasW: number;
  atlasH: number;
  /** The sprite canvas each frame was drawn on (atlas cells are this size). */
  cellW: number;
  cellH: number;
  /** Optional anchor in cell texels (Aseprite slice pivot, else centred). */
  pivotX: number;
  pivotY: number;
  frames: AsepriteFrameMeta[];
  /** Tag name (lower-cased) -> its timing window. */
  tags: Record<string, AsepriteTagMeta>;
}

export interface SpriteManifest {
  version: 1;
  /** File name of the packed atlas under /sprites/. */
  atlas: string;
  sheets: Record<string, AsepriteSheetMeta>;
}
