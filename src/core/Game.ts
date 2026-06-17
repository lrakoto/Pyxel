import * as THREE from 'three';
import {
  BlendFunction,
  BloomEffect,
  ChromaticAberrationEffect,
  EffectComposer,
  EffectPass,
  NoiseEffect,
  RenderPass,
  TextureEffect,
  VignetteEffect,
} from 'postprocessing';
import { Player } from '../world/Player';
import { PuddleSystem } from '../world/puddles';
import { Rain } from '../world/Rain';
import { RainSplash } from '../world/RainSplash';
import { AudioManager } from './AudioManager';
import { DialogueManager } from '../world/dialogue';
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
  private readonly splashes: RainSplash;
  private readonly puddles: PuddleSystem;
  private readonly updatables: Updatable[];
  private readonly signLights: THREE.PointLight[];
  private readonly world: Sector7World;
  private readonly dialogue: DialogueManager;
  private readonly audio: AudioManager;
  private audioReady = false;
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
    this.scene.add(this.player.shadowObject);
    this.scene.add(this.player.mesh);
    this.scene.add(this.player.scarfMesh); // sim runs in world space, not parented
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

    this.splashes = new RainSplash();
    this.scene.add(this.splashes.group);

    this.dialogue = new DialogueManager();
    this.audio = new AudioManager();

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
      luminanceThreshold: 0.15,
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

    // Procedural lens dirt: dust specks and faint scratches on a dark canvas
    const dirtCanvas = document.createElement('canvas');
    dirtCanvas.width = 256;
    dirtCanvas.height = 256;
    const dirtCtx = dirtCanvas.getContext('2d')!;
    dirtCtx.fillStyle = '#ffffff';
    dirtCtx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 60; i++) {
      const s = 1 + Math.random() * 8;
      dirtCtx.fillStyle = `rgba(0,0,0,${0.02 + Math.random() * 0.12})`;
      dirtCtx.beginPath();
      dirtCtx.arc(Math.random() * 256, Math.random() * 256, s, 0, Math.PI * 2);
      dirtCtx.fill();
    }
    for (let i = 0; i < 15; i++) {
      dirtCtx.strokeStyle = `rgba(0,0,0,${0.03 + Math.random() * 0.08})`;
      dirtCtx.lineWidth = 0.5 + Math.random() * 1.5;
      dirtCtx.beginPath();
      dirtCtx.moveTo(Math.random() * 256, Math.random() * 256);
      dirtCtx.lineTo(Math.random() * 256, Math.random() * 256);
      dirtCtx.stroke();
    }
    const dirtTex = new THREE.CanvasTexture(dirtCanvas);
    const lensDirt = new TextureEffect({
      texture: dirtTex,
      blendFunction: BlendFunction.MULTIPLY,
    });
    lensDirt.blendMode.opacity.value = 0.15;

    this.composer.addPass(new EffectPass(this.camera, bloom, chroma, grain, vignette, lensDirt));
    this.composer.setSize(VIEW_W, VIEW_H);

    window.addEventListener('keydown', (e) => {
      if (!this.audioReady && !e.repeat) {
        this.audioReady = true;
        this.audio.init();
      }
      this.keys.add(e.code);
    });
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

    // Dialogue input takes priority — freezes movement while open
    if (this.dialogue.isOpen) {
      if (this.keys.has('KeyE') || this.keys.has('Space')) {
        this.keys.delete('KeyE');
        this.keys.delete('Space');
        this.dialogue.advance();
      }
      // Close if player walks out of range
      const nearby = this.dialogue.findNearby(this.player.x);
      if (!nearby) this.dialogue.close();
    } else {
      this.player.update(dt, {
        left: this.keys.has('ArrowLeft') || this.keys.has('KeyA'),
        right: this.keys.has('ArrowRight') || this.keys.has('KeyD'),
      });
      this.playerLight.position.set(this.player.x + 0.4, 2.3, 2.2);
      this.player.updateRim(this.signLights);
      this.rain.update(dt, this.camX);
      this.rainFar.update(dt, 0);
      this.splashes.update(dt, this.camX);
      for (const u of this.updatables) u.update(dt);

      this.camX += (this.player.x * 0.9 - this.camX) * Math.min(1, dt * 3);
      this.camera.position.x = this.camX;
      this.camera.lookAt(this.camX, 2.0, 0);
      this.world.viewPoint.copy(this.camera.position);

      // Interaction proximity
      const nearby = this.dialogue.findNearby(this.player.x);
      const hintEl = document.getElementById('interact-hint')!;
      if (nearby) {
        hintEl.style.display = 'block';
        if (this.keys.has('KeyE')) {
          this.keys.delete('KeyE');
          this.dialogue.openDialogue(nearby);
          hintEl.style.display = 'none';
        }
      } else {
        hintEl.style.display = 'none';
      }
    }

    // Dialogue typewriter effect
    this.dialogue.update(dt);

    // Audio
    const walking = this.keys.has('ArrowLeft') || this.keys.has('KeyA')
                 || this.keys.has('ArrowRight') || this.keys.has('KeyD');
    this.audio.update(dt, walking);

    this.puddles.update(this.camera, dt);
    this.puddles.render(this.renderer, this.scene);
    this.composer.render(dt);
  }
}
