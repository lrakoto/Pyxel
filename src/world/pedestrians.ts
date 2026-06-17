import * as THREE from 'three';
import { TUNING } from '../tuning';
import { canvasTexture, spriteTexture } from './pixelTextures';
import type { Updatable } from './sector7';

/**
 * Background foot traffic for the sidewalk in front of the buildings. Each
 * pedestrian is a small lit silhouette that strolls along x and wraps around
 * when it leaves the scene, so the street never feels empty. They use
 * MeshStandardMaterial like Cole, so the neon point lights tint them as they
 * pass each sign — mostly reading as dark figures against the lit ground.
 */

// 10×16 *side-profile* walker, facing right (mirrored for left). Split into a
// static torso and two leg frames so the silhouette strides fore-and-aft like
// a person seen from the side. '.' is transparent; letters map through a palette.
const COAT_BODY = [
  '...HHH....',
  '..HHHH....',
  '..HHHf....',
  '..CCCC....',
  '..CCCCC...',
  '..CCCCCC..',
  '..CCCCC...',
  '..CCCCC...',
  '..CCCCC...',
  '..CCCCC...',
  '..CCCC....',
  '..CCCC....',
];

const HOOD_BODY = [
  '...kkk....',
  '..kkkk....',
  '..kkkf....',
  '..kkkk....',
  '..kkkkk...',
  '.kkkkkk...',
  '..kkkkkk..',
  '..kkkkk...',
  '..kkkkk...',
  '..kkkk....',
  '..kkkk....',
  '..kkkk....',
];

const LEGS_A = [
  '..P..P....',
  '.P...P....',
  '.P....P...',
  'BB....BB..',
];

const LEGS_B = [
  '..PP......',
  '..P.P.....',
  '..P.P.....',
  '.BB.BB....',
];

const COAT_TONES = ['#2a2f3a', '#33303a', '#2b3530', '#3a2e2e', '#26303c', '#34343a', '#2d2a32'];
const ACCENTS = ['#4a3550', '#3a4a55', '#534033']; // rarer, slightly brighter coats
const SKINS = ['#caa07c', '#9c7858', '#7a5a44', '#b98c66'];

function pickPalette(): { body: string[]; palette: Record<string, string> } {
  const hooded = Math.random() < 0.45;
  const coat = (Math.random() < 0.15 ? ACCENTS : COAT_TONES)[
    (Math.random() * (Math.random() < 0.15 ? ACCENTS : COAT_TONES).length) | 0
  ];
  const palette: Record<string, string> = {
    H: '#15191f',
    S: SKINS[(Math.random() * SKINS.length) | 0],
    C: coat,
    k: coat,
    f: '#4a3c32',
    P: '#1b1f25',
    B: '#0d0f13',
  };
  return { body: hooded ? HOOD_BODY : COAT_BODY, palette };
}

/** Shared soft contact shadow so the walkers don't read as floating. */
function shadowTexture(): THREE.CanvasTexture {
  const tex = canvasTexture(32, 32, (ctx) => {
    const g = ctx.createRadialGradient(16, 16, 1, 16, 16, 15);
    g.addColorStop(0, 'rgba(0,0,0,0.55)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 32, 32);
  });
  tex.colorSpace = THREE.NoColorSpace;
  return tex;
}

const SPRITE_W = 10;
const SPRITE_H = 16;
const X_BOUND = 30; // wrap point just past the visible street
const FRAME_TIME = 0.18;

class Pedestrian implements Updatable {
  readonly group = new THREE.Group();
  private readonly mesh: THREE.Mesh;
  private readonly frames: THREE.Texture[];
  private readonly material: THREE.MeshStandardMaterial;
  private dir: number;
  private speed: number;
  private frame = 0;
  private animTimer = 0;
  private bobPhase = Math.random() * Math.PI * 2;
  private readonly baseY: number;

  constructor(shadowTex: THREE.CanvasTexture) {
    const { body, palette } = pickPalette();
    this.frames = [LEGS_A, LEGS_B].map((legs) => spriteTexture([...body, ...legs], palette));
    this.material = new THREE.MeshStandardMaterial({
      map: this.frames[0],
      transparent: true,
      alphaTest: 0.5,
      roughness: 0.95,
      metalness: 0,
      side: THREE.DoubleSide,
    });

    const height = 1.45 + Math.random() * 0.25;
    const width = height * (SPRITE_W / SPRITE_H);
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), this.material);
    this.baseY = height / 2;
    this.mesh.position.y = this.baseY;

    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(width * 1.1, width * 0.5),
      new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.02;
    this.group.add(this.mesh, shadow);

    this.dir = Math.random() < 0.5 ? 1 : -1;
    this.speed = TUNING.pedSpeedMin + Math.random() * Math.max(0, TUNING.pedSpeedMax - TUNING.pedSpeedMin);
    this.group.position.set(
      -X_BOUND + Math.random() * (X_BOUND * 2),
      0,
      -6.4 - Math.random() * 1.5, // sidewalk band, in front of the facades
    );
    this.mesh.scale.x = this.dir;
  }

  update(dt: number) {
    this.group.position.x += this.dir * this.speed * dt;
    if (this.group.position.x > X_BOUND) this.group.position.x = -X_BOUND;
    else if (this.group.position.x < -X_BOUND) this.group.position.x = X_BOUND;

    // Animation cadence scales with speed so faster walkers step quicker.
    this.animTimer += dt * this.speed;
    if (this.animTimer > FRAME_TIME) {
      this.animTimer -= FRAME_TIME;
      this.frame ^= 1;
      this.material.map = this.frames[this.frame];
    }
    // Faint walk bob.
    this.bobPhase += dt * this.speed * 9;
    this.mesh.position.y = this.baseY + Math.abs(Math.sin(this.bobPhase)) * 0.03;
  }

  dispose() {
    this.group.removeFromParent();
    for (const tex of this.frames) tex.dispose();
    this.material.dispose();
    this.mesh.geometry.dispose();
  }
}

/**
 * Manages the sidewalk crowd as a single updatable so the tuning panel can
 * resize it live without touching the scene's updatable list.
 */
export class PedestrianField implements Updatable {
  private readonly peds: Pedestrian[] = [];
  private readonly shadowTex = shadowTexture();

  constructor(private readonly scene: THREE.Scene, count: number) {
    this.setCount(count);
  }

  setCount(n: number) {
    const target = Math.max(0, Math.round(n));
    while (this.peds.length < target) {
      const ped = new Pedestrian(this.shadowTex);
      this.scene.add(ped.group);
      this.peds.push(ped);
    }
    while (this.peds.length > target) {
      this.peds.pop()!.dispose();
    }
  }

  update(dt: number) {
    for (const ped of this.peds) ped.update(dt);
  }
}

/** Populates the sidewalk with the configured number of walkers. */
export function buildPedestrians(scene: THREE.Scene, count = TUNING.pedestrianCount): PedestrianField {
  return new PedestrianField(scene, count);
}
