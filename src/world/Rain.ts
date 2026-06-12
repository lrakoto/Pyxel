import * as THREE from 'three';

const COUNT = 360;
const TOP = 13;
const SPAN_X = 34;
const Z_MIN = -14;
const Z_MAX = 5.5;
const VEL_X = -2.4;
const VEL_Y = -19;
const TAIL = 0.011; // seconds of travel rendered as the streak length

/** Wind-blown rain streaks rendered as additive line segments. */
export class Rain {
  readonly object: THREE.LineSegments;

  private readonly heads = new Float32Array(COUNT * 3);
  private readonly positions: THREE.BufferAttribute;

  constructor() {
    for (let i = 0; i < COUNT; i++) this.spawn(i, 0, Math.random() * TOP);
    const geometry = new THREE.BufferGeometry();
    this.positions = new THREE.BufferAttribute(new Float32Array(COUNT * 6), 3);
    geometry.setAttribute('position', this.positions);
    const material = new THREE.LineBasicMaterial({
      color: 0x5a7a9e,
      transparent: true,
      opacity: 0.32,
      blending: THREE.AdditiveBlending,
    });
    this.object = new THREE.LineSegments(geometry, material);
    this.object.frustumCulled = false;
  }

  private spawn(i: number, camX: number, y: number) {
    this.heads[i * 3] = camX + (Math.random() - 0.5) * SPAN_X;
    this.heads[i * 3 + 1] = y;
    this.heads[i * 3 + 2] = Z_MIN + Math.random() * (Z_MAX - Z_MIN);
  }

  update(dt: number, camX: number) {
    const arr = this.positions.array as Float32Array;
    for (let i = 0; i < COUNT; i++) {
      this.heads[i * 3] += VEL_X * dt;
      this.heads[i * 3 + 1] += VEL_Y * dt;
      if (this.heads[i * 3 + 1] < 0) {
        this.spawn(i, camX, TOP - Math.random() * 2);
      }
      const x = this.heads[i * 3];
      const y = this.heads[i * 3 + 1];
      const z = this.heads[i * 3 + 2];
      arr[i * 6] = x;
      arr[i * 6 + 1] = y;
      arr[i * 6 + 2] = z;
      arr[i * 6 + 3] = x - VEL_X * TAIL;
      arr[i * 6 + 4] = y - VEL_Y * TAIL;
      arr[i * 6 + 5] = z;
    }
    this.positions.needsUpdate = true;
  }
}
