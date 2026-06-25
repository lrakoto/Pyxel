import * as THREE from 'three';

/**
 * Pooled additive spark particles for combat feedback — bullet impacts, kills,
 * and muzzle bursts. Each particle owns its material so colour and fade can vary
 * per particle; with the depth buffer off they draw on top of everything via a
 * high renderOrder. Particles arc under a light gravity and fade as they die.
 */

const POOL = 160;
const GRAVITY = 9;

interface Particle {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  vx: number;
  vy: number;
  life: number;
  max: number;
  active: boolean;
}

export class Sparks {
  readonly group = new THREE.Group();
  private readonly pool: Particle[] = [];

  constructor() {
    const geo = new THREE.PlaneGeometry(0.11, 0.11);
    for (let i = 0; i < POOL; i++) {
      const mat = new THREE.MeshBasicMaterial({
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: false,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      mesh.renderOrder = 26;
      this.group.add(mesh);
      this.pool.push({ mesh, mat, vx: 0, vy: 0, life: 0, max: 1, active: false });
    }
    this.group.renderOrder = 26;
  }

  /** Emits `count` particles from (x, y) in a radial burst tinted `color`. */
  burst(x: number, y: number, color: THREE.ColorRepresentation, count: number, speed = 7) {
    for (let i = 0; i < count; i++) {
      const p = this.pool.find((q) => !q.active);
      if (!p) return;
      p.active = true;
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.25 + Math.random() * 0.95);
      p.vx = Math.cos(a) * s;
      p.vy = Math.sin(a) * s + 1.8; // bias upward so it reads as a spray
      p.max = p.life = 0.22 + Math.random() * 0.32;
      p.mat.color.set(color);
      p.mat.opacity = 1;
      p.mesh.position.set(x, y, 0.06);
      p.mesh.scale.setScalar(0.5 + Math.random() * 0.9);
      p.mesh.visible = true;
    }
  }

  update(dt: number) {
    for (const p of this.pool) {
      if (!p.active) continue;
      p.vy -= GRAVITY * dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        p.mesh.visible = false;
        continue;
      }
      p.mat.opacity = p.life / p.max;
    }
  }

  reset() {
    for (const p of this.pool) {
      p.active = false;
      p.mesh.visible = false;
    }
  }
}
