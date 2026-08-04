import * as THREE from 'three';
import type { EffectComposer } from 'postprocessing';
import type { Player } from '../../world/Player';
import type { PuddleSystem } from '../../world/puddles';
import type { Rain } from '../../world/Rain';
import type { RainSplash } from '../../world/RainSplash';
import type { AudioManager } from '../AudioManager';
import type { DialogueManager } from '../../world/dialogue';
import type { Updatable } from '../../world/sector7';
import type { AreaWorld } from '../../world/area';
import type { InteractionDef } from '../../world/dialogue';
import type { Journal } from '../investigation/Journal';
import type { JournalUI } from '../investigation/JournalUI';
import type { ClueToast } from '../investigation/ClueToast';

export interface GameContext {
  renderer: THREE.WebGLRenderer;
  composer: EffectComposer;
  camera: THREE.PerspectiveCamera;
  /** The currently active scene (swapped on area transition). */
  scene: THREE.Scene;
  player: Player;
  playerLight: THREE.PointLight;
  rain: Rain;
  rainFar: Rain;
  splashes: RainSplash;
  puddles: PuddleSystem;
  /** Per-frame updatables for the active area. */
  updatables: Updatable[];
  /** Neon/sign lights for the active area, fed into the player's wet-rim shader. */
  signLights: THREE.PointLight[];
  /** The active area. */
  area: AreaWorld;
  dialogue: DialogueManager;
  audio: AudioManager;
  keys: Set<string>;
  camX: number;
  /** Cole's case journal — collected clues + current objective. */
  journal: Journal;
  /** Journal overlay UI — checked so states can ignore clicks while it's open. */
  journalUI: JournalUI;
  /** Transient "evidence added" notification. */
  clueToast: ClueToast;
  /** Resolve the correct line set for an interaction given clue state. */
  resolveLines: (def: InteractionDef) => string[];
  /** Request a transition to a new area. Called by ExploreState on door entry. */
  requestAreaTransition: (targetId: string, spawnX: number, spawnFacing?: number) => void;
}