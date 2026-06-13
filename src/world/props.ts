import * as THREE from 'three';
import { canvasTexture } from './pixelTextures';
import type { Updatable } from './sector7';

/**
 * Street-level prop registry. Layout lives here as data, not scattered mesh
 * code, because street level is where gameplay will attach later (doors,
 * NPCs, battle triggers) — editing the street should mean editing this list.
 */
export type PropType = 'vending' | 'bin' | 'crates' | 'steam' | 'puddle' | 'manhole';

export interface PropSpec {
  type: PropType;
  x: number;
  /** Neon accent for props that glow (vending screens, puddle reflections). */
  hue?: string;
}

/**
 * Toggle: soft additive glow pools under the signs. Sits alongside the
 * mirror puddles in puddles.ts — turn off to judge the reflections alone.
 */
export const PUDDLE_GLOW = true;

export const STREET_PROPS: PropSpec[] = [
  { type: 'vending', x: -11.2, hue: '#36e0ff' },
  { type: 'vending', x: 6.7, hue: '#ff3da0' },
  { type: 'bin', x: -4.5 },
  { type: 'bin', x: 14.5 },
  { type: 'crates', x: 12.3 },
  { type: 'steam', x: -7 },
  { type: 'steam', x: 9.5 },
  // puddles sit under the signs and shimmer in their color
  { type: 'puddle', x: -9.5, hue: '#36e0ff' },
  { type: 'puddle', x: 2.5, hue: '#ff3da0' },
  { type: 'puddle', x: 10, hue: '#ffb03a' },
  { type: 'manhole', x: 0.8 },
];

const PROP_Z = -6.5;

/** Gradient sprites (steam, puddles) want smooth filtering, unlike pixel art. */
function smoothTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  draw(canvas.getContext('2d')!);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function vendingTexture(hue: string): THREE.CanvasTexture {
  return canvasTexture(20, 40, (ctx) => {
    ctx.fillStyle = '#161d2a';
    ctx.fillRect(0, 0, 20, 40);
    ctx.fillStyle = '#0c1018';
    ctx.fillRect(0, 0, 20, 2);
    ctx.fillRect(0, 37, 20, 3);
    // glowing header panel
    ctx.fillStyle = hue;
    ctx.fillRect(3, 4, 14, 7);
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = 0.7;
    ctx.fillRect(4, 6, 12, 2);
    ctx.globalAlpha = 1;
    // item windows
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 4; col++) {
        ctx.fillStyle = Math.random() < 0.7 ? '#2a3850' : '#11161f';
        ctx.fillRect(3 + col * 4, 14 + row * 5, 3, 4);
      }
    }
    // dispense slot
    ctx.fillStyle = '#0a0d13';
    ctx.fillRect(4, 31, 12, 4);
  });
}

function binTexture(): THREE.CanvasTexture {
  return canvasTexture(12, 14, (ctx) => {
    ctx.fillStyle = '#1c222c';
    ctx.fillRect(1, 2, 10, 12);
    ctx.fillStyle = '#252d3a';
    ctx.fillRect(0, 0, 12, 2);
    ctx.fillStyle = '#10141b';
    ctx.fillRect(2, 6, 8, 1);
    ctx.fillRect(2, 10, 8, 1);
  });
}

function cratesTexture(): THREE.CanvasTexture {
  return canvasTexture(18, 16, (ctx) => {
    const crate = (x: number, y: number, s: number) => {
      ctx.fillStyle = '#231f1a';
      ctx.fillRect(x, y, s, s);
      ctx.strokeStyle = '#33291f';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, s - 1, s - 1);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + s, y + s);
      ctx.stroke();
    };
    crate(0, 7, 9);
    crate(9, 8, 8);
    crate(4, 0, 8);
  });
}

function manholeTexture(): THREE.CanvasTexture {
  return canvasTexture(16, 16, (ctx) => {
    ctx.fillStyle = '#0d1016';
    ctx.beginPath();
    ctx.arc(8, 8, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1d242f';
    ctx.stroke();
    ctx.fillStyle = '#161b24';
    ctx.fillRect(4, 7, 8, 1);
    ctx.fillRect(7, 4, 1, 8);
  });
}

function puddleTexture(hue: string): THREE.CanvasTexture {
  return smoothTexture(64, 32, (ctx) => {
    const g = ctx.createRadialGradient(32, 16, 2, 32, 16, 30);
    g.addColorStop(0, hue);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 32);
  });
}

