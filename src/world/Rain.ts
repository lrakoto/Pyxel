import * as THREE from 'three';

export interface RainOptions {
  count?: number;
  /** Respawn height. */
  top?: number;
  /** Horizontal spawn spread around the camera. */
  spanX?: number;
  zMin?: number;
  zMax?: number;
  velX?: number;
  velY?: number;
  /** Seconds of travel rendered as the streak length. */
  tail?: number;
  opacity?: number;
}

const DEFAULTS: Required<RainOptions> = {
  count: 260,
  top: 13,
  spanX: 34,
  zMin: -14,
  zMax: 5.5,
  velX: -2.4,
  velY: -19,
  tail: 0.011,
  opacity: 0.32,
};

/**
 * Wind-blown rain streaks rendered as additive line segments. Instantiated
 * twice: a fast near layer around the street, and a slow sparse layer deep
 * in the scene in front of the painted skyline.
 */
export class Rain {
  readonly object: THREE.LineSegments;

  private readonly o: Required<RainOptions>;
  private readonly heads: Float32Array;
  private readonly positions: THREE.BufferAttribute;

  constructor(options: RainOptions = {}) {
    this.o = { ...DEFAULTS, ...options };
    this.heads = new Float32Array(this.o.count * 3);
    for (let i = 0; i < this.o.count; i++) this.spawn(i, 0, Math.random() * this.o.top);
    const geometry = new THREE.BufferGeometry();
    this.positions = new THREE.BufferAttribute(new Float32Array(this.o.count * 6), 3);
    geometry.setAttribute('position', this.positions);
    const material = new THREE.LineBasicMaterial({
      color: 0x5a7a9e,
      transparent: true,
      opacity: this.o.opacity,
      blending: THREE.AdditiveBlending,
    });
    this.object = new THREE.LineSegments(geometry, material);
    this.object.frustumCulled = false;
  }

  private spawn(i: number, camX: number, y: number) {
    this.heads[i * 3] = camX + (Math.random() - 0.5) * this.o.spanX;
    this.heads[i * 3 + 1] = y;
    this.heads[i * 3 + 2] = this.o.zMin + Math.random() * (this.o.zMax - this.o.zMin);
  }

  update(dt: number, camX: number) {
    const arr = this.positions.array as Float32Array;
    const { velX, velY, tail, top } = this.o;
    for (let i = 0; i < this.o.count; i++) {
      this.heads[i * 3] += velX * dt;
      this.heads[i * 3 + 1] += velY * dt;
      if (this.heads[i * 3 + 1] < 0) {
        this.spawn(i, camX, top - Math.random() * 2);
      }
      const x = this.heads[i * 3];
      const y = this.heads[i * 3 + 1];
      const z = this.heads[i * 3 + 2];
      arr[i * 6] = x;
      arr[i * 6 + 1] = y;
      arr[i * 6 + 2] = z;
      arr[i * 6 + 3] = x - velX * tail;
      arr[i * 6 + 4] = y - velY * tail;
      arr[i * 6 + 5] = z;
    }
    this.positions.needsUpdate = true;
  }
}
