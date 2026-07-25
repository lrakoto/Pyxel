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

/** Cracked concrete wall, interior style. */
function wallTexture(wPx: number, hPx: number): THREE.CanvasTexture {
  return canvasTexture(wPx, hPx, (ctx) => {
    // Base
    ctx.fillStyle = '#2a2522';
    ctx.fillRect(0, 0, wPx, hPx);
    // Noise
    for (let i = 0; i < wPx * hPx * 0.08; i++) {
      const v = Math.random();
      ctx.fillStyle = v < 0.5
        ? `rgba(20,18,16,${0.2 + Math.random() * 0.3})`
        : `rgba(50,45,40,${0.15 + Math.random() * 0.2})`;
      ctx.fillRect(Math.random() * wPx, Math.random() * hPx, 1.5, 1.5);
    }
    // Cracks
    ctx.strokeStyle = 'rgba(15,13,12,0.5)';
    ctx.lineWidth = 0.8;
    for (let i = 0; i < 8; i++) {
      ctx.beginPath();
      let x = Math.random() * wPx;
      let y = Math.random() * hPx;
      ctx.moveTo(x, y);
      for (let s = 0; s < 12; s++) {
        x += (Math.random() - 0.5) * 30;
        y += (Math.random() - 0.5) * 30;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    // Water stains
    for (let i = 0; i < 5; i++) {
      const x = Math.random() * wPx;
      const y = Math.random() * hPx;
      const r = 10 + Math.random() * 30;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(30,25,20,0.3)');
      g.addColorStop(1, 'rgba(30,25,20,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
  });
}

/** Cracked tile floor. */
function floorTexture(wPx: number, hPx: number): THREE.CanvasTexture {
  return canvasTexture(wPx, hPx, (ctx) => {
    ctx.fillStyle = '#1e1a18';
    ctx.fillRect(0, 0, wPx, hPx);
    // Tile grid
    const tileW = 32;
    const tileH = 32;
    for (let ty = 0; ty < hPx; ty += tileH) {
      for (let tx = 0; tx < wPx; tx += tileW) {
        const shade = 25 + Math.floor(Math.random() * 10);
        ctx.fillStyle = `rgb(${shade},${shade - 3},${shade - 5})`;
        ctx.fillRect(tx, ty, tileW - 1, tileH - 1);
        // Grime
        if (Math.random() < 0.3) {
          ctx.fillStyle = `rgba(15,12,10,${0.2 + Math.random() * 0.2})`;
          ctx.fillRect(tx + Math.random() * tileW, ty + Math.random() * tileH, 4, 4);
        }
      }
    }
    // Cracks
    ctx.strokeStyle = 'rgba(10,8,7,0.6)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      let x = Math.random() * wPx;
      let y = Math.random() * hPx;
      ctx.moveTo(x, y);
      for (let s = 0; s < 8; s++) {
        x += (Math.random() - 0.5) * 40;
        y += (Math.random() - 0.5) * 40;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  });
}

/** The "Everybody/Nobody" painting: fractured, fragmented faces. */
function everybodyNobodyTexture(): THREE.CanvasTexture {
  return canvasTexture(128, 96, (ctx) => {
    // Dark background
    ctx.fillStyle = '#0a0a12';
    ctx.fillRect(0, 0, 128, 96);
    // Fractured face fragments — rough, urgent strokes
    const fragments = 25;
    for (let i = 0; i < fragments; i++) {
      const x = Math.random() * 128;
      const y = Math.random() * 96;
      const w = 8 + Math.random() * 20;
      const h = 8 + Math.random() * 20;
      // Random "skin" / fragment tones, desaturated
      const hue = Math.random();
      let color: string;
      if (hue < 0.3) color = `rgba(${120 + Math.random() * 40},${100 + Math.random() * 30},${90 + Math.random() * 30},${0.3 + Math.random() * 0.4})`;
      else if (hue < 0.6) color = `rgba(${80 + Math.random() * 30},${70 + Math.random() * 30},${100 + Math.random() * 40},${0.2 + Math.random() * 0.3})`;
      else color = `rgba(${60 + Math.random() * 30},${60 + Math.random() * 30},${60 + Math.random() * 30},${0.2 + Math.random() * 0.3})`;
      ctx.fillStyle = color;
      // Irregular fragment shape
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + w, y + Math.random() * h);
      ctx.lineTo(x + w * 0.7, y + h);
      ctx.lineTo(x - w * 0.2, y + h * 0.8);
      ctx.closePath();
      ctx.fill();
    }
    // Glowing neural traces — thin lines connecting fragments
    ctx.strokeStyle = 'rgba(100,180,255,0.15)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i < 15; i++) {
      ctx.beginPath();
      ctx.moveTo(Math.random() * 128, Math.random() * 96);
      ctx.lineTo(Math.random() * 128, Math.random() * 96);
      ctx.stroke();
    }
    // Title scratched in
    ctx.fillStyle = 'rgba(200,200,210,0.4)';
    ctx.font = '6px monospace';
    ctx.fillText('EVERYBODY/NOBODY', 30, 90);
  });
}

/** An unfinished painting on an easel. */
function unfinishedPainting(variant: number): THREE.CanvasTexture {
  return canvasTexture(64, 80, (ctx) => {
    // Canvas base
    ctx.fillStyle = '#1a1816';
    ctx.fillRect(0, 0, 64, 80);
    // Rough strokes
    for (let i = 0; i < 20; i++) {
      const x = Math.random() * 64;
      const y = Math.random() * 80;
      const w = 5 + Math.random() * 15;
      const h = 5 + Math.random() * 15;
      if (variant === 0) {
        // Face dissolving into light
        ctx.fillStyle = `rgba(${100 + Math.random() * 60},${80 + Math.random() * 40},${90 + Math.random() * 50},${0.3 + Math.random() * 0.3})`;
      } else {
        // Cityscape of faces
        ctx.fillStyle = `rgba(${50 + Math.random() * 30},${50 + Math.random() * 30},${60 + Math.random() * 40},${0.3 + Math.random() * 0.3})`;
      }
      ctx.fillRect(x, y, w, h);
    }
    // Incomplete sections — raw canvas
    if (variant === 0) {
      ctx.fillStyle = '#1a1816';
      ctx.fillRect(0, 50, 64, 30);
    } else {
      ctx.fillStyle = '#1a1816';
      ctx.fillRect(40, 0, 24, 80);
    }
  });
}

/** The neural interface device: a tangled mess of tech on a workbench. */
function deviceTexture(): THREE.CanvasTexture {
  return canvasTexture(32, 20, (ctx) => {
    // Base
    ctx.fillStyle = '#0d0f14';
    ctx.fillRect(0, 0, 32, 20);
    // Device body
    ctx.fillStyle = '#1a1e28';
    ctx.fillRect(4, 6, 24, 10);
    // Screen
    ctx.fillStyle = '#0a3a5a';
    ctx.fillRect(6, 8, 10, 6);
    // Drive light (pulsing green)
    ctx.fillStyle = '#2aff8a';
    ctx.fillRect(18, 10, 2, 2);
    // Cables
    ctx.strokeStyle = '#2a2e38';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(28, 10);
    ctx.bezierCurveTo(30, 10, 31, 5, 30, 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(4, 12);
    ctx.bezierCurveTo(2, 12, 1, 16, 2, 19);
    ctx.stroke();
  });
}

/** Chalk body outline on the floor — additive faint glow. */
function bodyOutlineTexture(): THREE.CanvasTexture {
  const tex = canvasTexture(128, 64, (ctx) => {
    ctx.clearRect(0, 0, 128, 64);
    // Chalk outline — rough, hand-drawn
    ctx.strokeStyle = 'rgba(220,220,230,0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    // Head
    ctx.arc(64, 12, 8, 0, Math.PI * 2);
    ctx.stroke();
    // Shoulders to arms
    ctx.moveTo(52, 22);
    ctx.lineTo(42, 40);
    ctx.moveTo(76, 22);
    ctx.lineTo(86, 40);
    // Torso
    ctx.moveTo(54, 22);
    ctx.lineTo(56, 50);
    ctx.moveTo(74, 22);
    ctx.lineTo(72, 50);
    // Legs
    ctx.moveTo(56, 50);
    ctx.lineTo(58, 62);
    ctx.moveTo(72, 50);
    ctx.lineTo(70, 62);
    ctx.stroke();
    // Iridescent residue overlay
    const g = ctx.createRadialGradient(64, 35, 5, 64, 35, 30);
    g.addColorStop(0, 'rgba(80,60,120,0.15)');
    g.addColorStop(1, 'rgba(80,60,120,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 64);
  });
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  return tex;
}

/* ── Scene construction ─────────────────────────────────────────── */

export function buildStudio(): AreaWorld {
  const scene = new THREE.Scene();
  const updatables: Updatable[] = [];
  const signLights: THREE.PointLight[] = [];
  const viewPoint = new THREE.Vector3(0, 2.4, 16);

  scene.background = new THREE.Color('#06050a');
  scene.fog = new THREE.Fog('#0a0810', 8, 40);

  // ── Floor ──
  const floorMat = new THREE.MeshStandardMaterial({
    map: floorTexture(256, 256),
    roughness: 0.85,
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
  // Faint glow on the painting
  const paintingLight = new THREE.PointLight('#3060a0', 5, 8, 2);
  paintingLight.position.set(0, 4, -6);
  scene.add(paintingLight);
  signLights.push(paintingLight);

  // ── Easels with unfinished paintings ──
  function addEasel(x: number, z: number, variant: number) {
    const group = new THREE.Group();
    // Easel frame
    const easelMat = new THREE.MeshStandardMaterial({ color: '#3a2a1a', roughness: 0.9 });
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
  const device = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.625), deviceMat);
  device.position.set(3, 0.85, -4);
  scene.add(device);
  // Flickering work light above the bench
  const workLight = new THREE.PointLight('#ffcc66', 8, 8, 2);
  workLight.position.set(3, 2.5, -3.5);
  scene.add(workLight);
  signLights.push(workLight);
  // Flicker controller
  class FlickerLight implements Updatable {
    private base = 8;
    private target = 1;
    private level = 1;
    update(dt: number) {
      if (Math.random() < dt * 2) {
        this.target = Math.random() < 0.12 ? 0.2 + Math.random() * 0.3 : 1;
      }
      this.level += (this.target - this.level) * Math.min(1, dt * 20);
      workLight.intensity = this.base * this.level;
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
  // Faint purple glow from the residue
  const residueLight = new THREE.PointLight('#6040a0', 2, 4, 2);
  residueLight.position.set(0, 0.5, -2);
  scene.add(residueLight);
  signLights.push(residueLight);

  // ── Workbench with journal ──
  const workbench = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.8, 1), benchMat);
  workbench.position.set(-4, 0.4, 0);
  scene.add(workbench);
  // Journal (flat sprite on the bench)
  const journalMat = new THREE.MeshBasicMaterial({ color: '#4a3a2a', transparent: true });
  const journal = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.35), journalMat);
  journal.rotation.x = -Math.PI / 2;
  journal.position.set(-4, 0.82, 0);
  scene.add(journal);

  // ── Scattered canvases on the floor ──
  const canvasFloorMat = new THREE.MeshBasicMaterial({
    map: unfinishedPainting(0),
    transparent: true,
  });
  for (let i = 0; i < 4; i++) {
    const c = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1), canvasFloorMat);
    c.rotation.x = -Math.PI / 2;
    c.rotation.z = Math.random() * Math.PI;
    c.position.set(-1 + i * 0.7, 0.01, 0.5 + Math.random() * 0.3);
    scene.add(c);
  }

  // ── Wall writing (left wall) ──
  const writingMat = new THREE.MeshBasicMaterial({
    color: '#1a1a1a',
    transparent: true,
    opacity: 0.8,
  });
  const writing = new THREE.Mesh(new THREE.PlaneGeometry(3, 2), writingMat);
  writing.position.set(-9.95, 3, -4);
  writing.rotation.y = Math.PI / 2;
  scene.add(writing);

  // ── Exit door (right wall gap) ──
  const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(0.1, 4, 2), darkMat);
  doorFrame.position.set(10.2, 2, 2);
  scene.add(doorFrame);
  const doorLight = new THREE.PointLight('#ff9a4a', 3, 4, 2);
  doorLight.position.set(9, 2, 2);
  scene.add(doorLight);
  signLights.push(doorLight);

  // ── Ceiling (dark) ──
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(20, 16), darkMat);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(0, 7, -2);
  ceiling.userData.noReflect = true;
  scene.add(ceiling);

  // ── Lighting ──
  scene.add(new THREE.AmbientLight('#1a1a2e', 0.2));

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