import * as THREE from 'three';

export interface PlateOptions {
  /** Target width in texels — the "pixelation" resolution. */
  width: number;
  /** Color levels per channel; quantizing unifies painterly AI plates with pixel art. */
  posterize?: number;
  /** Multiplier applied before quantization, to seat bright plates into the scene's exposure. */
  brightness?: number;
}

/**
 * Pixelation pass for painted/AI-generated background plates: downsample to a
 * low texel count (with smoothing on, so detail averages instead of aliasing),
 * posterize the palette, and return a NearestFilter texture so the result
 * upscales as crisp pixels like the rest of the art.
 */
export async function loadPlateTexture(url: string, opts: PlateOptions): Promise<THREE.CanvasTexture> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error(`failed to load plate: ${url}`));
    el.src = url;
  });

  const w = opts.width;
  const h = Math.round(w * (img.height / img.width));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(img, 0, 0, w, h);

  const levels = opts.posterize ?? 0;
  const brightness = opts.brightness ?? 1;
  if (levels > 1 || brightness !== 1) {
    const data = ctx.getImageData(0, 0, w, h);
    const px = data.data;
    const step = levels > 1 ? 255 / (levels - 1) : 0;
    for (let i = 0; i < px.length; i += 4) {
      for (let c = 0; c < 3; c++) {
        let v = px[i + c] * brightness;
        if (levels > 1) v = Math.round(v / step) * step;
        px[i + c] = Math.min(255, v);
      }
    }
    ctx.putImageData(data, 0, 0);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
