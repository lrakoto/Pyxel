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
import { buildSector7 } from '../world/sector7';
import { StateMachine } from './states/StateMachine';
import { ExploreState } from './states/ExploreState';
import type { GameContext } from './states/GameContext';

const VIEW_W = 960;
const VIEW_H = 540;

export class Game {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly composer: EffectComposer;
  private readonly ctx: GameContext;
  private readonly state: StateMachine;
  private audioReady = false;
  private readonly clock = new THREE.Clock();

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

    const camera = new THREE.PerspectiveCamera(38, VIEW_W / VIEW_H, 0.1, 200);
    camera.position.set(0, 2.4, 16);

    const world = buildSector7();
    const scene = world.scene;

    const player = new Player();
    scene.add(player.shadowObject);
    scene.add(player.mesh);
    scene.add(player.scarfMesh);
    const playerLight = new THREE.PointLight('#7e9bd0', 10, 9, 2);
    scene.add(playerLight);

    const rain = new Rain();
    scene.add(rain.object);
    const rainFar = new Rain({
      count: 320, top: 26, spanX: 95, zMin: -65, zMax: -34,
      velX: -1, velY: -5.5, tail: 0.09, opacity: 0.15,
    });
    scene.add(rainFar.object);
    rain.object.userData.noReflect = true;
    rainFar.object.userData.noReflect = true;

    const splashes = new RainSplash();
    scene.add(splashes.group);

    const dialogue = new DialogueManager();
    const audio = new AudioManager();
    const keys = new Set<string>();

    const puddles = new PuddleSystem();
    scene.add(puddles.group);
    puddles.markReflectables(scene);

    this.composer = new EffectComposer(this.renderer, {
      frameBufferType: THREE.HalfFloatType,
    });
    this.composer.addPass(new RenderPass(scene, camera));
    const bloom = new BloomEffect({
      intensity: 1.15, luminanceThreshold: 0.15,
      luminanceSmoothing: 0.3, mipmapBlur: true,
    });
    const chroma = new ChromaticAberrationEffect({
      offset: new THREE.Vector2(0.0011, 0.0007),
      radialModulation: true, modulationOffset: 0.25,
    });
    const grain = new NoiseEffect({
      blendFunction: BlendFunction.COLOR_DODGE, premultiply: true,
    });
    grain.blendMode.opacity.value = 0.5;
    const vignette = new VignetteEffect({ offset: 0.28, darkness: 0.62 });

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
      texture: dirtTex, blendFunction: BlendFunction.MULTIPLY,
    });
    lensDirt.blendMode.opacity.value = 0.15;
    this.composer.addPass(new EffectPass(camera, bloom, chroma, grain, vignette, lensDirt));
    this.composer.setSize(VIEW_W, VIEW_H);

    // Build the shared game context
    this.ctx = {
      renderer: this.renderer,
      composer: this.composer,
      camera,
      scene,
      player,
      playerLight,
      rain,
      rainFar,
      splashes,
      puddles,
      updatables: world.updatables,
      signLights: world.signLights,
      world,
      dialogue,
      audio,
      keys,
      camX: 0,
    };

    this.state = new StateMachine(this.ctx);
    this.state.transition(new ExploreState());

    window.addEventListener('keydown', (e) => {
      if (!this.audioReady && !e.repeat) {
        this.audioReady = true;
        this.ctx.audio.init();
      }
      this.ctx.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.ctx.keys.delete(e.code));
    window.addEventListener('resize', () => this.fitCanvas());
    this.fitCanvas();

    this.renderer.setAnimationLoop(() => this.tick());
  }

  private fitCanvas() {
    const scale = Math.min(window.innerWidth / VIEW_W, window.innerHeight / VIEW_H);
    const canvas = this.renderer.domElement;
    canvas.style.width = `${Math.floor(VIEW_W * scale)}px`;
    canvas.style.height = `${Math.floor(VIEW_H * scale)}px`;
  }

  private tick() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.state.update(dt);
    this.composer.render(dt);
  }
}
