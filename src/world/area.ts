import * as THREE from 'three';
import type { Updatable } from './sector7';
import type { InteractionDef } from './dialogue';

/**
 * A doorway connecting two areas. When the player walks within `radius` of
 * the door's world position, an "E — enter" prompt appears. Pressing E triggers
 * a fade transition to `target` area, spawning the player at `spawnX`.
 */
export interface DoorDef {
  /** Door trigger x in world space (same coordinate space as the player). */
  x: number;
  /** Door trigger z (depth, for future use — currently unused in proximity). */
  z: number;
  /** Proximity trigger radius. */
  radius: number;
  /** Prompt label, e.g. "Enter Marlon's Studio". */
  label: string;
  /** Target area id, e.g. "studio". */
  target: string;
  /** Where to place the player in the target area. */
  spawnX: number;
  /** Optional facing on arrival: 1 = right, -1 = left. */
  spawnFacing?: number;
}

/**
 * A self-contained playable area: its own scene, updatables, lights, doors,
 * and interactables. The game swaps the active area (with a fade transition)
 * when the player enters a door. Exterior areas keep rain/puddles alive;
 * interior areas disable them.
 */
export interface AreaWorld {
  /** Unique area id, e.g. "sector7", "studio". */
  id: string;
  /** Display name shown in the HUD location bar. */
  displayName: string;
  /** The Three.js scene for this area. */
  scene: THREE.Scene;
  /** Per-frame updatables (neon flicker, steam, sparkles, etc.). */
  updatables: Updatable[];
  /** Neon/sign point lights, fed into the player's wet-rim shader. */
  signLights: THREE.PointLight[];
  /** Camera world position, copied in by the game loop each frame. */
  viewPoint: THREE.Vector3;
  /** Doors that lead out of this area. */
  doors: DoorDef[];
  /** Interactable objects in this area. */
  interactions: InteractionDef[];
  /** Whether exterior effects (rain, rain splash, puddles) are active. */
  exterior: boolean;
  /** Ambient light color and intensity for this area. */
  ambient: { color: string; intensity: number };
  /** World bounds for player movement. */
  bounds: { min: number; max: number };
  /** Camera look-at target. */
  cameraTarget: { y: number; z: number };
  /**
   * Optional hook fired by the game whenever a clue is added to the
   * journal while this area is active. Areas use it to react to case
   * progress — e.g. Sector 7 reveals Lyra once the studio case closes.
   */
  onClueAdded?: (clueId: string) => void;
  /**
   * Optional hook fired when this area becomes active (after a
   * transition). Lets areas sync their state to the current journal
   * — e.g. show Lyra if the gating clue was already collected earlier.
   */
  onEnter?: (hasClue: (id: string) => boolean) => void;
}

/** Registry of all area builders. Game.ts populates this and looks up by id. */
export type AreaBuilder = () => AreaWorld;