function steamPuffTexture(): THREE.CanvasTexture {
  return smoothTexture(32, 32, (ctx) => {
    const g = ctx.createRadialGradient(16, 16, 2, 16, 16, 15);
    g.addColorStop(0, 'rgba(190, 205, 225, 0.55)');
    g.addColorStop(1, 'rgba(190, 205, 225, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 32, 32);
  });
}

/** Looping wisps rising from a street vent. */
class SteamVent implements Updatable {
  readonly group = new THREE.Group();
  private readonly puffs: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; phase: number; speed: number }[] = [];
  private t = Math.random() * 10;

  constructor(tex: THREE.Texture) {
    for (let i = 0; i < 5; i++) {
      const mat = new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.7), mat);
      this.group.add(mesh);
      this.puffs.push({ mesh, mat, phase: i / 5, speed: 0.28 + Math.random() * 0.1 });
    }
  }

  update(dt: number) {
    this.t += dt;
    for (const p of this.puffs) {
      const s = (this.t * p.speed + p.phase) % 1;
      p.mesh.position.set(Math.sin(s * 7 + p.phase * 20) * 0.1, 0.2 + s * 1.7, 0);
      p.mesh.scale.setScalar(0.6 + s * 1.4);
      p.mat.opacity = Math.sin(s * Math.PI) * 0.26;
    }
  }
}

/** Flat additive glow on the asphalt that shimmers in a sign's color. */
class Puddle implements Updatable {
  readonly mesh: THREE.Mesh;
  private readonly mat: THREE.MeshBasicMaterial;
  private t = Math.random() * 10;

  constructor(hue: string) {
    this.mat = new THREE.MeshBasicMaterial({
      map: puddleTexture(hue),
      transparent: true,
      opacity: 0.22,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1), this.mat);
    this.mesh.rotation.x = -Math.PI / 2;
  }

  update(dt: number) {
    this.t += dt;
    this.mat.opacity = 0.2 + Math.sin(this.t * 1.3) * 0.05 + Math.sin(this.t * 3.7) * 0.02;
  }
}

export interface SparkleOptions {
  size?: number;
  maxOpacity?: number;
  /** Scales reflected energy into sparkle brightness. */
  lightScale?: number;
  /** Base surface normal for the set (ground = up, sills = facing camera…). */
  normal?: THREE.Vector3;
  /** Micro-facet spread: how far each fleck's facet tilts off the base normal. */
  jitter?: number;
  /** Specular exponent — higher = tighter, rarer, brighter alignments. */
  shininess?: number;
}

const SPARKLE_WHITE = new THREE.Color('#ffffff');
const UP = new THREE.Vector3(0, 1, 0);
const _normal = new THREE.Vector3();
const _toLight = new THREE.Vector3();
const _reflected = new THREE.Vector3();
const _toCam = new THREE.Vector3();

/**
 * Specular glints, physically modeled: every fleck is a micro-facet with a
 * fixed random tilt off the surface normal. Each frame it reflects every
 * point light off its facet and lights up only when the bounce aims at the
 * camera — so glints flash as the camera tracks, take the color of the light
 * they reflect, dim when their sign flickers, and hold steady (with a faint
 * rain-ripple wobble) when the view is still. No random twinkle.
 */
export class Sparkles implements Updatable {
  readonly group = new THREE.Group();
  private readonly items: {
    pos: THREE.Vector3;
    facet: THREE.Vector3;
    mat: THREE.MeshBasicMaterial;
    phase: number;
    wobble: number;
  }[] = [];
  private readonly maxOpacity: number;
  private readonly lightScale: number;
  private readonly shininess: number;
  private t = 0;

  constructor(
    points: THREE.Vector3[],
    private readonly lights: THREE.PointLight[],
    private readonly viewPoint: THREE.Vector3,
    opts: SparkleOptions = {},
  ) {
    this.maxOpacity = opts.maxOpacity ?? 0.9;
    this.lightScale = opts.lightScale ?? 0.6;
    this.shininess = opts.shininess ?? 140;
    this.group.userData.noReflect = true;
    const base = opts.normal ?? UP;
    const jitter = opts.jitter ?? 0.25;
    const size = opts.size ?? 0.07;
    const geo = new THREE.PlaneGeometry(size, size * 0.45);
    for (const p of points) {
      const mat = new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(p);
      this.group.add(mesh);
      const facet = base
        .clone()
        .add(
          new THREE.Vector3(
            (Math.random() - 0.5) * jitter,
            (Math.random() - 0.5) * jitter,
            (Math.random() - 0.5) * jitter,
          ),
        )
        .normalize();
      this.items.push({
        pos: mesh.position,
        facet,
        mat,
        phase: Math.random() * 10,
        wobble: 0.3 + Math.random() * 0.6,
      });
    }
  }

