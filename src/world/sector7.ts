import * as THREE from 'three';
import { buildingTexture, groundTexture, midCityTexture, neonSignTexture, skyTexture } from './pixelTextures';
import { loadPlateTexture } from './plateTexture';

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

function addBuildingRow(
  scene: THREE.Scene,
  z: number,
  count: number,
  hMin: number,
  hMax: number,
  dim: number,
) {
  const span = 110;
  for (let i = 0; i < count; i++) {
    const w = 5 + Math.random() * 3.5;
    const h = hMin + Math.random() * (hMax - hMin);
    const x = -span / 2 + (i + 0.5) * (span / count) + (Math.random() - 0.5) * 3;
    const material = new THREE.MeshBasicMaterial({
      map: buildingTexture(Math.round(w * 1.6), Math.round(h * 1.6)),
    });
    material.color.setScalar(dim);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
    mesh.position.set(x, h / 2, z);
    scene.add(mesh);
  }
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
    new THREE.MeshStandardMaterial({ map: groundTexture(), roughness: 0.3, metalness: 0.2 }),
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

  // The far skyline is the painted plate; one sparser 3D row in the
  // mid-ground carries the signs and gives walking parallax against it.
  addBuildingRow(scene, -8.6, 6, 6, 11, 0.85);

  for (const spec of SIGNS) {
    const sign = new NeonSign(spec);
    scene.add(sign.group);
    updatables.push(sign);
    signLights.push(sign.light);
  }

  // Foreground pillars: strong near-layer parallax when walking past.
  for (const px of [-12, -2.5, 7, 15]) {
    const pillar = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 9, 0.5),
      new THREE.MeshStandardMaterial({ color: '#0b0d12', roughness: 0.8 }),
    );
    pillar.position.set(px, 4.5, 3.2);
    scene.add(pillar);
  }

  scene.add(new THREE.AmbientLight('#2a3a5e', 0.8));
  const moon = new THREE.DirectionalLight('#42598a', 0.5);
  moon.position.set(4, 10, 6);
  scene.add(moon);

  return { scene, updatables, signLights };
}
