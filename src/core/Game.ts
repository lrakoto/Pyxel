import * as THREE from 'three';
import {
  BlendFunction,
  BloomEffect,
  ChromaticAberrationEffect,
  EffectComposer,
  EffectPass,
  NoiseEffect,
  RenderPass,
  VignetteEffect,
} from 'postprocessing';
import { Player } from '../world/Player';
import { PuddleSystem } from '../world/puddles';
import { Rain } from '../world/Rain';
import { buildSector7, type Sector7World, type Updatable } from '../world/sector7';

// The frame is rendered at a fixed low resolution, then upscaled with
// image-rendering: pixelated — that mix of chunky pixels and smooth HDR
// lighting/bloom is the core of the REPLACED-style look.
// 960×540 scales 2× to 1080p and 4× to 4K with no shimmer.
const VIEW_W = 960;
const VIEW_H = 540;

export class Game {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly composer: EffectComposer;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly scene: THREE.Scene;
  private readonly player: Player;
  private readonly playerLight: THREE.PointLight;
  private readonly rain: Rain;
  private readonly rainFar: Rain;
  private readonly puddles: PuddleSystem;
  private readonly updatables: Updatable[];
  private readonly signLights: THREE.PointLight[];
  private readonly world: Sector7World;
  private readonly keys = new Set<string>();
  private readonly clock = new THREE.Clock();
  private camX = 0;

  constructor(container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({
      antialias: false,
      stencil: false,
      depth: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(VIEW_W, VIEW_H, false);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(38, VIEW_W / VIEW_H, 0.1, 200);
    this.camera.position.set(0, 2.4, 16);

    const world = buildSector7();
    this.world = world;
    this.scene = world.scene;
    this.updatables = world.updatables;
    this.signLights = world.signLights;

    this.player = new Player();
    this.scene.add(this.player.mesh);
    // Soft fill that follows Cole so the sprite stays readable in deep shadow.
    this.playerLight = new THREE.PointLight('#7e9bd0', 10, 9, 2);
    this.scene.add(this.playerLight);

    this.rain = new Rain();
    this.scene.add(this.rain.object);
    // Slow sparse drizzle deep in the scene, in front of the painted skyline.
    this.rainFar = new Rain({
      count: 320,
      top: 26,
      spanX: 95,
      zMin: -65,
      zMax: -34,
      velX: -1,
      velY: -5.5,
      tail: 0.09,
      opacity: 0.15,
    });
    this.scene.add(this.rainFar.object);
    this.rain.object.userData.noReflect = true;
    this.rainFar.object.userData.noReflect = true;

    // Mirror puddles: marked last so the reflection layer covers the whole
    // assembled scene (buildings, signs, props, Cole, lights).
    this.puddles = new PuddleSystem();
    this.scene.add(this.puddles.group);
    this.puddles.markReflectables(this.scene);

    this.composer = new EffectComposer(this.renderer, {
      frameBufferType: THREE.HalfFloatType,
    });
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    const bloom = new BloomEffect({
      intensity: 1.15,
      luminanceThreshold: 0.22,
      luminanceSmoothing: 0.3,
      mipmapBlur: true,
    });
    const chroma = new ChromaticAberrationEffect({
      offset: new THREE.Vector2(0.0011, 0.0007),
      radialModulation: true,
      modulationOffset: 0.25,
    });
    const grain = new NoiseEffect({
      blendFunction: BlendFunction.COLOR_DODGE,
      premultiply: true,
    });
    grain.blendMode.opacity.value = 0.5;
    const vignette = new VignetteEffect({ offset: 0.28, darkness: 0.62 });
    this.composer.addPass(new EffectPass(this.camera, bloom, chroma, grain, vignette));
    this.composer.setSize(VIEW_W, VIEW_H);

    window.addEventListener('keydown', (e) => this.keys.add(e.code));
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('resize', () => this.fitCanvas());
    this.fitCanvas();

    this.renderer.setAnimationLoop(() => this.tick());
  }

  /** Scales the fixed-resolution canvas to fit the window, letterboxed. */
  private fitCanvas() {
    const scale = Math.min(window.innerWidth / VIEW_W, window.innerHeight / VIEW_H);
    const canvas = this.renderer.domElement;
    canvas.style.width = `${Math.floor(VIEW_W * scale)}px`;
    canvas.style.height = `${Math.floor(VIEW_H * scale)}px`;
  }

  private tick() {
    const dt = Math.min(this.clock.getDelta(), 0.05);

    this.player.update(dt, {
      left: this.keys.has('ArrowLeft') || this.keys.has('KeyA'),
      right: this.keys.has('ArrowRight') || this.keys.has('KeyD'),
    });
    this.playerLight.position.set(this.player.x + 0.4, 2.3, 2.2);
    this.player.updateRim(this.signLights);
    this.rain.update(dt, this.camX);
    this.rainFar.update(dt, 0);
    for (const u of this.updatables) u.update(dt);

    this.camX += (this.player.x * 0.9 - this.camX) * Math.min(1, dt * 3);
    this.camera.position.x = this.camX;
    this.camera.lookAt(this.camX, 2.0, 0);
    this.world.viewPoint.copy(this.camera.position);

    this.puddles.update(this.camera, dt);
    this.puddles.render(this.renderer, this.scene);
    this.composer.render(dt);
  }
}