  update(dt: number) {
    this.t += dt;
    for (const it of this.items) {
      // faint ripple: rain perturbs the facet slightly over time
      _normal
        .set(
          it.facet.x + Math.sin(this.t * it.wobble + it.phase) * 0.02,
          it.facet.y,
          it.facet.z + Math.cos(this.t * it.wobble * 0.7 + it.phase) * 0.02,
        )
        .normalize();
      _toCam.copy(this.viewPoint).sub(it.pos).normalize();

      let r = 0;
      let g = 0;
      let b = 0;
      let total = 0;
      for (const light of this.lights) {
        _toLight.copy(light.position).sub(it.pos);
        const d2 = Math.max(1, _toLight.lengthSq());
        _toLight.normalize();
        const ndl = _normal.dot(_toLight);
        if (ndl <= 0) continue;
        _reflected.copy(_normal).multiplyScalar(2 * ndl).sub(_toLight);
        const align = _reflected.dot(_toCam);
        if (align <= 0) continue;
        const spec = align ** this.shininess;
        if (spec < 0.001) continue;
        const w = (light.intensity / d2) * spec;
        r += light.color.r * w;
        g += light.color.g * w;
        b += light.color.b * w;
        total += w;
      }
      it.mat.opacity = Math.min(1, total * this.lightScale) * this.maxOpacity;
      if (total > 0.0001) {
        const peak = Math.max(r, g, b);
        it.mat.color.setRGB(r / peak, g / peak, b / peak).lerp(SPARKLE_WHITE, 0.35);
      }
    }
  }
}

function flatProp(tex: THREE.Texture, w: number, h: number): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.4, roughness: 0.85 }),
  );
  mesh.position.y = h / 2;
  return mesh;
}

export interface StreetProps {
  updatables: Updatable[];
  /** Glowing prop lights, fed into the player's wet-rim shader. */
  lights: THREE.PointLight[];
  /** Sparkle anchor points on top of the props (built in sector7 once all lights exist). */
  propTops: THREE.Vector3[];
}

export function buildStreetProps(scene: THREE.Scene): StreetProps {
  const updatables: Updatable[] = [];
  const lights: THREE.PointLight[] = [];
  const steamTex = steamPuffTexture();
  const propTops: THREE.Vector3[] = [];

  for (const spec of STREET_PROPS) {
    switch (spec.type) {
      case 'vending': {
        const hue = spec.hue ?? '#36e0ff';
        const group = new THREE.Group();
        group.add(flatProp(vendingTexture(hue), 0.85, 1.7));
        const screen = new THREE.Mesh(
          new THREE.PlaneGeometry(0.6, 0.3),
          new THREE.MeshBasicMaterial({ color: hue }),
        );
        screen.position.set(0, 1.37, 0.01);
        group.add(screen);
        group.position.set(spec.x, 0, PROP_Z);
        scene.add(group);
        // Scene-level so its world position feeds the rim shader directly.
        const light = new THREE.PointLight(hue, 3, 5, 2);
        light.position.set(spec.x, 1.2, PROP_Z + 0.8);
        scene.add(light);
        lights.push(light);
        propTops.push(new THREE.Vector3(spec.x - 0.2, 1.74, PROP_Z + 0.05));
        break;
      }
      case 'bin': {
        const mesh = flatProp(binTexture(), 0.55, 0.65);
        mesh.position.x = spec.x;
        mesh.position.z = PROP_Z;
        scene.add(mesh);
        propTops.push(new THREE.Vector3(spec.x + 0.1, 0.66, PROP_Z + 0.05));
        break;
      }
      case 'crates': {
        const mesh = flatProp(cratesTexture(), 0.95, 0.85);
        mesh.position.x = spec.x;
        mesh.position.z = PROP_Z;
        scene.add(mesh);
        propTops.push(new THREE.Vector3(spec.x + 0.15, 0.86, PROP_Z + 0.05));
        break;
      }
      case 'steam': {
        const vent = new SteamVent(steamTex);
        vent.group.position.set(spec.x, 0, PROP_Z + 1.5);
        vent.group.userData.noReflect = true;
        scene.add(vent.group);
        updatables.push(vent);
        break;
      }
      case 'puddle': {
        if (!PUDDLE_GLOW) break;
        const puddle = new Puddle(spec.hue ?? '#36e0ff');
        puddle.mesh.position.set(spec.x, 0.012, PROP_Z + 1);
        puddle.mesh.userData.noReflect = true;
        scene.add(puddle.mesh);
        updatables.push(puddle);
        break;
      }
      case 'manhole': {
        const mesh = new THREE.Mesh(
          new THREE.PlaneGeometry(1.1, 1.1),
          new THREE.MeshStandardMaterial({ map: manholeTexture(), transparent: true, alphaTest: 0.4, roughness: 0.6 }),
        );
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(spec.x, 0.01, PROP_Z + 2);
        scene.add(mesh);
        break;
      }
    }
  }

  return { updatables, lights, propTops };
}
