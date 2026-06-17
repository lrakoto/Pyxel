import * as THREE from 'three';
import { TUNING } from '../tuning';
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
  g: '#0d0f13', // sunglasses lens
  C: '#2c333d', // trench coat
  D: '#1b212a', // coat shadow (back seam, hem)
  L: '#3a4350', // coat highlight (lapel, shoulder)
  G: '#ee4444', // bright red scarf
  b: '#1a1f28', // hat band
  P: '#20242c', // trousers
  B: '#0d0f13', // boots
};

// Head + coat in profile, facing right. Shared across all frames (rows 0–21).
const BODY = [
  '....HHHHH.....', // fedora crown top
  '...HHHHHHH....', // fedora crown
  '..bHHHHHHHb..', // fedora crown with hat band
  '..hhhhhhhhhhh.', // fedora brim
  '....SSSSSS....',
  '....SSSggg....', // sunglasses
  '....SSSSSS....',
  '.....SSSSS....',
  '....GGGGGG....',
  '...GGGGGGGG...',
  '..LCCCCCCCC...',
  '..CCCCCCCLC...', // coat with front edge highlight
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
uniform float uSpeed;
uniform float uLensPos;
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

  // Reflection sweeps across sunglasses opposite to movement
  float lensLeft = 0.48;
  float lensRight = 0.74;
  float lensWidth = lensRight - lensLeft;
  float rawPos = uLensPos;
  float pos = lensLeft + rawPos * lensWidth;
  float edgeFade = smoothstep(0.0, 0.025, rawPos) * smoothstep(1.0, 0.975, rawPos);
  float dx = vMapUv.x - pos;
  float dy = vMapUv.y - 0.80;
  float highlight = 1.0 - smoothstep(0.008, 0.035, sqrt(dx * dx + dy * dy));
  float sheen = highlight * smoothstep(0.1, 0.5, uSpeed) * 3.5 * edgeFade;
  gl_FragColor.rgb += vec3(sheen * 0.75, sheen * 0.88, sheen);
#endif
`;

const SPEED = 4.2;
const WORLD_BOUND = 16;
const FRAME_TIME = 0.16;
const HEIGHT = 1.7;

/**
 * The scarf's loose tail: a thin cloth ribbon simulated as a verlet chain of
 * point masses anchored at Cole's neck. Gravity pulls it down, an air-drag damps
 * it, and a wind force proportional to his velocity (plus turbulent gusts) pushes
 * it back and aloft. Distance constraints keep the segments together. Because
 * each point carries its own momentum, the motion propagates down the cloth —
 * the tip lags and overshoots, a wave runs through it when he starts or stops,
 * and the gusts make it flutter — rather than swinging as one rigid flap.
 *
 * The sim runs in world space (so it isn't fought by Cole's mirror-flip); the
 * mesh is added straight to the scene and its anchor is driven from his neck.
 * The outline picks up the neon color currently hitting Cole for an edge glow.
 *
 * Every parameter is read live from TUNING.scarf* so the in-app sliders tune it
 * without restart; length/width changes rebuild the ribbon geometry on the fly.
 */
const SCARF_Z = 0.06;

class Scarf {
  readonly mesh: THREE.Mesh;
  private readonly material: THREE.MeshStandardMaterial;
  private geo!: THREE.PlaneGeometry;
  private rows = 0;
  private readonly cols = 2;
  private length = TUNING.scarfLength;
  private width = TUNING.scarfWidth; // half-width
  private segLen = 0;
  private readonly env = { value: new THREE.Color(0, 0, 0) };
  private readonly glow = { value: TUNING.scarfGlow };
  private readonly dirX = { value: 0 };
  private t = 0;
  // Verlet point positions and their previous positions, in world space.
  private x: number[] = [];
  private y: number[] = [];
  private ox: number[] = [];
  private oy: number[] = [];

  constructor() {
    this.material = new THREE.MeshStandardMaterial({
      color: '#ee3333', // bright red; the edge glow reads against it
      roughness: 0.55,
      metalness: 0.1,
      emissive: new THREE.Color('#cc2222'),
      emissiveIntensity: 0.25,
      side: THREE.DoubleSide,
    });
    this.material.onBeforeCompile = (shader) => {
      shader.uniforms.uScarfEnv = this.env;
      shader.uniforms.uScarfGlow = this.glow;
      shader.uniforms.uScarfDirX = this.dirX;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying float vScarfT;\nvarying float vScarfU;')
        .replace(
          '#include <begin_vertex>',
          '#include <begin_vertex>\nvScarfT = uv.y;\nvScarfU = uv.x;',
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          '#include <common>\nvarying float vScarfT;\nvarying float vScarfU;\nuniform vec3 uScarfEnv;\nuniform float uScarfGlow;\nuniform float uScarfDirX;',
        )
        .replace(
          '#include <tonemapping_fragment>',
          `// Directional edge glow: only the side facing the light source
           float bx = uScarfDirX > 0.0
             ? smoothstep(0.40, 0.5, vScarfU - 0.5)
             : smoothstep(0.40, 0.5, 0.5 - vScarfU);
           float border = bx;
           gl_FragColor.rgb += uScarfEnv * border * uScarfGlow;
           #include <tonemapping_fragment>`,
        );
    };

    this.build();
    this.mesh = new THREE.Mesh(this.geo, this.material);
    this.mesh.frustumCulled = false; // vertices are driven well outside the base bounds
  }

  /** (Re)builds the ribbon geometry and verlet points for the current size. */
  private build() {
    const segs = THREE.MathUtils.clamp(Math.round(this.length / 0.062), 6, 28);
    const old = this.geo;
    this.geo = new THREE.PlaneGeometry(this.width * 2, this.length, 1, segs);
    this.rows = segs + 1;
    this.segLen = this.length / (this.rows - 1);
    this.x = [];
    this.y = [];
    this.ox = [];
    this.oy = [];
    for (let i = 0; i < this.rows; i++) {
      this.x[i] = 0;
      this.y[i] = -i * this.segLen;
      this.ox[i] = 0;
      this.oy[i] = this.y[i];
    }
    old?.dispose();
  }

  update(dt: number, anchorX: number, anchorY: number, coleVx: number, env: THREE.Color, dirX: number) {
    this.t += dt;
    this.env.value.copy(env);
    this.glow.value = TUNING.scarfGlow;
    this.dirX.value = dirX;
    if (this.length !== TUNING.scarfLength || this.width !== TUNING.scarfWidth) {
      this.length = TUNING.scarfLength;
      this.width = TUNING.scarfWidth;
      this.build();
      this.mesh.geometry = this.geo;
    }
    const h = Math.min(dt, 1 / 30); // clamp the step so a stall can't explode the sim

    // Pin the top point to the neck.
    this.x[0] = anchorX;
    this.y[0] = anchorY;
    this.ox[0] = anchorX;
    this.oy[0] = anchorY;

    const gravity = -TUNING.scarfGravity;
    const speed = Math.abs(coleVx);
    const windX = -Math.sign(coleVx) * speed * TUNING.scarfWind; // air drags it backward
    const loft = speed * TUNING.scarfLoft; // lifts toward horizontal at speed
    const drag = TUNING.scarfDamping; // air-drag damping
    const flutter = TUNING.scarfFlutter; // gust strength
    for (let i = 1; i < this.rows; i++) {
      const tip = i / (this.rows - 1);
      // Turbulent gusts, stronger toward the free end, plus an always-on breeze.
      const gust = (Math.sin(this.t * 3.2 + i * 0.7) * 0.6 + Math.sin(this.t * 6.4 + i * 1.3) * 0.35) * flutter;
      const breeze = Math.sin(this.t * 1.3 + i * 0.45) * 0.25 * flutter;
      const fx = windX * tip + (gust + breeze) * (0.35 + 0.55 * tip);
      const fy = gravity + loft * tip + gust * 0.35;
      const vx = (this.x[i] - this.ox[i]) * drag;
      const vy = (this.y[i] - this.oy[i]) * drag;
      this.ox[i] = this.x[i];
      this.oy[i] = this.y[i];
      this.x[i] += vx + fx * h * h;
      this.y[i] += vy + fy * h * h;
    }

    // Satisfy segment-length constraints. More passes = stiffer chain that
    // stretches less, which reads as cloth rather than a springy rope.
    const passes = Math.round(TUNING.scarfStiffness);
    for (let pass = 0; pass < passes; pass++) {
      for (let i = 0; i < this.rows - 1; i++) {
        const dx = this.x[i + 1] - this.x[i];
        const dy = this.y[i + 1] - this.y[i];
        const dist = Math.hypot(dx, dy) || 1e-5;
        const diff = (dist - this.segLen) / dist;
        if (i === 0) {
          this.x[i + 1] -= dx * diff;
          this.y[i + 1] -= dy * diff;
        } else {
          this.x[i] += dx * diff * 0.5;
          this.y[i] += dy * diff * 0.5;
          this.x[i + 1] -= dx * diff * 0.5;
          this.y[i + 1] -= dy * diff * 0.5;
        }
      }
    }

    // Lay the ribbon's two edges across each chain point, offset along the
    // local perpendicular so the width stays constant as the cloth bends.
    const pos = this.geo.attributes.position as THREE.BufferAttribute;
    for (let r = 0; r < this.rows; r++) {
      const a = Math.max(0, r - 1);
      const b = Math.min(this.rows - 1, r + 1);
      let tx = this.x[b] - this.x[a];
      let ty = this.y[b] - this.y[a];
      const tl = Math.hypot(tx, ty) || 1;
      tx /= tl;
      ty /= tl;
      const nx = -ty; // perpendicular to the tangent
      const ny = tx;
      for (let c = 0; c < this.cols; c++) {
        const s = (c === 0 ? -1 : 1) * this.width;
        const i = r * this.cols + c;
        pos.setXYZ(i, this.x[r] + nx * s, this.y[r] + ny * s, SCARF_Z);
      }
    }
    pos.needsUpdate = true;
  }
}

