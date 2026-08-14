import * as THREE from 'three';
import { TUNING } from '../tuning';
import { canvasTexture } from './pixelTextures';
import type { Updatable } from './sector7';
import { loadSheet, hasSheet } from '../sprites/SpriteLibrary';
import { SpriteAnimator } from '../sprites/SpriteAnimator';
import { PED_W, PED_H, makePedFrames } from './sprites';

/** Small half-circle umbrella texture for a subset of pedestrians. */
function umbrellaTexture(): THREE.CanvasTexture {
  return canvasTexture(20, 10, (ctx) => {
    ctx.fillStyle = Math.random() < 0.5 ? '#1c222e' : '#2a1f22';
    ctx.beginPath();
    ctx.ellipse(10, 10, 10, 5, 0, Math.PI, 0);
    ctx.fill();
  });
}

/**
 * Background foot traffic for the sidewalk in front of the buildings. Each
 * pedestrian is a small lit silhouette that strolls along x and wraps around
 * when it leaves the scene, so the street never feels empty. They use
 * MeshStandardMaterial like Cole, so the neon point lights tint them as they
 * pass each sign — mostly reading as dark figures against the lit ground.
 *
 * Frames come from makePedFrames in sprites.ts (coat or hood cut, 4-phase
 * walk); a compiled Aseprite sheet swaps in at runtime when present.
 */

const COAT_TONES = ['#2a2f3a', '#33303a', '#2b3530', '#3a2e2e', '#26303c', '#34343a', '#2d2a32'];
const ACCENTS = ['#4a3550', '#3a4a55', '#534033']; // rarer, slightly brighter coats

function pickCoat(): string {
  const pool = Math.random() < 0.15 ? ACCENTS : COAT_TONES;
  return pool[(Math.random() * pool.length) | 0];
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

  private readonly hasUmbrella: boolean;
  private animator: SpriteAnimator | null = null;

  constructor(shadowTex: THREE.CanvasTexture, umbrellaTex: THREE.CanvasTexture) {
    this.hasUmbrella = Math.random() < 0.3;
    const kind = Math.random() < 0.45 ? 'hood' : 'coat';
    this.frames = makePedFrames(kind, pickCoat());
    this.material = new THREE.MeshStandardMaterial({
      map: this.frames[0],
      transparent: true,
      alphaTest: 0.5,
      roughness: 0.95,
      metalness: 0,
      side: THREE.DoubleSide,
    });

    const height = 1.45 + Math.random() * 0.25;
    const width = height * (PED_W / PED_H);
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

    if (this.hasUmbrella) {
      const ulla = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 0.25), new THREE.MeshBasicMaterial({
        map: umbrellaTex,
        transparent: true,
        depthWrite: false,
      }));
      ulla.position.set(0, height * 0.75, 0);
      this.group.add(ulla);
    }

    this.dir = Math.random() < 0.5 ? 1 : -1;
    this.speed = TUNING.pedSpeedMin + Math.random() * Math.max(0, TUNING.pedSpeedMax - TUNING.pedSpeedMin);
    this.group.position.set(
      -X_BOUND + Math.random() * (X_BOUND * 2),
      0,
      -6.4 - Math.random() * 1.5, // sidewalk band, in front of the facades
    );
    this.mesh.scale.x = this.dir;

    // Upgrade from the two-frame pixel map to a compiled Aseprite walk tag
    // when the art pipeline has produced one.
    this.tryUpgradeArt(height);
  }

  private async tryUpgradeArt(height: number) {
    const id = Math.random() < 0.5 ? 'ped_a' : 'ped_b';
    if (!(await hasSheet(id))) return;
    const sheet = await loadSheet(id);
    if (!sheet) return;
    this.mesh.geometry.dispose();
    this.mesh.geometry = new THREE.PlaneGeometry(height * sheet.aspect, height);
    this.material.map = sheet.frames[0]?.texture ?? this.material.map;
    this.animator = new SpriteAnimator(this.mesh, sheet, this.material);
    this.animator.play({ tag: 'walk' });
  }

  update(dt: number) {
    this.group.position.x += this.dir * this.speed * dt;
    if (this.group.position.x > X_BOUND) this.group.position.x = -X_BOUND;
    else if (this.group.position.x < -X_BOUND) this.group.position.x = X_BOUND;

    if (this.animator) {
      this.animator.update(dt);
    } else {
      // Animation cadence scales with speed so faster walkers step quicker;
      // cycle the four frames (stride A → pass → stride B → pass).
      this.animTimer += dt * this.speed;
      if (this.animTimer > FRAME_TIME) {
        this.animTimer -= FRAME_TIME;
        this.frame = (this.frame + 1) % this.frames.length;
        this.material.map = this.frames[this.frame];
      }
    }
    // Faint walk bob.
    this.bobPhase += dt * this.speed * 9;
    this.mesh.position.y = this.baseY + Math.abs(Math.sin(this.bobPhase)) * 0.03;
    // Tiny shoulder-led counter sway breaks the paper-doll glide without
    // competing with the four authored leg phases.
    this.mesh.rotation.z = -this.dir * Math.sin(this.bobPhase) * 0.012;
  }

  dispose() {
    this.group.removeFromParent();
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

  private readonly umbrellaTex = umbrellaTexture();

  constructor(private readonly scene: THREE.Scene, count: number) {
    this.setCount(count);
  }

  setCount(n: number) {
    const target = Math.max(0, Math.round(n));
    while (this.peds.length < target) {
      const ped = new Pedestrian(this.shadowTex, this.umbrellaTex);
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
