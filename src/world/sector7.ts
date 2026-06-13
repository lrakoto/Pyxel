import * as THREE from 'three';
import {
  facadeTexture,
  midBuildingTexture,
  midCityTexture,
  neonSignTexture,
  sideWallTexture,
  skyTexture,
  streetTexture,
} from './pixelTextures';
import { loadPlateTexture } from './plateTexture';
import { buildForeground } from './foreground';
import { buildNearground } from './nearground';
import { buildStreetProps, Sparkles } from './props';

export interface Updatable {
  update(dt: number): void;
}

interface SignSpec {
  text: string;
  color: string;
  x: number;
  y: number;
  w: number;
}

const SIGNS: SignSpec[] = [
  { text: 'NO/BODY', color: '#b14dff', x: -15.5, y: 3.0, w: 3.6 },
  { text: 'SECTOR 7', color: '#36e0ff', x: -9.5, y: 4.3, w: 4.6 },
  { text: 'MEMORY DEN', color: '#ff3da0', x: 2.5, y: 3.5, w: 5.2 },
  { text: 'ヌードル', color: '#ffb03a', x: 10, y: 4.6, w: 3.4 },
];

/** A neon sign plane plus a matching point light, with occasional flicker. */
class NeonSign implements Updatable {
  readonly group = new THREE.Group();
  readonly light: THREE.PointLight;
  private readonly material: THREE.MeshBasicMaterial;
  private readonly baseIntensity = 26;
  private target = 1;
  private level = 1;

  constructor(spec: SignSpec) {
    this.material = new THREE.MeshBasicMaterial({
      map: neonSignTexture(spec.text, spec.color),
      transparent: true,
    });
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(spec.w, spec.w * (80 / 256)),
      this.material,
    );
    mesh.position.set(spec.x, spec.y, -8.2);
    this.light = new THREE.PointLight(spec.color, this.baseIntensity, 16, 2);
    this.light.position.set(spec.x, spec.y - 0.8, -5.6);
    this.group.add(mesh, this.light);
  }

  update(dt: number) {
    if (Math.random() < dt * 1.2) {
      this.target = Math.random() < 0.18 ? 0.15 + Math.random() * 0.3 : 1;
    }
    this.level += (this.target - this.level) * Math.min(1, dt * 18);
    this.light.intensity = this.baseIntensity * this.level;
    this.material.opacity = 0.55 + 0.45 * this.level;
  }
}

/**
 * Street-facing row as real volumes: textured front face plus dark 3D sides
 * that show themselves in perspective as the camera tracks, with water
 * tanks, ducts, and masts cluttering the visible rooflines.
 * Returns sill points for the window-ledge sparkles.
 */
function addBuildingRow(scene: THREE.Scene): THREE.Vector3[] {
  const sillPoints: THREE.Vector3[] = [];
  const sideMat = new THREE.MeshBasicMaterial({ map: sideWallTexture() });
  const topMat = new THREE.MeshBasicMaterial({ color: '#0a0d12' });
  const darkMat = new THREE.MeshBasicMaterial({ color: '#0c0f15' });
  const DEPTH = 3.5;
  // Loosely aligned with the SIGNS x positions so signs hang on buildings.
  const xs = [-45, -36, -27.5, -18, -9.5, 1.5, 8, 16.5, 25, 34, 43];
  xs.forEach((x, i) => {
    const w = 6 + ((i * 7) % 5) * 0.6;
    const h = 9 + ((i * 5) % 7);
    const frontMat = new THREE.MeshBasicMaterial({
      map: facadeTexture(Math.round(w * 13), Math.round(h * 13)),
    });
    frontMat.color.setScalar(0.82 + ((i * 3) % 4) * 0.05);
    const frontZ = -8.6 - (i % 3) * 0.5;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, DEPTH),
      [sideMat, sideMat, topMat, darkMat, frontMat, darkMat],
    );
    mesh.position.set(x, h / 2, frontZ - DEPTH / 2);
    scene.add(mesh);

    // roof clutter where the roofline is actually visible
    if (h <= 12) {
      const tank = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.2, 1.1), darkMat);
      tank.position.set(x - w / 4, h + 0.6, frontZ - 1.5);
      scene.add(tank);
      const duct = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 0.9), topMat);
      duct.position.set(x + w / 4, h + 0.25, frontZ - 1.2);
      scene.add(duct);
      if (i % 2 === 0) {
        const mast = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.4, 0.12), darkMat);
        mast.position.set(x + w / 3, h + 1.2, frontZ - 1);
        scene.add(mast);
      }
    }

    for (let s = 0; s < 2; s++) {
      sillPoints.push(
        new THREE.Vector3(x - w / 4 + (Math.random() * w) / 2, 1.5 + Math.random() * (h - 3), frontZ + 0.03),
      );
    }
  });
  return sillPoints;
}