// World-space y of Cole's neck, where the scarf hangs from.
const NECK_Y = HEIGHT * 0.695;

export class Player {
  readonly mesh: THREE.Mesh;
  readonly shadowObject: THREE.Mesh;
  x = 0;

  private readonly frames: THREE.Texture[];
  private readonly material: THREE.MeshStandardMaterial;
  private readonly scarf = new Scarf();
  private facing = 1;
  private frame = 0;
  private animTimer = 0;
  private prevX = 0;
  private readonly rimUniforms = {
    uRimColor: { value: new THREE.Color(0, 0, 0) },
    uRimDirX: { value: 0 },
    uRimUp: { value: 0.3 },
    uRimTexel: { value: new THREE.Vector2(1 / SPRITE_W, 1 / SPRITE_H) },
    uSpeed: { value: 0 },
    uLensPos: { value: 0 },
  };
  private lensPos = 0.5;

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

    // Ground shadow
    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = 64;
    shadowCanvas.height = 64;
    const sctx = shadowCanvas.getContext('2d')!;
    const grad = sctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(0,0,0,0.55)');
    grad.addColorStop(0.3, 'rgba(0,0,0,0.30)');
    grad.addColorStop(0.6, 'rgba(0,0,0,0.10)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    sctx.fillStyle = grad;
    sctx.fillRect(0, 0, 64, 64);
    const shadowTex = new THREE.CanvasTexture(shadowCanvas);
    this.shadowObject = new THREE.Mesh(
      new THREE.PlaneGeometry(1.2, 0.35),
      new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0.8 }),
    );
    this.shadowObject.rotation.x = -Math.PI / 2;
    this.shadowObject.position.set(0, 0.02, -4);
    this.shadowObject.renderOrder = -1;
  }

  /** The scarf simulates in world space, so Game adds it to the scene directly. */
  get scarfMesh(): THREE.Mesh {
    return this.scarf.mesh;
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
    this.shadowObject.position.x = this.x;

    // Drive the cloth sim from the neck's world position and Cole's velocity.
    // The rim color is last frame's aggregated neon — a frame's lag is invisible.
    const coleVx = dt > 0 ? (this.x - this.prevX) / dt : 0;
    this.prevX = this.x;
    this.rimUniforms.uSpeed.value = Math.abs(coleVx) / SPEED;
    if (Math.abs(coleVx) > 0.1) {
      this.lensPos -= Math.sign(coleVx) * this.facing * dt * 0.7;
    }
    this.lensPos = ((this.lensPos % 1) + 1) % 1;
    this.rimUniforms.uLensPos.value = this.lensPos;
    this.scarf.update(dt, this.x, NECK_Y + bob, coleVx, this.rimUniforms.uRimColor.value, this.rimUniforms.uRimDirX.value);
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
