import * as THREE from 'three';
import { facadeTexture, midCityTexture, neonSignTexture, skyTexture, streetTexture } from './pixelTextures';
import { loadPlateTexture } from './plateTexture';
import { buildForeground } from './foreground';
import { buildStreetProps } from './props';

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

function addBuildingRow(scene: THREE.Scene) {
  // Loosely aligned with the SIGNS x positions so signs hang on buildings.
  const xs = [-45, -36, -27.5, -18, -9.5, 1.5, 8, 16.5, 25, 34, 43];
  xs.forEach((x, i) => {
    const w = 6 + ((i * 7) % 5) * 0.6;
    const h = 9 + ((i * 5) % 7);
    const material = new THREE.MeshBasicMaterial({
      map: facadeTexture(Math.round(w * 13), Math.round(h * 13)),
    });
    material.color.setScalar(0.82 + ((i * 3) % 4) * 0.05);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
    // Slight depth stagger keeps the roofline from reading as one flat wall.
    mesh.position.set(x, h / 2, -8.6 - (i % 3) * 0.5);
    scene.add(mesh);
  });
}

export interface Sector7World {
  scene: THREE.Scene;
  updatables: Updatable[];
  signLights: THREE.PointLight[];
}

export function buildSector7(): Sector7World {
  const scene = new THREE.Scene();
  const updatables: Updatable[] = [];
  const signLights: THREE.PointLight[] = [];

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
  scene.add(ground);

  // Mid-distance silhouette strip between the street and the painted
  // skyline; scene fog hazes it about halfway for depth.
  const midWidth = 170;
  const midHeight = midWidth * (160 / 1024);
  const midLayer = new THREE.Mesh(
    new THREE.PlaneGeometry(midWidth, midHeight),
    new THREE.MeshBasicMaterial({ map: midCityTexture(), transparent: true }),
  );
  midLayer.position.set(0, midHeight / 2, -30);
  scene.add(midLayer);

  // Street-facing row: procedural facades (storefronts, lit windows, pipes).
  addBuildingRow(scene);

  for (const spec of SIGNS) {
    const sign = new NeonSign(spec);
    scene.add(sign.group);
    updatables.push(sign);
    signLights.push(sign.light);
  }

  updatables.push(...buildForeground(scene));

  const street = buildStreetProps(scene);
  updatables.push(...street.updatables);
  // Vending screens tint Cole's wet rim just like the signs do.
  signLights.push(...street.lights);

  scene.add(new THREE.AmbientLight('#2a3a5e', 0.8));
  const moon = new THREE.DirectionalLight('#42598a', 0.5);
  moon.position.set(4, 10, 6);
  scene.add(moon);

  return { scene, updatables, signLights };
}