/** Slow red blink on a rooftop mast. */
class Beacon implements Updatable {
  readonly mesh: THREE.Mesh;
  private readonly mat: THREE.MeshBasicMaterial;
  private t = Math.random() * 10;

  constructor(pos: THREE.Vector3) {
    this.mat = new THREE.MeshBasicMaterial({ color: '#ff4455', transparent: true });
    this.mesh = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.22), this.mat);
    this.mesh.position.copy(pos);
  }

  update(dt: number) {
    this.t += dt;
    this.mat.opacity = 0.15 + 0.85 * Math.max(0, Math.sin(this.t * 1.6)) ** 4;
  }
}

/**
 * Mid-distance row as individual 3D masses, sunk below the horizon so they
 * read as grounded city blocks behind the street rather than floating.
 */
function addMidRow(scene: THREE.Scene): Updatable[] {
  const updatables: Updatable[] = [];
  const sideMat = new THREE.MeshBasicMaterial({ color: '#0a0d13' });
  const DEPTH = 5;
  for (let i = 0; i < 12; i++) {
    const x = -50 + i * 9 + (Math.random() - 0.5) * 3;
    const w = 8 + Math.random() * 6;
    const h = 8 + Math.random() * 9;
    const frontMat = new THREE.MeshBasicMaterial({
      map: midBuildingTexture(Math.round(w * 6), Math.round(h * 6)),
    });
    const z = -24 - (i % 3) * 2.2;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, DEPTH),
      [sideMat, sideMat, sideMat, sideMat, frontMat, sideMat],
    );
    mesh.position.set(x, h / 2 - 2, z - DEPTH / 2);
    scene.add(mesh);

    if (i % 4 === 1) {
      const mast = new THREE.Mesh(new THREE.BoxGeometry(0.25, 3.5, 0.25), sideMat);
      mast.position.set(x + w / 4, h - 2 + 1.75, z - 2);
      scene.add(mast);
      const beacon = new Beacon(new THREE.Vector3(x + w / 4, h - 2 + 3.6, z - 2));
      scene.add(beacon.mesh);
      updatables.push(beacon);
    }
  }
  return updatables;
}

export interface Sector7World {
  scene: THREE.Scene;
  updatables: Updatable[];
  signLights: THREE.PointLight[];
  /** Camera world position, copied in by the game loop each frame — the
   *  specular sparkles need it to aim their reflections. */
  viewPoint: THREE.Vector3;
}

