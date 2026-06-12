import * as THREE from 'three';
import { spriteTexture } from './pixelTextures';

/**
 * Placeholder sprite for Detective Cole: hat, trench coat, dark red shirt.
 * Pixel maps will be replaced by real Aseprite sheets later; the lighting
 * setup (MeshStandardMaterial so neon point lights tint the sprite) stays.
 */
const PALETTE: Record<string, string> = {
  H: '#171c26', // hat
  S: '#c49070', // skin
  C: '#39434e', // coat
  D: '#2a323b', // coat shadow
  T: '#76303c', // shirt
  P: '#20242c', // pants
  B: '#0e1116', // boots
};

const BODY = [
  '...HHHHHH...',
  '...HHHHHH...',
  '..HHHHHHHH..',
  '...SSSSSS...',
  '...SSSSSS...',
  '....SSSS....',
  '..CCCCCCCC..',
  '.CCCCCCCCCC.',
  '.CCDTTTTDCC.',
  '.CC.TTTT.CC.',
  '.CC.TTTT.CC.',
  '.CC.CCCC.CC.',
  '.SS.CCCC.SS.',
  '....CCCC....',
  '....CCCC....',
  '....CDDC....',
];

const LEGS_IDLE = [
  '...PP..PP...',
  '...PP..PP...',
  '...PP..PP...',
  '...PP..PP...',
  '..BBB..BBB..',
  '..BBB..BBB..',
];

const LEGS_STRIDE = [
  '...PP..PP...',
  '..PP....PP..',
  '..PP....PP..',
  '.PP......PP.',
  '.BBB....BBB.',
  'BBB......BBB',
];

const LEGS_PASS = [
  '...PPPP.....',
  '...PPPP.....',
  '...PP.PP....',
  '...PP.PP....',
  '..BBB.BB....',
  '..BBB.BBB...',
];

export interface MoveInput {
  left: boolean;
  right: boolean;
}

/**
 * Wet rim glow: a camera-facing sprite has one flat normal, so fresnel can't
 * find its edges. Instead the shader samples the sprite's alpha one texel to
 * each side — opaque pixels bordering transparency are the silhouette — and
 * tints them with the color of the neon lights currently hitting Cole,
 * weighted toward the side the light comes from.
 */
const RIM_DECLS = `
uniform vec3 uRimColor;
uniform float uRimDirX;
uniform float uRimUp;
uniform vec2 uRimTexel;
`;

const RIM_GLSL = `
#ifdef USE_MAP
  float rimL = 1.0 - texture2D(map, vMapUv - vec2(uRimTexel.x, 0.0)).a;
  float rimR = 1.0 - texture2D(map, vMapUv + vec2(uRimTexel.x, 0.0)).a;
  float rimU = 1.0 - texture2D(map, vMapUv + vec2(0.0, uRimTexel.y)).a;
  float rimEdge = max(uRimDirX, 0.0) * rimR
                + max(-uRimDirX, 0.0) * rimL
                + uRimUp * rimU;
  gl_FragColor.rgb += uRimColor * clamp(rimEdge, 0.0, 1.5);
#endif
`;

const SPEED = 4.2;
const WORLD_BOUND = 16;
const FRAME_TIME = 0.16;
const HEIGHT = 1.7;

export class Player {
  readonly mesh: THREE.Mesh;
  x = 0;

  private readonly frames: THREE.Texture[];
  private readonly material: THREE.MeshStandardMaterial;
  private facing = 1;
  private frame = 0;
  private animTimer = 0;
  private readonly rimUniforms = {
    uRimColor: { value: new THREE.Color(0, 0, 0) },
    uRimDirX: { value: 0 },
    uRimUp: { value: 0.3 },
    uRimTexel: { value: new THREE.Vector2(1 / 12, 1 / 22) },
  };

  constructor() {
    this.frames = [LEGS_IDLE, LEGS_STRIDE, LEGS_PASS].map((legs) =>
      spriteTexture([...BODY, ...legs], PALETTE),
    );
    this.material = new THREE.MeshStandardMaterial({
      map: this.frames[0],
      transparent: true,
      alphaTest: 0.5,
      roughness: 0.9,
      metalness: 0,
      side: THREE.DoubleSide,
    });
    this.material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, this.rimUniforms);
      shader.fragmentShader = RIM_DECLS + shader.fragmentShader.replace(
        '#include <tonemapping_fragment>',
        `${RIM_GLSL}\n#include <tonemapping_fragment>`,
      );
    };
    const width = HEIGHT * (12 / 22);
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, HEIGHT), this.material);
    this.mesh.position.set(0, HEIGHT / 2, 0);
  }

  update(dt: number, input: MoveInput) {
    const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const walking = dir !== 0;

    if (walking) {
      this.facing = dir;
      this.x = THREE.MathUtils.clamp(this.x + dir * SPEED * dt, -WORLD_BOUND, WORLD_BOUND);
      this.animTimer += dt;
      if (this.animTimer > FRAME_TIME) {
        this.animTimer = 0;
        this.frame = this.frame === 1 ? 2 : 1;
        this.material.map = this.frames[this.frame];
      }
    } else if (this.frame !== 0) {
      this.frame = 0;
      this.animTimer = 0;
      this.material.map = this.frames[0];
    }

    this.mesh.position.x = this.x;
    this.mesh.scale.x = this.facing;
    const bob = walking ? Math.abs(Math.sin(performance.now() * 0.012)) * 0.035 : 0;
    this.mesh.position.y = HEIGHT / 2 + bob;
  }

  /**
   * Aggregates the nearby neon lights into the rim uniforms each frame.
   * Reads live intensities, so the rim flickers in sync with the signs.
   */
  updateRim(lights: THREE.PointLight[]) {
    let r = 0;
    let g = 0;
    let b = 0;
    let dirX = 0;
    let total = 0;
    for (const light of lights) {
      const dx = light.position.x - this.x;
      const dy = light.position.y - 1.2;
      const dz = light.position.z;
      const d2 = dx * dx + dy * dy + dz * dz;
      const w = light.intensity / Math.max(d2, 1);
      r += light.color.r * w;
      g += light.color.g * w;
      b += light.color.b * w;
      dirX += (dx / Math.sqrt(d2)) * w;
      total += w;
    }
    if (total <= 0.001) {
      this.rimUniforms.uRimColor.value.setScalar(0);
      return;
    }
    const peak = Math.max(r, g, b);
    const strength = Math.min(total * 1.6, 2.4);
    this.rimUniforms.uRimColor.value.setRGB(r / peak, g / peak, b / peak).multiplyScalar(strength);
    // Texture UVs mirror when the sprite flips, so the world-space light
    // direction has to flip with the facing.
    this.rimUniforms.uRimDirX.value = THREE.MathUtils.clamp(dirX / total, -1, 1) * this.facing;
  }
}
