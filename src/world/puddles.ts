import * as THREE from 'three';

/**
 * Mirror puddles: discrete pools on the asphalt showing a clear, upside-down
 * reflection of the scene (signs, buildings, Cole walking past).
 *
 * All puddles share one planar reflection: once per frame the scene is
 * rendered from a camera mirrored through the ground plane into a small
 * render target, and each puddle samples that texture projectively (the
 * three.js Reflector technique), masked to an irregular blob shape, with a
 * subtle ripple so it reads as water without losing legibility.
 */

const REFLECT_LAYER = 1;
const REFLECT_Y = new THREE.Matrix4().makeScale(1, -1, 1);
const _mat4 = new THREE.Matrix4();
const _v4 = new THREE.Vector4();

interface PuddleSpec {
  x: number;
  z: number;
  w: number;
  l: number;
  /** How far up the mirrored view this puddle samples: ~0.17 frames the
   *  signs, small values catch street-level subjects like Cole. */
  bias: number;
}

// One under each neon sign (deep enough to catch the whole mirrored sign),
// two mid-street that catch Cole as he walks.
const PUDDLES: PuddleSpec[] = [
  { x: -15.5, z: -2.6, w: 3.0, l: 2.8, bias: 0.155 },
  { x: -9.5, z: -2.8, w: 3.8, l: 3.2, bias: 0.17 },
  { x: 2.5, z: -2.7, w: 4.2, l: 3.4, bias: 0.17 },
  { x: 10, z: -2.9, w: 3.2, l: 3.0, bias: 0.175 },
  { x: -3.5, z: 0.8, w: 3.0, l: 1.8, bias: 0.06 },
  { x: 6, z: 1.6, w: 2.3, l: 1.4, bias: 0.06 },
];