export function buildSector7(): Sector7World {
  const scene = new THREE.Scene();
  const updatables: Updatable[] = [];
  const signLights: THREE.PointLight[] = [];
  const viewPoint = new THREE.Vector3(0, 2.4, 16);

  scene.background = new THREE.Color('#04050b');
  scene.fog = new THREE.Fog('#0a0d18', 10, 72);

  const skyMaterial = new THREE.MeshBasicMaterial({ map: skyTexture(), fog: false });
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(240, 120), skyMaterial);
  sky.position.set(0, 20, -78);
  scene.add(sky);

  // Swap in the Midjourney skyline plate (pixelation pass applied) when it
  // loads; the procedural sky stays as the fallback.
  loadPlateTexture('/env/skyline.png', { width: 1280, posterize: 15, brightness: 0.9 })
    .then((tex) => {
      const plate = tex.image as HTMLCanvasElement;
      const height = 240 * (plate.height / plate.width);
      sky.geometry.dispose();
      sky.geometry = new THREE.PlaneGeometry(240, height);
      // Sink the plate's street level below our horizon so the 3D street
      // and building rows read as the foreground of the painted city.
      sky.position.y = height / 2 - 14;
      skyMaterial.map = tex;
      skyMaterial.needsUpdate = true;
    })
    .catch((err) => console.warn('skyline plate unavailable, keeping procedural sky', err));

  // Low roughness + a touch of metalness makes the neon point lights pool on
  // the asphalt like a wet street.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(130, 28),
    new THREE.MeshStandardMaterial({ map: streetTexture(), roughness: 0.3, metalness: 0.2 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, -4);
  // The ground would block the mirrored view from below.
  ground.userData.noReflect = true;
  scene.add(ground);

  // 3D mid-distance city blocks, then a flat silhouette strip further back
  // (sunk below the horizon so neither reads as floating).
  updatables.push(...addMidRow(scene));
  const farWidth = 190;
  const farHeight = farWidth * (160 / 1024);
  const farStrip = new THREE.Mesh(
    new THREE.PlaneGeometry(farWidth, farHeight),
    new THREE.MeshBasicMaterial({ map: midCityTexture(), transparent: true }),
  );
  farStrip.position.set(0, farHeight / 2 - 4, -38);
  scene.add(farStrip);

  // Street-facing row: procedural facades (storefronts, lit windows, pipes)
  // on 3D volumes. Sill sparkle points are wired up after all lights exist.
  const sillPoints = addBuildingRow(scene);

  for (const spec of SIGNS) {
    const sign = new NeonSign(spec);
    scene.add(sign.group);
    updatables.push(sign);
    signLights.push(sign.light);
  }

  updatables.push(...buildForeground(scene));
  buildNearground(scene);

  const street = buildStreetProps(scene);
  updatables.push(...street.updatables);
  // Vending screens tint Cole's wet rim just like the signs do.
  signLights.push(...street.lights);

  // Warm storefront spill raking across the walkway — the orange key light
  // from the reference frame.
  const spill = new THREE.PointLight('#ff9a4a', 20, 15, 2);
  spill.position.set(-4.5, 2, -5);
  scene.add(spill);
  signLights.push(spill);

  // Light-driven sparkles, created last so they sample every light in the
  // scene (signs, vending screens, spill). Brightness and hue come from
  // whatever neon actually reaches each fleck.
  const asphaltPts: THREE.Vector3[] = [];
  for (let i = 0; i < 36; i++) {
    asphaltPts.push(new THREE.Vector3(-18 + Math.random() * 36, 0.06, -4 + Math.random() * 10));
  }
  const curbPts: THREE.Vector3[] = [];
  for (let i = 0; i < 16; i++) {
    curbPts.push(new THREE.Vector3(-20 + Math.random() * 40, 0.12, -5.3));
  }
  const sparkleSets = [
    new Sparkles(asphaltPts, signLights, viewPoint),
    new Sparkles(curbPts, signLights, viewPoint, {
      normal: new THREE.Vector3(0, 0.55, 0.84),
      size: 0.06,
    }),
    new Sparkles(sillPoints, signLights, viewPoint, {
      normal: new THREE.Vector3(0, 0, 1),
      size: 0.06,
      maxOpacity: 0.55,
      lightScale: 0.45,
    }),
    new Sparkles(street.propTops, signLights, viewPoint, { size: 0.06, maxOpacity: 0.7 }),
  ];
  for (const s of sparkleSets) {
    scene.add(s.group);
    updatables.push(s);
  }

  scene.add(new THREE.AmbientLight('#2a3a5e', 0.8));
  const moon = new THREE.DirectionalLight('#42598a', 0.5);
  moon.position.set(4, 10, 6);
  scene.add(moon);

  return { scene, updatables, signLights, viewPoint };
}
