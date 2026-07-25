import * as THREE from 'three';
import { canvasTexture } from './pixelTextures';
import type { Updatable } from './sector7';
import type { AreaWorld, DoorDef } from './area';
import type { InteractionDef } from './dialogue';

/**
 * Marlon Graves' neural art studio — the crime scene.
 *
 * An abandoned studio in Sector 7 where Marlon's body was found. The space is
 * intimate: a single room with concrete walls, a cracked tile floor, unfinished
 * paintings on easels, a neural interface device, scattered canvases, and the
 * final artwork "Everybody/Nobody" still on the far wall. The body outline glows
 * faintly on the floor. No rain here, but the hum of the building's power
 * bleeds through, and a single flickering work-light cuts the dark.
 *
 * Layout (x is left-right, z is depth):
 *
 *   z = -8   back wall with "Everybody/Nobody" canvas
 *   z = -6   easels with unfinished paintings
 *   z = -4   neural device on a workbench
 *   z = -2   body outline on floor
 *   z =  0   scattered canvases, paint table
 *   z =  2   exit door (leads back to Sector 7)
 */

const STUDIO_DOORS: DoorDef[] = [
  {
    x: 7, z: 2, radius: 2.5,
    label: 'Exit to Sector 7',
    target: 'sector7',
    spawnX: -14,
    spawnFacing: -1,
  },
];

const STUDIO_INTERACTIONS: InteractionDef[] = [
  {
    x: 0, z: -8, radius: 3,
    label: '"EVERYBODY/NOBODY"',
    lines: [
      'The final painting. Fractured faces dissolve into one another — hundreds of them, maybe thousands. At first it looks like abstract chaos. But the longer I look, the more I see: each fragment is a piece of someone. A memory. A feeling. A face that doesn\'t belong to Marlon.',
      'The title is scratched into the frame: "EVERYBODY/NOBODY." Under the UV-light traces on the canvas, I can see neural signatures — the kind of thing you\'d only get if you wired someone\'s creative cortex directly into the work.',
      'This isn\'t a painting. It\'s a map. Of stolen minds.',
    ],
  },
  {
    x: -3.5, z: -6, radius: 2.5,
    label: 'Unfinished painting',
    lines: [
      'An easel holds a half-finished canvas. The strokes are urgent, jagged — Marlon was working fast, as if he knew he was running out of time. The subject is a woman\'s face, dissolving into light. I don\'t recognize her. But someone would.',
      'The paint is still tacky. This was done the night he died.',
    ],
  },
  {
    x: 3.5, z: -6, radius: 2.5,
    label: 'Unfinished painting',
    lines: [
      'Another easel, another interrupted work. This one is darker — a cityscape where the buildings are made of faces, their windows like eyes. The perspective is wrong, intentionally. It makes you feel like you\'re falling into it.',
      'Marlon was painting the same thing from different angles: the fragments of people, stitched together. He was trying to show what he\'d found.',
    ],
  },
  {
    x: 3, z: -4, radius: 2.5,
    label: 'Neural interface device',
    lines: [
      'A tangle of cables, a neural jack receiver, and a portable projector unit, wired into a laptop that\'s still warm. The screen is dark, but the drive light pulses — it\'s still running something. This is the device that was plugged into Marlon\'s implants when he died.',
      'The jack receiver is crusted with dried blood. Whoever used this didn\'t care about sterile procedure. They just wanted in.',
      'I bag it. Tech division can pull the logs.',
    ],
  },
  {
    x: 0, z: -2, radius: 3,
    label: 'Body outline',
    lines: [
      'The chalk outline on the floor. Marlon Graves was found here, on his back, arms at his sides. No defensive wounds. No struggle. The coroner\'s report said his heart just... stopped. But his neural implants were fried — like something had drained them completely.',
      'I crouch. The concrete under the outline is discolored — a faint, iridescent residue, like oil on water. I\'ve never seen that at a crime scene before.',
      'I scrape a sample into a vial. Whatever this is, it isn\'t paint.',
    ],
  },
  {
    x: -4, z: 0, radius: 2.5,
    label: 'Workbench',
    lines: [
      'A cluttered workbench. Tubes of paint, neural patch cables, empty stimulant injectors, and a journal. The journal is open to the last entry: "They don\'t know I can hear them. The fragments. They\'re not gone — they\'re here. In the work. In ME. I can hear everybody. I can hear nobody. I have to get this out before—"',
      'The sentence ends there.',
    ],
  },
  {
    x: 0, z: 0, radius: 2.5,
    label: 'Scattered canvases',
    lines: [
      'A pile of canvases, knocked from their easels. Some are blank. Others show the same fractured style as the final work — fragments of faces, fragments of lives. One has been slashed, violently, as if someone tried to destroy it. The slash goes through a woman\'s eyes.',
      'I count seven canvases. The report said Marlon had been working for weeks. Seven paintings. Seven attempts to show what he\'d found.',
    ],
  },
  {
    x: -7, z: -4, radius: 2.5,
    label: 'Wall writing',
    lines: [
      'Someone wrote on the concrete wall in black marker. The handwriting is shaky, desperate: "THEY TAKE WHAT MAKES YOU YOU. THE CITY RUNS ON STOLEN DREAMS. WE ARE EVERYBODY. WE ARE NOBODY. FIND THE FIRST ONE."',
      '"Find the first one." The first victim? The first fragment? The first person to realize what was happening?',
      'I photograph it. This is Marlon\'s testimony, written in his last hours.',
    ],
  },
  {
    x: 7, z: 2, radius: 2.5,
    label: 'Studio door',
    lines: [
      'The door to the street. The lock is broken — not forced, but picked. Someone who knew what they were doing came through here. The hinges are oiled, silent. A professional, or someone who didn\'t want to be heard.',
      'Beyond the door, the rain and neon of Sector 7 waits.',
    ],
  },
];

