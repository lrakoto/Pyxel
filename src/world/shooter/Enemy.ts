import * as THREE from 'three';
import { loadSheet, hasSheet, type SpriteSheet } from '../../sprites/SpriteLibrary';
import { SpriteAnimator } from '../../sprites/SpriteAnimator';
import {
  ENFORCER_W, ENFORCER_H, ENFORCER_FRAMES,
  DRONE_W, DRONE_H, DRONE_FRAMES,
} from '../sprites';

/**
 * Combat enemies for the shooter slice, as camera-facing pixel billboards on the
 * z=0 plane (the camera is near front-on, so a flat XY plane needs no real
 * billboarding). Two kinds:
 *   - ground: a Sector 7 enforcer that advances along the street toward Cole.
 *   - drone : an aerial unit that floats in and dives at him, bobbing in the air.
 * Each takes hits (white flash + hp), deals contact damage, and dies when hp
 * runs out. A shared lit material lets the neon scene fall on them like Cole.
 *
 * Procedural frames live in sprites.ts alongside Cole; a compiled Aseprite
 * sheet of the same id ("enforcer" / "drone") swaps in at runtime.
 */

export type EnemyKind = 'ground' | 'drone';

interface Spec {
  frames: THREE.CanvasTexture[];
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
    frames: ENFORCER_FRAMES.walk,
    px: { w: ENFORCER_W, h: ENFORCER_H },
    worldH: 1.75,
    hp: 40, // 4 pistol rounds (10 dmg each)
    speed: 2.3,
    radius: 0.62,
    contactDps: 24,
    emissive: '#ff3b46',
  },
  drone: {
    frames: DRONE_FRAMES.hover,
    px: { w: DRONE_W, h: DRONE_H },
    worldH: 0.85,
    hp: 20, // 2 pistol rounds
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
  private knockVx = 0;
  private knockVy = 0;
  // Procedural-frame animation state.
  private walkTimer = Math.random() * 0.5;
  private walkFrame = 0;
  // Aseprite-driven state: null until the compiled sheet finishes loading.
  private sheet: SpriteSheet | null = null;
  private animator: SpriteAnimator | null = null;

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
      map: spec.frames[0],
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

    // Swap in the compiled Aseprite sheet (walk / spin / death tags) when it
    // exists; the procedural frames above remain the fallback otherwise.
    this.tryUpgradeArt();
  }

  private async tryUpgradeArt() {
    const id = this.kind === 'ground' ? 'enforcer' : 'drone';
    if (!(await hasSheet(id))) return;
    const sheet = await loadSheet(id);
    if (!sheet) return;
    this.sheet = sheet;
    this.mesh.geometry.dispose();
    this.mesh.geometry = new THREE.PlaneGeometry(this.spec.worldH * sheet.aspect, this.spec.worldH);
    this.material.map = sheet.frames[0]?.texture ?? this.material.map;
    this.animator = new SpriteAnimator(this.mesh, sheet, this.material);
    this.animator.play({ tag: 'walk' });
  }

  /** Steers toward Cole at (targetX, targetY); returns nothing. */
  update(dt: number, targetX: number, targetY: number) {
    if (this.dead) {
      // Dead enemies only need their death animation to keep playing.
      this.animator?.update(dt);
      return;
    }
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

    // Apply and damp hit knockback on top of the steering.
    if (this.knockVx !== 0 || this.knockVy !== 0) {
      this.x += this.knockVx * dt;
      this.y += this.knockVy * dt;
      const damp = Math.max(0, 1 - dt * 9);
      this.knockVx *= damp;
      this.knockVy *= damp;
      if (Math.abs(this.knockVx) < 0.05) this.knockVx = 0;
      if (Math.abs(this.knockVy) < 0.05) this.knockVy = 0;
    }
    if (this.kind === 'ground') this.y = Math.max(this.spec.worldH / 2, this.y);

    this.mesh.position.set(this.x, this.y, 0);
    this.mesh.scale.x = this.facing >= 0 ? 1 : -1;
    this.animator?.update(dt);
    if (!this.animator) {
      // Procedural frame: cycle the walk loop. Drones use the same timer —
      // their two hover frames read as rotor spin.
      this.walkTimer += dt;
      if (this.walkTimer >= 0.14) {
        this.walkTimer = 0;
        this.walkFrame = (this.walkFrame + 1) % this.spec.frames.length;
        this.material.map = this.spec.frames[this.walkFrame];
      }
    }

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
      // Let the Aseprite death tag play through once, if the sheet ships one.
      if (this.sheet?.tags['death'] && this.animator) {
        this.animator.play({ tag: 'death' });
      }
      return true;
    }
    return false;
  }

  /** Shoves the enemy along (dx, dy) (unit dir) with the given speed. */
  knockback(dx: number, dy: number, speed: number) {
    this.knockVx += dx * speed;
    this.knockVy += dy * speed;
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}

const WHITE = new THREE.Color('#ffffff');
