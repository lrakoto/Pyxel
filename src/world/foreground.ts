import * as THREE from 'three';
import type { Updatable } from './sector7';

/**
 * Near-camera occluder layer: utility poles and sagging catenary wires.
 * Almost-black silhouettes against the lit street — they only exist to give
 * the walk strong foreground parallax, the way poles and cables frame the
 * REPLACED street shots.
 */

const POLE_XS = [-13, -3, 7.5, 17];
const POLE_Z = 3.3;
// The camera frustum at pole depth tops out around y≈6.4 — keep the arms
// below that or the wires sag entirely out of frame.
const ARM_Y = 5.6;
const SEGMENTS = 16;

const SILHOUETTE = new THREE.MeshStandardMaterial({ color: '#0a0c10', roughness: 0.9 });

/** A wire sagging between two points, swaying slowly in the wind. */
class Wire implements Updatable {
  readonly object: THREE.Line;
  private readonly positions: THREE.BufferAttribute;
  private t = Math.random() * 10;

  constructor(
    private readonly a: THREE.Vector3,
    private readonly b: THREE.Vector3,
    private readonly sag: number,
  ) {
    const geometry = new THREE.BufferGeometry();
    this.positions = new THREE.BufferAttribute(new Float32Array((SEGMENTS + 1) * 3), 3);
    geometry.setAttribute('position', this.positions);
    // Light enough to silhouette against dark facades, still darker than sky.
    this.object = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: '#1a2233' }));
    this.object.frustumCulled = false;
    this.layout(0);
  }

  update(dt: number) {
    this.t += dt;
    this.layout(Math.sin(this.t * 0.7) * 0.07);
  }

  private layout(sway: number) {
    const dip = this.sag + sway;
    for (let i = 0; i <= SEGMENTS; i++) {
      const s = i / SEGMENTS;
      // quadratic bezier with a dropped control point ≈ catenary
      const inv = 1 - s;
      const cx = (this.a.x + this.b.x) / 2;
      const cy = (this.a.y + this.b.y) / 2 - dip * 2;
      this.positions.setXYZ(
        i,
        inv * inv * this.a.x + 2 * inv * s * cx + s * s * this.b.x,
        inv * inv * this.a.y + 2 * inv * s * cy + s * s * this.b.y,
        this.a.z,
      );
    }
    this.positions.needsUpdate = true;
  }
}

function buildPole(x: number): THREE.Group {
  const group = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.BoxGeometry(0.22, 9.6, 0.22), SILHOUETTE);
  pole.position.y = 4.8;
  group.add(pole);
  const armTop = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.12, 0.14), SILHOUETTE);
  armTop.position.y = ARM_Y;
  group.add(armTop);
  const armLow = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.12, 0.14), SILHOUETTE);
  armLow.position.y = ARM_Y - 0.65;
  group.add(armLow);
  const transformer = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.65, 0.45), SILHOUETTE);
  transformer.position.set(0.34, ARM_Y - 1.5, 0);
  group.add(transformer);
  group.position.set(x, 0, POLE_Z);
  group.rotation.z = (Math.random() - 0.5) * 0.035;
  return group;
}

export function buildForeground(scene: THREE.Scene): Updatable[] {
  const updatables: Updatable[] = [];

  for (const x of POLE_XS) scene.add(buildPole(x));

  const spans: [THREE.Vector3, THREE.Vector3, number][] = [];
  for (let i = 0; i < POLE_XS.length - 1; i++) {
    const a = new THREE.Vector3(POLE_XS[i] + 0.7, ARM_Y, POLE_Z);
    const b = new THREE.Vector3(POLE_XS[i + 1] - 0.7, ARM_Y, POLE_Z);
    spans.push([a, b, 0.5 + Math.random() * 0.25]);
    spans.push([
      a.clone().setY(ARM_Y - 0.65),
      b.clone().setY(ARM_Y - 0.65),
      0.7 + Math.random() * 0.25,
    ]);
  }
  // run the lines off both ends of the street
  spans.push([
    new THREE.Vector3(POLE_XS[0] - 0.7, ARM_Y, POLE_Z),
    new THREE.Vector3(POLE_XS[0] - 14, ARM_Y - 1.4, POLE_Z),
    0.4,
  ]);
  spans.push([
    new THREE.Vector3(POLE_XS[POLE_XS.length - 1] + 0.7, ARM_Y, POLE_Z),
    new THREE.Vector3(POLE_XS[POLE_XS.length - 1] + 14, ARM_Y - 1.2, POLE_Z),
    0.4,
  ]);

  for (const [a, b, sag] of spans) {
    const wire = new Wire(a, b, sag);
    scene.add(wire.object);
    updatables.push(wire);
  }

  return updatables;
}