/* ── Procedural textures ─────────────────────────────────────────── */

/** Cracked concrete wall with exposed brick patches, conduit, and water stains. */
function wallTexture(wPx: number, hPx: number): THREE.CanvasTexture {
  return canvasTexture(wPx, hPx, (ctx) => {
    // Base — damp concrete, warm dark
    ctx.fillStyle = '#2a2520';
    ctx.fillRect(0, 0, wPx, hPx);

    // Concrete noise — fine grain
    for (let i = 0; i < wPx * hPx * 0.12; i++) {
      const v = Math.random();
      const shade = v < 0.5
        ? `rgba(18,15,12,${0.15 + Math.random() * 0.25})`
        : `rgba(55,48,40,${0.1 + Math.random() * 0.15})`;
      ctx.fillStyle = shade;
      ctx.fillRect(Math.random() * wPx, Math.random() * hPx, 1.5, 1.5);
    }

    // Exposed brick patches — where the concrete has crumbled
    for (let patch = 0; patch < 4; patch++) {
      const px = Math.random() * wPx;
      const py = Math.random() * hPx;
      const pw = 20 + Math.random() * 40;
      const ph = 15 + Math.random() * 30;
      for (let by = 0; by < ph; by += 5) {
        for (let bx = 0; bx < pw; bx += 10) {
          const r = 45 + Math.random() * 15;
          const g = 25 + Math.random() * 10;
          const b = 18 + Math.random() * 8;
          ctx.fillStyle = `rgb(${r},${g},${b})`;
          ctx.fillRect(px + bx, py + by, 9, 4);
          ctx.fillStyle = `rgba(20,12,8,0.4)`;
          ctx.fillRect(px + bx, py + by + 4, 9, 1);
        }
      }
    }

    // Cracks — deeper, more branching
    ctx.strokeStyle = 'rgba(12,8,6,0.55)';
    ctx.lineWidth = 0.9;
    for (let i = 0; i < 12; i++) {
      ctx.beginPath();
      let x = Math.random() * wPx;
      let y = Math.random() * hPx;
      ctx.moveTo(x, y);
      for (let s = 0; s < 16; s++) {
        x += (Math.random() - 0.5) * 25;
        y += (Math.random() - 0.5) * 25;
        ctx.lineTo(x, y);
        // Occasional branch
        if (Math.random() < 0.2) {
          ctx.moveTo(x, y);
          ctx.lineTo(x + (Math.random() - 0.5) * 10, y + (Math.random() - 0.5) * 10);
          ctx.moveTo(x, y);
        }
      }
      ctx.stroke();
    }

    // Water stains — multiple layers for depth
    for (let i = 0; i < 8; i++) {
      const x = Math.random() * wPx;
      const y = Math.random() * hPx;
      const r = 15 + Math.random() * 40;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(25,18,12,0.35)');
      g.addColorStop(0.5, 'rgba(25,18,12,0.15)');
      g.addColorStop(1, 'rgba(25,18,12,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }

    // Electrical conduit — horizontal run near the top
    ctx.fillStyle = '#1a1612';
    ctx.fillRect(0, 20, wPx, 4);
    ctx.fillStyle = '#2a2620';
    ctx.fillRect(0, 20, wPx, 1);
    // Conduit brackets
    for (let bx = 30; bx < wPx; bx += 40) {
      ctx.fillStyle = '#0a0806';
      ctx.fillRect(bx, 18, 3, 8);
    }

    // Baseboard strip at the bottom
    ctx.fillStyle = '#15110d';
    ctx.fillRect(0, hPx - 8, wPx, 8);
    ctx.fillStyle = '#1f1a14';
    ctx.fillRect(0, hPx - 8, wPx, 2);
  });
}

/** Cracked tile floor with paint splatters, dust, and debris. */
function floorTexture(wPx: number, hPx: number): THREE.CanvasTexture {
  return canvasTexture(wPx, hPx, (ctx) => {
    // Base
    ctx.fillStyle = '#1c1815';
    ctx.fillRect(0, 0, wPx, hPx);

    // Tile grid — irregular, aged
    const tileW = 28;
    const tileH = 28;
    for (let ty = 0; ty < hPx; ty += tileH) {
      for (let tx = 0; tx < wPx; tx += tileW) {
        const shade = 22 + Math.floor(Math.random() * 12);
        const r = shade;
        const g = shade - 2;
        const b = shade - 5;
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(tx, ty, tileW - 1, tileH - 1);
        // Tile edge darkening
        ctx.fillStyle = 'rgba(8,5,3,0.4)';
        ctx.fillRect(tx, ty, tileW - 1, 1);
        ctx.fillRect(tx, ty, 1, tileH - 1);
        // Grime buildup in corners
        if (Math.random() < 0.4) {
          ctx.fillStyle = `rgba(12,8,5,${0.3 + Math.random() * 0.2})`;
          ctx.fillRect(tx + tileW - 6, ty + tileH - 6, 5, 5);
        }
        // Fine dust
        if (Math.random() < 0.15) {
          for (let d = 0; d < 3; d++) {
            ctx.fillStyle = `rgba(${30 + Math.random() * 10},${25 + Math.random() * 8},${18 + Math.random() * 5},0.15)`;
            ctx.fillRect(tx + Math.random() * tileW, ty + Math.random() * tileH, 2, 2);
          }
        }
      }
    }

    // Paint splatters — this is an art studio
    const splatterColors = [
      [180, 60, 50], [60, 80, 140], [140, 50, 80], [180, 120, 40],
      [50, 120, 80], [120, 40, 100], [200, 80, 60],
    ];
    for (let i = 0; i < 40; i++) {
      const cx = Math.random() * wPx;
      const cy = Math.random() * hPx;
      const color = splatterColors[Math.floor(Math.random() * splatterColors.length)];
      const alpha = 0.15 + Math.random() * 0.25;
      ctx.fillStyle = `rgba(${color[0]},${color[1]},${color[2]},${alpha})`;
      // Main splat
      ctx.beginPath();
      ctx.arc(cx, cy, 2 + Math.random() * 5, 0, Math.PI * 2);
      ctx.fill();
      // Drip
      if (Math.random() < 0.5) {
        ctx.fillRect(cx, cy, 1, 3 + Math.random() * 8);
      }
      // Secondary droplets
      for (let d = 0; d < 3; d++) {
        const dx = cx + (Math.random() - 0.5) * 15;
        const dy = cy + (Math.random() - 0.5) * 15;
        ctx.beginPath();
        ctx.arc(dx, dy, 1 + Math.random() * 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Cracks — deeper and more varied
    ctx.strokeStyle = 'rgba(8,5,3,0.6)';
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 8; i++) {
      ctx.beginPath();
      let x = Math.random() * wPx;
      let y = Math.random() * hPx;
      ctx.moveTo(x, y);
      for (let s = 0; s < 12; s++) {
        x += (Math.random() - 0.5) * 35;
        y += (Math.random() - 0.5) * 35;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // Broken tile — a few tiles with chunks missing
    for (let i = 0; i < 6; i++) {
      const tx = Math.floor(Math.random() * (wPx / tileW)) * tileW;
      const ty = Math.floor(Math.random() * (hPx / tileH)) * tileH;
      ctx.fillStyle = '#080604';
      ctx.fillRect(tx + 5, ty + 5, 8 + Math.random() * 10, 8 + Math.random() * 10);
    }
  });
}

/**
 * The "Everybody/Nobody" painting — the story's central artifact.
 * High-detail version: dozens of fragmented faces, some recognizable,
 * dissolving into neural traces. Luminous quality with embedded glow.
 */
function everybodyNobodyTexture(): THREE.CanvasTexture {
  return canvasTexture(256, 192, (ctx) => {
    // Dark canvas background — aged, varnished
    const bgGrad = ctx.createLinearGradient(0, 0, 0, 192);
    bgGrad.addColorStop(0, '#0a0810');
    bgGrad.addColorStop(0.5, '#0e0a14');
    bgGrad.addColorStop(1, '#080610');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 256, 192);

    // Fractured face fragments — more numerous, more detailed
    // Each "face" is a cluster of strokes suggesting features
    const faceColors = [
      { skin: [140, 110, 90], hair: [40, 30, 25], glow: [100, 180, 255] },
      { skin: [120, 95, 80], hair: [60, 40, 30], glow: [180, 100, 255] },
      { skin: [100, 85, 70], hair: [30, 25, 20], glow: [100, 220, 180] },
      { skin: [150, 120, 95], hair: [80, 50, 30], glow: [255, 180, 100] },
      { skin: [90, 75, 65], hair: [20, 18, 15], glow: [200, 120, 255] },
    ];

    // Draw ~50 fragmented faces at various sizes and positions
    for (let i = 0; i < 50; i++) {
      const cx = Math.random() * 256;
      const cy = Math.random() * 192;
      const size = 8 + Math.random() * 28;
      const pal = faceColors[Math.floor(Math.random() * faceColors.length)];
      const alpha = 0.2 + Math.random() * 0.35;
      const angle = Math.random() * Math.PI * 2;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle);

      // Face fragment — an irregular shard of skin-tone
      ctx.fillStyle = `rgba(${pal.skin[0]},${pal.skin[1]},${pal.skin[2]},${alpha})`;
      ctx.beginPath();
      ctx.moveTo(-size * 0.4, -size * 0.5);
      ctx.lineTo(size * 0.4, -size * 0.3);
      ctx.lineTo(size * 0.5, size * 0.4);
      ctx.lineTo(-size * 0.3, size * 0.5);
      ctx.closePath();
      ctx.fill();

      // Sometimes a hint of an eye — just a dark dot
      if (Math.random() < 0.4) {
        ctx.fillStyle = `rgba(10,8,6,${alpha * 0.8})`;
        ctx.beginPath();
        ctx.arc(-size * 0.1, -size * 0.1, 1.5, 0, Math.PI * 2);
        ctx.fill();
        // Iris hint — a tiny glow
        ctx.fillStyle = `rgba(${pal.glow[0]},${pal.glow[1]},${pal.glow[2]},${alpha * 0.5})`;
        ctx.beginPath();
        ctx.arc(-size * 0.1, -size * 0.1, 0.8, 0, Math.PI * 2);
        ctx.fill();
      }

      // Sometimes a mouth — a darker stroke
      if (Math.random() < 0.3) {
        ctx.strokeStyle = `rgba(${pal.skin[0] - 40},${pal.skin[1] - 30},${pal.skin[2] - 25},${alpha * 0.6})`;
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(-size * 0.15, size * 0.2);
        ctx.lineTo(size * 0.15, size * 0.2);
        ctx.stroke();
      }

      // Hair fragment — darker patch at top
      if (Math.random() < 0.35) {
        ctx.fillStyle = `rgba(${pal.hair[0]},${pal.hair[1]},${pal.hair[2]},${alpha * 0.7})`;
        ctx.fillRect(-size * 0.3, -size * 0.5, size * 0.6, size * 0.15);
      }

      ctx.restore();
    }

    // Neural traces — thin glowing lines connecting fragments, like a neural map
    ctx.lineCap = 'round';
    for (let i = 0; i < 30; i++) {
      const x1 = Math.random() * 256;
      const y1 = Math.random() * 192;
      const x2 = x1 + (Math.random() - 0.5) * 60;
      const y2 = y1 + (Math.random() - 0.5) * 60;
      const glowAlpha = 0.08 + Math.random() * 0.1;
      // Outer glow
      ctx.strokeStyle = `rgba(80,150,255,${glowAlpha * 0.5})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.bezierCurveTo(x1 + 10, y1 - 5, x2 - 10, y2 + 5, x2, y2);
      ctx.stroke();
      // Core line
      ctx.strokeStyle = `rgba(120,200,255,${glowAlpha})`;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.bezierCurveTo(x1 + 10, y1 - 5, x2 - 10, y2 + 5, x2, y2);
      ctx.stroke();
    }

    // Bright nodes — where neural traces converge
    for (let i = 0; i < 15; i++) {
      const x = Math.random() * 256;
      const y = Math.random() * 192;
      const g = ctx.createRadialGradient(x, y, 0, x, y, 4);
      g.addColorStop(0, 'rgba(150,220,255,0.4)');
      g.addColorStop(0.5, 'rgba(80,150,255,0.15)');
      g.addColorStop(1, 'rgba(80,150,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - 4, y - 4, 8, 8);
    }

    // Central "convergence" — the painting's focal point where fragments merge
    const cgx = 128;
    const cgy = 90;
    const cg = ctx.createRadialGradient(cgx, cgy, 5, cgx, cgy, 40);
    cg.addColorStop(0, 'rgba(100,180,255,0.12)');
    cg.addColorStop(0.5, 'rgba(80,120,200,0.05)');
    cg.addColorStop(1, 'rgba(80,120,200,0)');
    ctx.fillStyle = cg;
    ctx.fillRect(cgx - 40, cgy - 40, 80, 80);

    // Title scratched into the canvas — small, at the bottom
    ctx.fillStyle = 'rgba(200,200,210,0.5)';
    ctx.font = '7px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('EVERYBODY / NOBODY', 128, 185);
    ctx.textAlign = 'left';

    // Varnish cracks — aging on the painting surface
    ctx.strokeStyle = 'rgba(40,30,25,0.15)';
    ctx.lineWidth = 0.3;
    for (let i = 0; i < 20; i++) {
      ctx.beginPath();
      let x = Math.random() * 256;
      let y = Math.random() * 192;
      ctx.moveTo(x, y);
      for (let s = 0; s < 6; s++) {
        x += (Math.random() - 0.5) * 20;
        y += (Math.random() - 0.5) * 20;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  });
}

/** An unfinished painting on an easel — more detailed brushwork. */
function unfinishedPainting(variant: number): THREE.CanvasTexture {
  return canvasTexture(80, 100, (ctx) => {
    // Canvas base — raw, slightly stained
    ctx.fillStyle = '#1a1614';
    ctx.fillRect(0, 0, 80, 100);
    // Canvas texture
    for (let i = 0; i < 200; i++) {
      ctx.fillStyle = `rgba(40,35,30,${Math.random() * 0.1})`;
      ctx.fillRect(Math.random() * 80, Math.random() * 100, 1, 1);
    }

    if (variant === 0) {
      // Face dissolving into light — warmer palette
      // Base wash
      ctx.fillStyle = 'rgba(80,60,50,0.2)';
      ctx.fillRect(10, 15, 60, 70);

      // Face strokes — a woman's profile emerging then dissolving
      const strokes = 35;
      for (let i = 0; i < strokes; i++) {
        const x = 10 + Math.random() * 60;
        const y = 15 + Math.random() * 70;
        const w = 3 + Math.random() * 12;
        const h = 2 + Math.random() * 6;
        const r = 100 + Math.random() * 60;
        const g = 70 + Math.random() * 40;
        const b = 60 + Math.random() * 40;
        const alpha = 0.2 + Math.random() * 0.3;
        ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
        // Brush stroke — slightly directional
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(Math.random() * 0.5 - 0.25);
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
      }
      // Dissolution — light particles at the edge
      for (let i = 0; i < 15; i++) {
        const x = 50 + Math.random() * 30;
        const y = 20 + Math.random() * 60;
        ctx.fillStyle = `rgba(200,180,150,${0.1 + Math.random() * 0.2})`;
        ctx.beginPath();
        ctx.arc(x, y, 1 + Math.random() * 2, 0, Math.PI * 2);
        ctx.fill();
      }
      // Unfinished bottom — raw canvas
      ctx.fillStyle = '#1a1614';
      ctx.fillRect(0, 75, 80, 25);

    } else {
      // Cityscape of faces — darker, cooler
      const strokes = 40;
      for (let i = 0; i < strokes; i++) {
        const x = Math.random() * 80;
        const y = Math.random() * 100;
        const w = 3 + Math.random() * 10;
        const h = 2 + Math.random() * 8;
        const r = 40 + Math.random() * 30;
        const g = 40 + Math.random() * 30;
        const b = 50 + Math.random() * 40;
        const alpha = 0.2 + Math.random() * 0.3;
        ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
        ctx.fillRect(x, y, w, h);
      }
      // Window-eyes — a few glowing dots
      for (let i = 0; i < 8; i++) {
        const x = Math.random() * 80;
        const y = Math.random() * 100;
        ctx.fillStyle = `rgba(180,200,255,${0.2 + Math.random() * 0.2})`;
        ctx.fillRect(x, y, 2, 2);
      }
      // Unfinished right side — raw canvas
      ctx.fillStyle = '#1a1614';
      ctx.fillRect(50, 0, 30, 100);
    }
  });
}

/** The neural interface device — more detailed tech tangle. */
function deviceTexture(): THREE.CanvasTexture {
  return canvasTexture(48, 32, (ctx) => {
    // Base — dark surface
    ctx.fillStyle = '#0a0c10';
    ctx.fillRect(0, 0, 48, 32);

    // Workbench surface behind device
    ctx.fillStyle = '#2a2018';
    ctx.fillRect(0, 0, 48, 32);

    // Main device body — a laptop-like unit
    ctx.fillStyle = '#1a1e28';
    ctx.fillRect(6, 10, 28, 14);
    ctx.fillStyle = '#2a2e38';
    ctx.fillRect(6, 10, 28, 2);

    // Screen — dark with faint blue glow
    ctx.fillStyle = '#0a2a4a';
    ctx.fillRect(8, 13, 18, 9);
    // Screen glow
    const sg = ctx.createRadialGradient(17, 17, 0, 17, 17, 12);
    sg.addColorStop(0, 'rgba(100,180,255,0.15)');
    sg.addColorStop(1, 'rgba(100,180,255,0)');
    ctx.fillStyle = sg;
    ctx.fillRect(8, 13, 18, 9);

    // Drive light — pulsing green
    ctx.fillStyle = '#2aff8a';
    ctx.fillRect(28, 16, 2, 2);
    const dg = ctx.createRadialGradient(29, 17, 0, 29, 17, 4);
    dg.addColorStop(0, 'rgba(42,255,138,0.4)');
    dg.addColorStop(1, 'rgba(42,255,138,0)');
    ctx.fillStyle = dg;
    ctx.fillRect(25, 13, 8, 8);

    // Neural jack receiver — to the right of the laptop
    ctx.fillStyle = '#1a1614';
    ctx.fillRect(36, 8, 8, 16);
    // Jack port — dark circle with blood crust
    ctx.fillStyle = '#0a0806';
    ctx.beginPath();
    ctx.arc(40, 16, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#3a1a1a';
    ctx.lineWidth = 1;
    ctx.stroke();
    // Blood crust — reddish around the port
    ctx.fillStyle = 'rgba(120,30,20,0.4)';
    ctx.beginPath();
    ctx.arc(40, 16, 4, 0, Math.PI * 2);
    ctx.fill();

    // Cables — thicker, more visible
    ctx.strokeStyle = '#2a2e38';
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    // Cable from jack to laptop
    ctx.beginPath();
    ctx.moveTo(36, 20);
    ctx.bezierCurveTo(34, 22, 32, 20, 34, 24);
    ctx.stroke();
    // Cable hanging off the bench
    ctx.beginPath();
    ctx.moveTo(6, 14);
    ctx.bezierCurveTo(3, 14, 1, 18, 2, 24);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(6, 18);
    ctx.bezierCurveTo(3, 18, 0, 22, 1, 28);
    ctx.stroke();
    // Neural patch cable — glowing blue
    ctx.strokeStyle = 'rgba(80,140,255,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(40, 24);
    ctx.bezierCurveTo(40, 28, 38, 30, 36, 30);
    ctx.stroke();

    // Small indicator LEDs on the laptop
    ctx.fillStyle = '#ff8844';
    ctx.fillRect(30, 20, 1, 1);
    ctx.fillStyle = '#44ff88';
    ctx.fillRect(32, 20, 1, 1);
  });
}

/** Chalk body outline — more detailed with stronger iridescent residue. */
function bodyOutlineTexture(): THREE.CanvasTexture {
  const tex = canvasTexture(128, 64, (ctx) => {
    ctx.clearRect(0, 0, 128, 64);

    // Chalk outline — rougher, more realistic
    ctx.strokeStyle = 'rgba(220,220,230,0.55)';
    ctx.lineWidth = 1.8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    // Head
    ctx.arc(64, 10, 7, 0, Math.PI * 2);
    ctx.stroke();
    // Neck
    ctx.moveTo(60, 17);
    ctx.lineTo(60, 20);
    ctx.moveTo(68, 17);
    ctx.lineTo(68, 20);
    // Shoulders
    ctx.moveTo(60, 20);
    ctx.lineTo(50, 24);
    ctx.moveTo(68, 20);
    ctx.lineTo(78, 24);
    // Arms (at sides)
    ctx.moveTo(50, 24);
    ctx.lineTo(48, 42);
    ctx.moveTo(78, 24);
    ctx.lineTo(80, 42);
    // Hands
    ctx.moveTo(46, 42);
    ctx.lineTo(50, 44);
    ctx.moveTo(82, 42);
    ctx.lineTo(78, 44);
    // Torso
    ctx.moveTo(60, 20);
    ctx.lineTo(58, 48);
    ctx.moveTo(68, 20);
    ctx.lineTo(70, 48);
    // Legs
    ctx.moveTo(58, 48);
    ctx.lineTo(59, 62);
    ctx.moveTo(70, 48);
    ctx.lineTo(69, 62);
    // Feet
    ctx.moveTo(57, 62);
    ctx.lineTo(62, 62);
    ctx.moveTo(71, 62);
    ctx.lineTo(66, 62);
    ctx.stroke();

    // Chalk dust — scatter around the lines
    for (let i = 0; i < 80; i++) {
      const x = 40 + Math.random() * 48;
      const y = 5 + Math.random() * 57;
      ctx.fillStyle = `rgba(220,220,230,${0.05 + Math.random() * 0.1})`;
      ctx.fillRect(x, y, 1, 1);
    }

    // Iridescent residue — oil-on-water sheen, stronger
    const ig = ctx.createRadialGradient(64, 33, 3, 64, 33, 28);
    ig.addColorStop(0, 'rgba(100,70,140,0.22)');
    ig.addColorStop(0.3, 'rgba(80,100,160,0.15)');
    ig.addColorStop(0.6, 'rgba(60,140,120,0.08)');
    ig.addColorStop(1, 'rgba(60,140,120,0)');
    ctx.fillStyle = ig;
    ctx.fillRect(0, 0, 128, 64);

    // Brighter residue spots — where the "harvesting" happened
    for (let i = 0; i < 5; i++) {
      const x = 55 + Math.random() * 18;
      const y = 25 + Math.random() * 20;
      const g = ctx.createRadialGradient(x, y, 0, x, y, 5);
      g.addColorStop(0, 'rgba(120,90,170,0.25)');
      g.addColorStop(1, 'rgba(120,90,170,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - 5, y - 5, 10, 10);
    }
  });
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  return tex;
}

/** Wall writing texture — actual text rendered on the wall. */
function wallWritingTexture(): THREE.CanvasTexture {
  return canvasTexture(128, 64, (ctx) => {
    ctx.clearRect(0, 0, 128, 64);
    // Black marker text — shaky, desperate
    ctx.fillStyle = 'rgba(20,18,16,0.8)';
    ctx.font = 'bold 8px monospace';
    ctx.textAlign = 'center';
    // Shaky text effect — draw each line with slight offset
    const lines = [
      'THEY TAKE',
      'WHAT MAKES',
      'YOU  YOU',
      '',
      'THE CITY RUNS',
      'ON STOLEN',
      'DREAMS',
    ];
    lines.forEach((line, i) => {
      if (!line) return;
      const y = 8 + i * 8;
      // Multiple passes for shaky, overwritten look
      for (let pass = 0; pass < 2; pass++) {
        const ox = (Math.random() - 0.5) * 2;
        const oy = (Math.random() - 0.5) * 1;
        ctx.fillText(line, 64 + ox, y + oy);
      }
    });
    ctx.textAlign = 'left';

    // Dripping ink
    ctx.strokeStyle = 'rgba(20,18,16,0.4)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i < 4; i++) {
      const x = 30 + Math.random() * 68;
      ctx.beginPath();
      ctx.moveTo(x, 8 + Math.random() * 40);
      ctx.lineTo(x, 8 + Math.random() * 40 + 5 + Math.random() * 8);
      ctx.stroke();
    }
  });
}

/* ── Scene construction ─────────────────────────────────────────── */

export function buildStudio(): AreaWorld {
  const scene = new THREE.Scene();
  const updatables: Updatable[] = [];
  const signLights: THREE.PointLight[] = [];
  const viewPoint = new THREE.Vector3(0, 2.4, 16);

  scene.background = new THREE.Color('#06050a');
  scene.fog = new THREE.Fog('#0a0810', 12, 48);

  // ── Floor ──
  const floorMat = new THREE.MeshStandardMaterial({
    map: floorTexture(256, 256),
    roughness: 0.82,
    metalness: 0.05,
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 16), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, -2);
  floor.userData.noReflect = true;
  scene.add(floor);

  // ── Walls (3D volumes like the exterior) ──
  const wallMat = new THREE.MeshStandardMaterial({ map: wallTexture(256, 128), roughness: 0.9, metalness: 0 });
  const darkMat = new THREE.MeshStandardMaterial({ color: '#0a0808', roughness: 0.95 });

  // Back wall (z = -8)
  const backWall = new THREE.Mesh(new THREE.BoxGeometry(20, 7, 0.5), [darkMat, darkMat, darkMat, darkMat, wallMat, darkMat]);
  backWall.position.set(0, 3.5, -8.25);
  scene.add(backWall);

  // Left wall (x = -10)
  const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.5, 7, 16), [darkMat, wallMat, darkMat, darkMat, darkMat, darkMat]);
  leftWall.position.set(-10.25, 3.5, -2);
  scene.add(leftWall);

  // Right wall (x = 10) — with a door gap
  const rightWallTop = new THREE.Mesh(new THREE.BoxGeometry(0.5, 3, 8), [darkMat, wallMat, darkMat, darkMat, darkMat, darkMat]);
  rightWallTop.position.set(10.25, 5.5, -8);
  scene.add(rightWallTop);
  const rightWallBot = new THREE.Mesh(new THREE.BoxGeometry(0.5, 2, 16), [darkMat, wallMat, darkMat, darkMat, darkMat, darkMat]);
  rightWallBot.position.set(10.25, 1, -2);
  scene.add(rightWallBot);

  // ── The "Everybody/Nobody" painting on the back wall ──
  const paintingMat = new THREE.MeshBasicMaterial({
    map: everybodyNobodyTexture(),
    transparent: true,
  });
  const painting = new THREE.Mesh(new THREE.PlaneGeometry(5, 3.75), paintingMat);
  painting.position.set(0, 4, -7.95);
  scene.add(painting);
  // Painting frame — dark wood
  const frameMat = new THREE.MeshStandardMaterial({ color: '#2a1a10', roughness: 0.85 });
  const frameTop = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.15, 0.1), frameMat);
  frameTop.position.set(0, 5.95, -7.92);
  const frameBot = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.15, 0.1), frameMat);
  frameBot.position.set(0, 2.13, -7.92);
  const frameLeft = new THREE.Mesh(new THREE.BoxGeometry(0.15, 3.9, 0.1), frameMat);
  frameLeft.position.set(-2.7, 4, -7.92);
  const frameRight = new THREE.Mesh(new THREE.BoxGeometry(0.15, 3.9, 0.1), frameMat);
  frameRight.position.set(2.7, 4, -7.92);
  scene.add(frameTop, frameBot, frameLeft, frameRight);
  // Faint blue glow from the painting — the neural traces
  const paintingLight = new THREE.PointLight('#3060a0', 6, 10, 2);
  paintingLight.position.set(0, 4, -6);
  scene.add(paintingLight);
  signLights.push(paintingLight);

  // ── Easels with unfinished paintings ──
  const easelMat = new THREE.MeshStandardMaterial({ color: '#3a2a1a', roughness: 0.9 });
  function addEasel(x: number, z: number, variant: number) {
    const group = new THREE.Group();
    // Easel frame — tripod legs
    const leg1 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.5, 0.06), easelMat);
    leg1.position.set(-0.3, 1.25, 0.15);
    const leg2 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.5, 0.06), easelMat);
    leg2.position.set(0.3, 1.25, 0.15);
    const leg3 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.5, 0.06), easelMat);
    leg3.position.set(0, 1.25, -0.3);
    const crossbar = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.05, 0.05), easelMat);
    crossbar.position.set(0, 0.6, 0.1);
    group.add(leg1, leg2, leg3, crossbar);
    // Canvas on easel
    const canvasMat = new THREE.MeshBasicMaterial({
      map: unfinishedPainting(variant),
      transparent: true,
    });
    const canvasMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.5), canvasMat);
    canvasMesh.position.set(0, 1.5, 0.05);
    group.add(canvasMesh);
    // Canvas frame edge
    const edgeMat = new THREE.MeshStandardMaterial({ color: '#1a1410', roughness: 0.9 });
    const edge = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.05, 0.05), edgeMat);
    edge.position.set(0, 2.28, 0.06);
    group.add(edge);
    group.position.set(x, 0, z);
    scene.add(group);
  }
  addEasel(-3.5, -6, 0);
  addEasel(3.5, -6, 1);

  // ── Neural device on workbench ──
  const benchMat = new THREE.MeshStandardMaterial({ color: '#2a2018', roughness: 0.85 });
  const bench = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.8, 1), benchMat);
  bench.position.set(3, 0.4, -4);
  scene.add(bench);
  // Device sprite on the bench
  const deviceMat = new THREE.MeshBasicMaterial({
    map: deviceTexture(),
    transparent: true,
    alphaTest: 0.3,
  });
  const device = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1), deviceMat);
  device.position.set(3, 0.85, -4);
  scene.add(device);
  // Flickering work light above the bench — a hanging bare bulb
  const workLight = new THREE.PointLight('#ffcc66', 10, 10, 2);
  workLight.position.set(3, 2.8, -3.5);
  scene.add(workLight);
  signLights.push(workLight);
  // Bare bulb mesh
  const bulbMat = new THREE.MeshBasicMaterial({ color: '#ffdd88' });
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), bulbMat);
  bulb.position.set(3, 2.8, -3.5);
  scene.add(bulb);
  // Light fixture cord
  const cordMat = new THREE.MeshBasicMaterial({ color: '#0a0806' });
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 1.2), cordMat);
  cord.position.set(3, 3.9, -3.5);
  scene.add(cord);
  // Flicker controller
  class FlickerLight implements Updatable {
    private base = 10;
    private target = 1;
    private level = 1;
    update(dt: number) {
      if (Math.random() < dt * 2.5) {
        this.target = Math.random() < 0.1 ? 0.15 + Math.random() * 0.25 : 1;
      }
      this.level += (this.target - this.level) * Math.min(1, dt * 20);
      workLight.intensity = this.base * this.level;
      (bulbMat as THREE.MeshBasicMaterial).color.setRGB(
        1 * this.level,
        0.87 * this.level,
        0.53 * this.level,
      );
    }
  }
  updatables.push(new FlickerLight());

  // ── Body outline on the floor ──
  const outlineMat = new THREE.MeshBasicMaterial({
    map: bodyOutlineTexture(),
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const outline = new THREE.Mesh(new THREE.PlaneGeometry(4, 2), outlineMat);
  outline.rotation.x = -Math.PI / 2;
  outline.position.set(0, 0.02, -2);
  scene.add(outline);
  // Purple glow from the iridescent residue
  const residueLight = new THREE.PointLight('#6040a0', 3, 5, 2);
  residueLight.position.set(0, 0.5, -2);
  scene.add(residueLight);
  signLights.push(residueLight);

  // ── Workbench with journal ──
  const workbench = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.8, 1), benchMat);
  workbench.position.set(-4, 0.4, 0);
  scene.add(workbench);
  // Journal — open, lying flat
  const journalMat = new THREE.MeshBasicMaterial({ color: '#3a2a1a', transparent: true });
  const journal = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.4), journalMat);
  journal.rotation.x = -Math.PI / 2;
  journal.position.set(-4, 0.82, 0);
  scene.add(journal);
  // Journal pages — lighter
  const pageMat = new THREE.MeshBasicMaterial({ color: '#8a7a5a', transparent: true, opacity: 0.7 });
  const page = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.35), pageMat);
  page.rotation.x = -Math.PI / 2;
  page.position.set(-4, 0.83, 0);
  scene.add(page);
  // Paint tubes on the workbench
  for (let i = 0; i < 3; i++) {
    const tubeColors = ['#cc4433', '#4466cc', '#66aa44'];
    const tubeMat = new THREE.MeshStandardMaterial({ color: tubeColors[i], roughness: 0.6, metalness: 0.3 });
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.25, 6), tubeMat);
    tube.rotation.z = Math.PI / 2;
    tube.position.set(-3.5 + i * 0.3, 0.85, 0.2);
    scene.add(tube);
  }
  // Work light above the workbench — warm, dim
  const workbenchLight = new THREE.PointLight('#ffaa66', 4, 6, 2);
  workbenchLight.position.set(-4, 2.5, 0);
  scene.add(workbenchLight);
  signLights.push(workbenchLight);

  // ── Scattered canvases on the floor ──
  const canvasFloorMat = new THREE.MeshBasicMaterial({
    map: unfinishedPainting(0),
    transparent: true,
  });
  for (let i = 0; i < 5; i++) {
    const c = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1), canvasFloorMat);
    c.rotation.x = -Math.PI / 2;
    c.rotation.z = Math.random() * Math.PI;
    c.position.set(-1.5 + i * 0.7, 0.01, 0.5 + Math.random() * 0.3);
    scene.add(c);
  }

  // ── Wall writing (left wall) — actual text texture ──
  const writingMat = new THREE.MeshBasicMaterial({
    map: wallWritingTexture(),
    transparent: true,
    opacity: 0.85,
  });
  const writing = new THREE.Mesh(new THREE.PlaneGeometry(3, 1.5), writingMat);
  writing.position.set(-9.95, 3, -4);
  writing.rotation.y = Math.PI / 2;
  scene.add(writing);

  // ── Exit door (right wall gap) ──
  const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(0.1, 4, 2), darkMat);
  doorFrame.position.set(10.2, 2, 2);
  scene.add(doorFrame);
  // Door frame trim
  const trimMat = new THREE.MeshStandardMaterial({ color: '#2a2018', roughness: 0.85 });
  const trimTop = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.1, 2.1), trimMat);
  trimTop.position.set(10.2, 4, 2);
  scene.add(trimTop);
  // Light spilling from the hallway
  const doorLight = new THREE.PointLight('#ff9a4a', 4, 5, 2);
  doorLight.position.set(9, 2, 2);
  scene.add(doorLight);
  signLights.push(doorLight);

  // ── Ceiling ──
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(20, 16), darkMat);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(0, 7, -2);
  ceiling.userData.noReflect = true;
  scene.add(ceiling);
  // Ceiling beam — exposed, running across
  const beamMat = new THREE.MeshStandardMaterial({ color: '#1a1410', roughness: 0.9 });
  const beam = new THREE.Mesh(new THREE.BoxGeometry(20, 0.3, 0.3), beamMat);
  beam.position.set(0, 6.8, -2);
  scene.add(beam);

  // ── Exposed pipes on the ceiling ──
  const pipeMat = new THREE.MeshStandardMaterial({ color: '#2a2520', roughness: 0.7, metalness: 0.3 });
  const pipe1 = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 16, 6), pipeMat);
  pipe1.rotation.z = Math.PI / 2;
  pipe1.position.set(0, 6.5, -4);
  scene.add(pipe1);
  const pipe2 = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 16, 6), pipeMat);
  pipe2.rotation.z = Math.PI / 2;
  pipe2.position.set(0, 6.3, 0);
  scene.add(pipe2);
  // Pipe junction
  const junction = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.3, 8), pipeMat);
  junction.position.set(-5, 6.4, -2);
  scene.add(junction);

  // ── Lighting ──
  scene.add(new THREE.AmbientLight('#1a1a2e', 0.2));
  // Cool fill from the exit direction
  const fillLight = new THREE.DirectionalLight('#2a3a5a', 0.15);
  fillLight.position.set(5, 3, 3);
  scene.add(fillLight);

  return {
    id: 'studio',
    displayName: "MARLON GRAVES' STUDIO",
    scene,
    updatables,
    signLights,
    viewPoint,
    doors: STUDIO_DOORS,
    interactions: STUDIO_INTERACTIONS,
    exterior: false,
    ambient: { color: '#1a1a2e', intensity: 0.2 },
    bounds: { min: -8.5, max: 8.5 },
    cameraTarget: { y: 1.8, z: 0 },
  };
}