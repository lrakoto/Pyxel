import * as THREE from 'three';
import { spriteTexture } from '../pixelTextures';

/**
 * Combat enemies for the shooter slice, as camera-facing pixel billboards on the
 * z=0 plane (the camera is near front-on, so a flat XY plane needs no real
 * billboarding). Two kinds:
 *   - ground: a Sector 7 enforcer that advances along the street toward Cole.
 *   - drone : an aerial unit that floats in and dives at him, bobbing in the air.
 * Each takes hits (white flash + hp), deals contact damage, and dies when hp
 * runs out. A shared lit material lets the neon scene fall on them like Cole.
 */

export type EnemyKind = 'ground' | 'drone';

const ENFORCER = [
  '....MMMMMM....',
  '...MMMMMMMM...',
  '...MSSVVSSM...',
  '...MSSSSSSM...',
  '....JJJJJJ....',
  '..MJJJJJJJJM..',
  '..JJJJJJJJJJ..',
  '..JJjJJJJjJJ..',
  '..JJjJJJJjJJ..',
  '..JJJJJJJJJJ..',
  '..JJJJJJJJJJ..',
  '...JJJJJJJJ...',
  '...JJJ..JJJ...',
  '...JJ....JJ...',
  '...JJ....JJ...',
  '...BB....BB...',
];
const ENFORCER_PALETTE: Record<string, string> = {
  M: '#3a4250', // helmet / armour plate
  S: '#9c6b48', // skin
  V: '#ff3b46', // visor glow
  J: '#262b35', // jacket
  j: '#161a21', // jacket shadow
  B: '#0e1014', // boots
};

const DRONE = [
  'M..M....M..M',
  '.MM......MM.',
  '...dDDDDd...',
  '..dDDDDDDd..',
  '..DDVVVVDD..',
  '..dDDDDDDd..',
  '...dDDDDd...',
  '....d..d....',
];
const DRONE_PALETTE: Record<string, string> = {
  M: '#4a5360', // rotor blur
  D: '#2b313c', // hull
  d: '#161a21', // hull shadow
  V: '#ff3b46', // sensor eye
};

interface Spec {
  rows: string[];
  palette: Record<string, string>;
  px: { w: number; h: number };
  worldH: number;
  hp: number;
  speed: number;
  radius: number;
  contactDps: number;
  emissive: string;
}

const SPECS: Record<EnemyKind, Spec> = {
  ground: {
    rows: ENFORCER,
    palette: ENFORCER_PALETTE,
    px: { w: 14, h: 16 },
    worldH: 1.75,
    hp: 4,
    speed: 2.3,
    radius: 0.62,
    contactDps: 24,
    emissive: '#ff3b46',
  },
  drone: {
    rows: DRONE,
    palette: DRONE_PALETTE,
    px: { w: 12, h: 8 },
    worldH: 0.85,
    hp: 2,
    speed: 3.4,
    radius: 0.5,
    contactDps: 18,
    emissive: '#36e0ff',
  },
};

export class Enemy {
  readonly kind: EnemyKind;
  readonly mesh: THREE.Mesh;
  readonly radius: number;
  readonly contactDps: number;
  x: number;
  y: number;
  hp: number;
  dead = false;

  private readonly spec: Spec;
  private readonly material: THREE.MeshStandardMaterial;
  private readonly baseEmissive: THREE.Color;
  private hitFlash = 0;
  private t = Math.random() * 10;
  private facing = 1;

  constructor(kind: EnemyKind, x: number) {
    this.kind = kind;
    const spec = (this.spec = SPECS[kind]);
    this.x = x;
    this.y = kind === 'ground' ? spec.worldH / 2 : 4.2;
    this.hp = spec.hp;
    this.radius = spec.radius;
    this.contactDps = spec.contactDps;

    this.baseEmissive = new THREE.Color(spec.emissive);
    this.material = new THREE.MeshStandardMaterial({
      map: spriteTexture(spec.rows, spec.palette),
      transparent: true,
      alphaTest: 0.5,
      roughness: 0.85,
      metalness: 0.1,
      // Faint type-coloured glow for readability; the neon scene does most of
      // the lighting so the pixel detail still reads. Hit-flash spikes this.
      emissive: this.baseEmissive.clone(),
      emissiveIntensity: 0.1,
      side: THREE.DoubleSide,
    });
    const w = spec.worldH * (spec.px.w / spec.px.h);
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, spec.worldH), this.material);
    this.mesh.position.set(this.x, this.y, 0);
    this.mesh.renderOrder = 2;
  }

  /** Steers toward Cole at (targetX, targetY); returns nothing. */
  update(dt: number, targetX: number, targetY: number) {
    if (this.dead) return;
    this.t += dt;

    if (this.kind === 'ground') {
      const dir = Math.sign(targetX - this.x);
      if (Math.abs(targetX - this.x) > this.radius * 0.8) {
        this.x += dir * this.spec.speed * dt;
        this.facing = dir || this.facing;
      }
      this.y = this.spec.worldH / 2 + Math.abs(Math.sin(this.t * 6)) * 0.04; // walk bob
    } else {
      // Drone hunts a point just above and beside Cole, bobbing as it flies.
      const goalX = targetX;
      const goalY = targetY + 1.1 + Math.sin(this.t * 2.2) * 0.35;
      const dx = goalX - this.x;
      const dy = goalY - this.y;
      const d = Math.hypot(dx, dy) || 1;
      this.x += (dx / d) * this.spec.speed * dt;
      this.y += (dy / d) * this.spec.speed * dt;
      this.facing = Math.sign(dx) || this.facing;
    }

    this.mesh.position.set(this.x, this.y, 0);
    this.mesh.scale.x = this.facing >= 0 ? 1 : -1;

    if (this.hitFlash > 0) {
      this.hitFlash -= dt;
      const f = Math.max(0, this.hitFlash / 0.12);
      this.material.emissive.copy(this.baseEmissive).lerp(WHITE, f);
      this.material.emissiveIntensity = 0.1 + f * 2.6;
      if (this.hitFlash <= 0) {
        this.material.emissive.copy(this.baseEmissive);
        this.material.emissiveIntensity = 0.1;
      }
    }
  }

  /** Applies `n` damage; returns true if this hit was the kill. */
  damage(n: number): boolean {
    if (this.dead) return false;
    this.hp -= n;
    this.hitFlash = 0.12;
    if (this.hp <= 0) {
      this.dead = true;
      return true;
    }
    return false;
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.material.map?.dispose();
    this.material.dispose();
  }
}

const WHITE = new THREE.Color('#ffffff');
