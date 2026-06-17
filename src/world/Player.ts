import * as THREE from 'three';
import { spriteTexture } from './pixelTextures';

/**
 * Detective Cole: a 14×28 *side-profile* pixel sprite facing his direction of
 * travel (mirrored when he turns) — wide-brim hat, dark trench coat with lapel
 * and back-seam shading, and a muted gold scarf wrapped at the neck. The loose
 * tail of the scarf is a separate cloth ribbon (see Scarf below) so it can be
 * driven by wind/gravity and shimmer independently of the body frames. Real
 * Aseprite art will replace the pixel maps later; the lit-material setup stays.
 */
const PALETTE: Record<string, string> = {
  H: '#14171d', // hat
  h: '#20242c', // hat brim
  S: '#c49070', // skin
  e: '#41301f', // brow / eye
  C: '#2c333d', // trench coat
  D: '#1b212a', // coat shadow (back seam, hem)
  L: '#3a4350', // coat highlight (lapel, shoulder)
  G: '#9a7c38', // muted gold scarf
  P: '#20242c', // trousers
  B: '#0d0f13', // boots
};

// Head + coat in profile, facing right. Shared across all frames (rows 0–21).
const BODY = [
  '.....HHHH.....',
  '....HHHHHH....',
  '...HHHHHHHH...',
  '..hhhhhhhhhhh.',
  '....SSSSSS....',
  '....SeSSSSf...',
  '....SSSSSS....',
  '.....SSSSS....',
  '....GGGGGG....',
  '...GGGGGGGG...',
  '..LCCCCCCCC...',
  '..CCCCCCCCC...',
  '..CDCCCCCCC...',
  '..CDCCCCCCC...',
  '..CDCCCCCC....',
  '..CDCCCCCC....',
  '..CCCCCCCC....',
  '..CCCCCCCC....',
  '..CCCCCCC.....',
  '..CCCCCCC.....',
  '..CCCDDDD.....',
  '..CCCCCCC.....',
];

// Side-view legs: one forward, one back, striding fore-and-aft.
const LEGS_IDLE = [
  '...PP.PP......',
  '...PP.PP......',
  '...PP.PP......',
  '...PP.PP......',
  '..BBB.BBB.....',
  '..BBB.BBB.....',
];

const LEGS_STRIDE = [
  '...PP.PP......',
  '..PP...PP.....',
  '..P.....PP....',
  '.PP.....P.....',
  '.BB.....BB....',
  'BB.......BB...',
];

const LEGS_PASS = [
  '...PPPP.......',
  '...PPPP.......',
  '...PP.P.......',
  '...PP.P.......',
  '..BBB.BB......',
  '..BBB.BBB.....',
];

const SPRITE_W = 14;
const SPRITE_H = 28;

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

/**
 * The scarf's loose tail: a thin gold cloth ribbon anchored at Cole's neck. A
 * spring drives a single "wind lift" value from the walk amount: as he moves,
 * wind pulls the tail up toward horizontal (streaming behind him); when he
 * stops, it swings back down under gravity and settles. The tip lifts more than
 * the neck so the cloth curves rather than going rigid. A bright, near-metallic
 * highlight band sweeps along its length for the shimmer.
 */
class Scarf {
  readonly mesh: THREE.Mesh;
  private readonly geo: THREE.PlaneGeometry;
  private readonly rows: number;
  private readonly cols = 2;
  private readonly halfWidth = 0.055;
  private readonly totalLen = 0.64;
  private readonly time = { value: 0 };
  private t = 0;
  private wind = 0; // 0 = hanging straight down, ~1 = streamed horizontal
  private windVel = 0;

