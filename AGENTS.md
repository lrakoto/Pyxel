# Working context — EVERYBODY/NOBODY

## Project state (July 2026)

A cyberpunk noir turn-based RPG with a pixel-in-3D (REPLACED-style) visual pipeline.
Walking prototype of Sector 7 street with investigation dialogue, procedural audio,
a state machine, an area transition system, and one enterable interior (Marlon's studio).

The CTB battle system exists but is being converted to a real-time side-scrolling shooter.
That work is in progress on a separate PC and has NOT been pushed to this repo.

## Controls

| Key | Action |
|-----|--------|
| ← → / A D | Walk |
| E | Examine nearby object / advance dialogue / enter doorway |
| Space | Advance dialogue (when open) / dismiss battle stub |
| B | Dev trigger — enter battle stub |
| Enter | Dismiss battle stub |

## Architecture

```
src/
  main.ts — entry point
  core/
    Game.ts — creates renderer, camera, scene, all shared resources, wires up state machine, area registry + transitions
    AudioManager.ts — procedural Web Audio: rain, neon hum, drone, footsteps
    states/
      GameContext.ts — interface for all shared objects + requestAreaTransition callback
      StateMachine.ts — generic state machine with enter/exit/update lifecycle
      ExploreState.ts — exploration (player movement, rain, dialogue, puddles, door prompts, area transitions)
      BattleState.ts — CTB battle state (being replaced by shooter on another branch)
    battle/
      Battle.ts — CTB engine: turn meters, queue, attack/skill/defend, enemy AI
      BattleUI.ts — HTML/CSS battle overlay: portraits, HP bars, turn order, command menu, action log
  world/
    area.ts — AreaWorld/DoorDef interfaces: self-contained scenes with doors, interactions, bounds, exterior flag
    sector7.ts — Sector 7 street: buildings, signs, lights, fog, props, sparkles, pedestrians. buildSector7Area() returns AreaWorld
    studio.ts — Marlon Graves' studio interior: crime scene with walls, floor, Everybody/Nobody painting, easels, neural device, body outline, wall writing. 9 interactables.
    Player.ts — detective Cole: sprite, verlet scarf, wet-rim shader, sunglass reflections, setFacing()/setBounds() for area transitions
    dialogue.ts — DialogueManager with dynamic interaction sets (setInteractions for area swapping)
    Rain.ts — additive line-segment rain streaks (near + far layers)
    RainSplash.ts — ground splash particles cycling near the camera
    puddles.ts — planar mirror puddle system with chromatic edge shift
    props.ts — vending machines, bins, crates, steam vents, sparkle system
    pedestrians.ts — background walkers with umbrellas
    pixelTextures.ts — all procedural texture generation (zero binary assets)
    foreground.ts — utility poles + catenary wires (parallax layer)
    nearground.ts — blurred foreground silhouettes (fake DOF)
  debug/
    tuning.ts — live-tunable scene values
    tuningPanel.ts — dev-only tuning sliders
  style.css — all UI styling (title screen, HUD, dialogue, battle overlay)
```

## Area system

Areas are self-contained scenes that swap via a fade transition. Each AreaWorld has:
- Its own scene, updatables, sign lights, view point
- Doors (proximity triggers that transition to another area)
- Interactions (examinable objects with noir dialogue)
- Exterior flag (controls whether rain/puddles are active)
- Bounds (player movement limits)
- Ambient + camera target

Area registry is in Game.ts: `areaBuilders` maps ids to builder functions. Areas are
cached after first build. Transitions: fade out (0.4s) → swap scene → fade in (0.4s).

Current areas:
- `sector7` — the street (exterior, rain, puddles, neon signs)
- `studio` — Marlon's studio (interior, no rain, flickering work light, crime scene)

## Visual pipeline

- 960x540 fixed internal resolution → CSS `image-rendering: pixelated` upscale
- `depth: false`, `antialias: false` — all sorting by painter's algorithm
- ACESFilmic tone mapping, exposure 1.05
- Post stack: bloom (intensity 1.35, threshold 0.18), chromatic aberration (0.0014/0.0009), film grain (0.42), vignette (offset 0.22, darkness 0.72), lens dirt
- Tone mapping and post-processing applied BEFORE pixelated upscale → smooth HDR bloom on chunky pixels

## Title screen

Cinematic glitch title: cyan/magenta chromatic split layers, drifting scanlines, the
"/" cycles magenta→cyan→purple, subtitle reveals with letter-spacing expansion, copyright
line fades in last. Title stays 4s then fades out. HUD fades in at 3s.

## Recent work (this session)

1. **Area system + Marlon's studio** — built AreaWorld/DoorDef interfaces, refactored
   sector7 and dialogue to support area swapping, built the studio interior (crime scene
   with 9 interactables, procedural textures, flickering light, body outline, the
   Everybody/Nobody painting, neural device, wall writing, easels, workbench, pipes).
2. **Studio visual polish** — 4x detail on the Everybody/Nobody painting (50 fragmented
   faces, neural traces, convergence point), paint-splattered floor, exposed brick walls
   with conduit and baseboards, hanging bare bulb, paint tubes, ceiling beams + pipes,
   stronger iridescent residue, actual rendered wall writing text, painting frame.
3. **Overall visual polish** — cinematic title screen (glitch, scanlines, animated
   subtitle), HUD fade-in + pulsing accent, dialogue box slide-up + typewriter cursor +
   speaker prefix, post-processing mood pass (tighter bloom, deeper vignette, darker
   exposure, stronger CA).

## Next steps (high priority)

### 1. More interiors
The area system is generic. Adding the Memory Den, the Hotel, or any other enterable
building is just a new `build___Area()` function + a door in Sector 7. The story bible
names several key locations.

### 2. Investigation gameplay layer
Interactions are flavor text only. Needs: clue/inventory system (items picked up from
examining objects), case journal (tracks what Cole has found), conditional dialogue
(objects/NPCs that respond differently once you have certain clues). The studio's 9
interactions are already written as investigation beats — they need to DO something.

### 3. NPCs and character dialogue
Lyra is the most important character after Cole. She could appear in the studio or on
the street, with a proper dialogue tree (not just examination text).

### 4. Real sprite art pipeline (roadmap item #5)
All current art is procedural placeholder. The pipeline supports real sprite sheets via
`spriteTexture()` — swap the pixel-map rows for Aseprite exports.

### 5. Audio for interiors
The studio has no audio. Needs its own ambient — low building hum, muffled rain through
walls, neural device electronic pulse.

### 6. Shooter conversion (on another PC)
The CTB battle system is being converted to a real-time side-scrolling shooter. That
work is in progress on a separate PC and has NOT been pushed to this repo. When ready,
push it to GitHub so it can be picked up from any machine.

## Known quirks / things to watch

- **No depth buffer** — `renderer.depth = false`. All draw order is by `renderOrder` /
  painter's algorithm. New objects need explicit ordering.
- **Scarf Z-fighting** — scarf is at z=0.06, very close to the player plane at z=0.
  Works because depth is off, but may clip with future additions.
- **Reflection layer** — puddles use `layers.set(1)` for mirrored rendering. New scene
  objects must be added to layer 1 to appear in puddle reflections (or marked `noReflect`).
- **Key repeat** — `keydown` fires repeatedly while held. The audio init guards against
  this (`!e.repeat`), but the `keys` set does not — keys stay pressed until `keyup`.
- **Dialogue auto-close** — walking away from an interactable while dialogue is open
  closes it. This uses `findNearby()` in the explore state update loop.
- **RenderPass rebuild on area transition** — the EffectComposer's RenderPass is disposed
  and replaced when swapping scenes. If post-processing effects break after a transition,
  check that the new RenderPass is at index 0 in the composer.passes array.
- **Title screen timing** — the title card animates out at 4s. The HUD fades in at 3s.
  If you add more title elements, coordinate the animation delays.