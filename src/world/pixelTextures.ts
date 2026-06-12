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

export function buildingTexture(cols: number, rows: number, litRatio = 0.22): THREE.CanvasTexture {
  const cell = 8;
  const pad = 3;
  return canvasTexture(cols * cell + pad * 2, rows * cell + pad * 2, (ctx, w, h) => {
    ctx.fillStyle = '#101319';
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const lit = Math.random() < litRatio;
        ctx.fillStyle = lit
          ? (Math.random() < 0.5 ? WINDOW_WARM : WINDOW_COOL)
          : '#161b24';
        ctx.fillRect(pad + x * cell + 2, pad + y * cell + 2, cell - 4, cell - 3);
      }
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

export function groundTexture(): THREE.CanvasTexture {
  const size = 128;
  const tex = canvasTexture(size, size, (ctx) => {
    ctx.fillStyle = '#12151b';
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 900; i++) {
      ctx.fillStyle = Math.random() < 0.5 ? '#0d1015' : '#181c24';
      ctx.fillRect(Math.random() * size, Math.random() * size, 1.5, 1.5);
    }
  });
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(18, 4);
  return tex;
}
