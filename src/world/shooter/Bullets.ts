import * as THREE from 'three';

/**
 * Pooled bullet tracers for Cole's machine pistol. Bullets travel on the z=0
 * gameplay plane in 2D (x, y); the depth buffer is off project-wide, so each
 * tracer draws with depthTest disabled and a high renderOrder to sit on top of
 * the street and combatants. Pooling avoids per-shot allocation during sustained
 * fire. A single shared additive material keeps the draw cheap.
 */

const POOL = 90;
const SPEED = 30;
const LIFE = 1.0;
const MAX_X = 60;

interface Bullet {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  life: number;
  active: boolean;
}

export class Bullets {
  readonly group = new THREE.Group();
  private readonly pool: Bullet[] = [];

  constructor() {
    const geo = new THREE.PlaneGeometry(0.55, 0.07);
    const mat = new THREE.MeshBasicMaterial({
      color: '#ffd27a',
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
    });
    for (let i = 0; i < POOL; i++) {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      mesh.renderOrder = 22;
      this.group.add(mesh);
      this.pool.push({ mesh, vx: 0, vy: 0, life: 0, active: false });
    }
    this.group.renderOrder = 22;
  }

  /** Spawns a tracer from (x, y) along `angle` (radians, world space). */
  fire(x: number, y: number, angle: number) {
    const b = this.pool.find((p) => !p.active);
    if (!b) return;
    b.active = true;
    b.life = LIFE;
    b.vx = Math.cos(angle) * SPEED;
    b.vy = Math.sin(angle) * SPEED;
    b.mesh.position.set(x, y, 0.05);
    b.mesh.rotation.z = angle;
    b.mesh.visible = true;
  }

  /**
   * Advances live bullets. `hit(x, y)` is called with each bullet's position;
   * returning true consumes the bullet (it struck a target).
   */
  update(dt: number, hit: (x: number, y: number) => boolean) {
    for (const b of this.pool) {
      if (!b.active) continue;
      b.mesh.position.x += b.vx * dt;
      b.mesh.position.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0 || b.mesh.position.y < 0.04 || Math.abs(b.mesh.position.x) > MAX_X) {
        b.active = false;
        b.mesh.visible = false;
        continue;
      }
      if (hit(b.mesh.position.x, b.mesh.position.y)) {
        b.active = false;
        b.mesh.visible = false;
      }
    }
  }

  reset() {
    for (const b of this.pool) {
      b.active = false;
      b.mesh.visible = false;
    }
  }
}