/** Irregular white blob on transparent — the puddle's outline. */
function blobMask(): THREE.CanvasTexture {
  const w = 128;
  const h = 64;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.filter = 'blur(1.5px)';
  ctx.fillStyle = '#ffffff';
  const blobs = 6 + Math.floor(Math.random() * 3);
  for (let i = 0; i < blobs; i++) {
    ctx.beginPath();
    ctx.ellipse(
      20 + Math.random() * (w - 40),
      14 + Math.random() * (h - 28),
      12 + Math.random() * 22,
      6 + Math.random() * 10,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  return new THREE.CanvasTexture(canvas);
}

const VERTEX = /* glsl */ `
uniform mat4 uTexMatrix;
varying vec4 vRefUv;
varying vec2 vUv;
void main() {
  vUv = uv;
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vRefUv = uTexMatrix * worldPos;
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

const FRAGMENT = /* glsl */ `
uniform sampler2D tReflect;
uniform sampler2D tMask;
uniform float uTime;
uniform float uBias;
uniform float uZoom;
uniform vec2 uCenter;
uniform vec3 uTint;
uniform float uOpacity;
varying vec4 vRefUv;
varying vec2 vUv;
void main() {
  float mask = texture2D(tMask, vUv).a;
  if (mask < 0.05) discard;
  vec2 uv = vRefUv.xy / vRefUv.w;
  // magnify the reflection around the puddle's own center — stylized, like
  // the reference shots, so the mirrored sign fills the pool
  uv = uCenter + (uv - uCenter) * uZoom;
  // bias pulls the sampled view upward so signage lands in the puddle
  uv.y -= uBias;
  // gentle ripple — small enough to keep reflected text readable
  uv.x += sin(uv.y * 40.0 + uTime * 1.4) * 0.0035;
  uv = clamp(uv, 0.001, 0.999);
  // chromatic shift near puddle edges: red/blue diverge as mask fades
  float edge = 1.0 - smoothstep(0.3, 0.9, mask);
  vec2 caOff = vec2(edge * 0.004, 0.0);
  float r = texture2D(tReflect, uv + caOff).r;
  float g = texture2D(tReflect, uv).g;
  float b = texture2D(tReflect, uv - caOff).b;
  vec3 refl = vec3(r, g, b);
  gl_FragColor = vec4(refl * uTint, mask * uOpacity);
}
`;

export class PuddleSystem {
  readonly group = new THREE.Group();

  private readonly target = new THREE.WebGLRenderTarget(960, 540, {
    colorSpace: THREE.SRGBColorSpace,
  });
  private readonly virtualCamera = new THREE.PerspectiveCamera();
  private readonly textureMatrix = new THREE.Matrix4();
  private readonly materials: THREE.ShaderMaterial[] = [];
  private readonly centers: THREE.Vector3[] = [];
  private time = 0;

  constructor() {
    this.virtualCamera.layers.set(REFLECT_LAYER);
    this.group.userData.noReflect = true;
    for (const spec of PUDDLES) {
      const material = new THREE.ShaderMaterial({
        uniforms: {
          tReflect: { value: this.target.texture },
          tMask: { value: blobMask() },
          uTexMatrix: { value: this.textureMatrix },
          uTime: { value: 0 },
          // Pulls the sampled view up so the signs land in the puddle —
          // farther from the buildings needs a stronger pull.
          uBias: { value: spec.bias },
          uZoom: { value: 0.85 },
          uCenter: { value: new THREE.Vector2() },
          uTint: { value: new THREE.Color('#c0d0e8') },
          uOpacity: { value: 0.9 },
        },
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        transparent: true,
        depthWrite: false,
      });
      this.materials.push(material);
      this.centers.push(new THREE.Vector3(spec.x, 0.015, spec.z));
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(spec.w, spec.l), material);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(spec.x, 0.015, spec.z);
      this.group.add(mesh);
    }
  }

  /**
   * Puts everything except `noReflect` subtrees on the reflection layer
   * (lights included), and makes single-sided materials double-sided — the
   * mirrored render flips triangle winding, which would cull them.
   */
  markReflectables(scene: THREE.Scene) {
    const visit = (obj: THREE.Object3D, excluded: boolean) => {
      const skip = excluded || obj.userData.noReflect === true;
      if (!skip && obj !== scene) {
        obj.layers.enable(REFLECT_LAYER);
        const mesh = obj as THREE.Mesh;
        if (mesh.isMesh) {
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          for (const m of mats) {
            if (m.side === THREE.FrontSide) m.side = THREE.DoubleSide;
          }
        }
      }
      for (const child of obj.children) visit(child, skip);
    };
    visit(scene, false);
  }

  /** Mirrors the main camera through the ground plane (y = 0). */
  update(camera: THREE.PerspectiveCamera, dt: number) {
    this.time += dt;
    for (const m of this.materials) m.uniforms.uTime.value = this.time;

    this.virtualCamera.projectionMatrix.copy(camera.projectionMatrix);
    _mat4.copy(camera.matrixWorld).premultiply(REFLECT_Y);
    _mat4.decompose(this.virtualCamera.position, this.virtualCamera.quaternion, this.virtualCamera.scale);
    this.virtualCamera.updateMatrixWorld(true);
    this.virtualCamera.matrixWorldInverse.copy(this.virtualCamera.matrixWorld).invert();

    this.textureMatrix.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
    this.textureMatrix.multiply(this.virtualCamera.projectionMatrix);
    this.textureMatrix.multiply(this.virtualCamera.matrixWorldInverse);

    // Each puddle magnifies around its own projected center.
    for (let i = 0; i < this.materials.length; i++) {
      const c = this.centers[i];
      _v4.set(c.x, c.y, c.z, 1).applyMatrix4(this.textureMatrix);
      (this.materials[i].uniforms.uCenter.value as THREE.Vector2).set(_v4.x / _v4.w, _v4.y / _v4.w);
    }
  }

  /** Renders the mirrored scene into the shared reflection target. */
  render(renderer: THREE.WebGLRenderer, scene: THREE.Scene) {
    const prev = renderer.getRenderTarget();
    renderer.setRenderTarget(this.target);
    renderer.clear(true, true, true);
    renderer.render(scene, this.virtualCamera);
    renderer.setRenderTarget(prev);
  }
}
