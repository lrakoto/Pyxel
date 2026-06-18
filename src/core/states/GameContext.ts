import * as THREE from 'three';
import type { EffectComposer } from 'postprocessing';
import type { Player } from '../../world/Player';
import type { PuddleSystem } from '../../world/puddles';
import type { Rain } from '../../world/Rain';
import type { RainSplash } from '../../world/RainSplash';
import type { AudioManager } from '../AudioManager';
import type { DialogueManager } from '../../world/dialogue';
import type { Sector7World, Updatable } from '../../world/sector7';

export interface GameContext {
  renderer: THREE.WebGLRenderer;
  composer: EffectComposer;
  camera: THREE.PerspectiveCamera;
  scene: THREE.Scene;
  player: Player;
  playerLight: THREE.PointLight;
  rain: Rain;
  rainFar: Rain;
  splashes: RainSplash;
  puddles: PuddleSystem;
  updatables: Updatable[];
  signLights: THREE.PointLight[];
  world: Sector7World;
  dialogue: DialogueManager;
  audio: AudioManager;
  keys: Set<string>;
  camX: number;
}