  constructor() {
    const segs = 10;
    this.geo = new THREE.PlaneGeometry(this.halfWidth * 2, this.totalLen, 1, segs);
    this.geo.translate(0, -this.totalLen / 2, 0); // anchor at the top edge (y = 0)
    this.rows = segs + 1;

    const material = new THREE.MeshStandardMaterial({
      color: '#9a7c38',
      roughness: 0.22,
      metalness: 0.7,
      emissive: new THREE.Color('#2a1f0a'),
      emissiveIntensity: 0.2,
      side: THREE.DoubleSide,
    });
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uScarfTime = this.time;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying float vScarfT;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvScarfT = uv.y;');
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          '#include <common>\nvarying float vScarfT;\nuniform float uScarfTime;',
        )
        .replace(
          '#include <tonemapping_fragment>',
          `float m = fract(vScarfT * 1.5 - uScarfTime * 0.34);
           float d = abs(m - 0.5);
           float band = smoothstep(0.5, 0.32, d);
           float core = smoothstep(0.5, 0.47, d);
           gl_FragColor.rgb += vec3(1.0, 0.88, 0.58) * band * 0.5 + vec3(1.0, 0.94, 0.74) * core * 0.42;
           #include <tonemapping_fragment>`,
        );
    };

    this.mesh = new THREE.Mesh(this.geo, material);
    this.mesh.position.set(0, 0.28, 0.06); // neck, just in front of the coat
  }

  update(dt: number, walkAmt: number) {
    this.t += dt;
    this.time.value = this.t;

    // Spring the wind lift toward the walk amount. Underdamped, so when he stops
    // the tail swings down past vertical and settles — a gentle gravity fall.
    const k = 55;
    const damp = 9;
    this.windVel += (walkAmt - this.wind) * k * dt;
    this.windVel -= this.windVel * damp * dt;
    this.wind += this.windVel * dt;
    const lift = THREE.MathUtils.clamp(this.wind, -0.06, 1.08);

    const px = this.geo.attributes.position as THREE.BufferAttribute;
    const segLen = this.totalLen / (this.rows - 1);
    let cx = 0;
    let cy = 0;
    for (let r = 0; r < this.rows; r++) {
      const drape = r / (this.rows - 1);
      // Tip lifts more than the neck → the ribbon curves into the wind.
      const angle = lift * 1.5 * (0.35 + 0.65 * drape);
      const sinA = Math.sin(angle);
      const cosA = Math.cos(angle);
      const ripple = Math.sin(this.t * 6 - r * 0.8) * (0.008 + 0.05 * walkAmt) * drape;
      // Perpendicular to the hang direction places the ribbon's two edges.
      for (let c = 0; c < this.cols; c++) {
        const half = (c === 0 ? -1 : 1) * this.halfWidth + ripple;
        const i = r * this.cols + c;
        px.setX(i, cx + cosA * half);
        px.setY(i, cy - sinA * half);
      }
      cx += -sinA * segLen; // each segment steps down-and-back
      cy += -cosA * segLen;
    }
    px.needsUpdate = true;
  }
}

export class Player {
  readonly mesh: THREE.Mesh;
  x = 0;

  private readonly frames: THREE.Texture[];
  private readonly material: THREE.MeshStandardMaterial;
  private readonly scarf = new Scarf();
  private facing = 1;
  private frame = 0;
  private animTimer = 0;
  private walkAmt = 0;
  private readonly rimUniforms = {
    uRimColor: { value: new THREE.Color(0, 0, 0) },
    uRimDirX: { value: 0 },
    uRimUp: { value: 0.3 },
    uRimTexel: { value: new THREE.Vector2(1 / SPRITE_W, 1 / SPRITE_H) },
  };

  constructor() {
    if (import.meta.env.DEV) {
      for (const [name, legs] of [
        ['idle', LEGS_IDLE],
        ['stride', LEGS_STRIDE],
        ['pass', LEGS_PASS],
      ] as const) {
        for (const [i, row] of [...BODY, ...legs].entries()) {
          if (row.length !== SPRITE_W) {
            console.error(`[Cole ${name}] row ${i} is ${row.length} wide, expected ${SPRITE_W}: "${row}"`);
          }
        }
      }
    }

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
    const width = HEIGHT * (SPRITE_W / SPRITE_H);
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, HEIGHT), this.material);
    this.mesh.position.set(0, HEIGHT / 2, 0);
    this.mesh.add(this.scarf.mesh);
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

    this.walkAmt += ((walking ? 1 : 0) - this.walkAmt) * Math.min(1, dt * 8);
    this.scarf.update(dt, this.walkAmt);
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
