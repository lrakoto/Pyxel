# Working context — EVERYBODY/NOBODY

## Project state (August 2026)

A cyberpunk noir turn-based RPG with a pixel-in-3D (REPLACED-style) visual pipeline.
Walking prototype of Sector 7 street with investigation dialogue, procedural audio,
a state machine, an area transition system, and one enterable interior (Marlon's studio).

The investigation layer now exists: glint-marked investigation mode, evidence clues,
a case journal overlay, and clue-conditional re-examination.

The CTB battle system exists but is being converted to a real-time side-scrolling shooter.
That work is in progress on a separate PC and has NOT been pushed to this repo.

## Controls

| Key | Action |
|-----|--------|
| ← → / A D | Walk |
| E | Enter investigation mode (near object) / examine / enter doorway / advance dialogue |
| I / Esc | Exit investigation mode |
| Space | Advance dialogue (when open) / dismiss battle stub |
| J / Tab | Case journal overlay (pauses game) |
| Click/tap glint | Walk to + auto-examine on arrival (investigation mode) |
| Click/tap ground | Walk there (investigation mode) |
| [ / ] | Cycle focus between glints (investigation mode) |
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
      ExploreState.ts — exploration (player movement, rain, dialogue, puddles, door prompts, area transitions, E → investigation mode)
      InvestigateState.ts — investigation mode: pulsing glints on examinables, click/tap-to-walk selection, clue grant on examine, camera pull-in
      BattleState.ts — CTB battle state (being replaced by shooter on another branch)
    investigation/
      Clue.ts — ClueDef (id, title, journal body)
      Journal.ts — collected clues + case objective that evolves on key clues
      JournalUI.ts — full-screen case-file overlay (J/Tab/Esc, pauses world)
      ClueToast.ts — transient "EVIDENCE ADDED" notification
    battle/
      Battle.ts — CTB engine: turn meters, queue, attack/skill/defend, enemy AI
      BattleUI.ts — HTML/CSS battle overlay: portraits, HP bars, turn order, command menu, action log
  world/
    area.ts — AreaWorld/DoorDef interfaces: self-contained scenes with doors, interactions, bounds, exterior flag
    sector7.ts — Sector 7 street: buildings, signs, lights, fog, props, sparkles, pedestrians. buildSector7Area() returns AreaWorld
    studio.ts — Marlon Graves' studio interior: crime scene with walls, floor, Everybody/Nobody painting, easels, neural device, body outline, wall writing. 9 interactables.
    Player.ts — detective Cole: sprite, verlet scarf, wet-rim shader, sunglass reflections, setFacing()/setBounds() for area transitions
    dialogue.ts — DialogueManager with dynamic interaction sets (setInteractions for area swapping) + clue-conditional line resolution
    glint.ts — pulsing additive sparkle marking examinables in investigation mode
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

1. **Investigation gameplay layer** — new `InvestigateState`: press I (or E near an
   object) to enter investigation mode; examinables pulse with additive cyan glints;
   walk or click/tap to move between them; E examines. Examining grants evidence
   clues (journal entry + "EVIDENCE ADDED" toast) via the new `core/investigation`
   module (Clue, Journal, JournalUI, ClueToast). Journal overlay (J/Tab) pauses the
   world with a case-file layout: evolving objective + collected evidence. Interactions
   now support `clueId`/`clueTitle`/`clueBody`, `repeatLines` (re-examines), and
   `requiresClue`/`conditionalLines` (insight that appears once related evidence is
   held). 8 clues + 5 conditional reveals wired into the studio (painting↔wall-writing,
   device↔wall-writing, body↔device, canvases↔unfinished-woman, wall-writing↔residue).
   Investigation-mode polish: click-to-walk ground picking, hover cursor/pulse feedback,
   auto-examine on arrival, ambient audio duck, radial examine vignette, [/] glint
   cycling, discovery chime (staggered 660→990 Hz pings as new glints enter view),
   and a studio case conclusion beat (all 7 clues → scene closed, objective resolves,
   door interaction re-writes itself).
2. **Area system + Marlon's studio** — built AreaWorld/DoorDef interfaces, refactored
   sector7 and dialogue to support area swapping, built the studio interior (crime scene
   with 9 interactables, procedural textures, flickering light, body outline, the
   Everybody/Nobody painting, neural device, wall writing, easels, workbench, pipes).
3. **Studio visual polish** — 4x detail on the Everybody/Nobody painting (50 fragmented
   faces, neural traces, convergence point), paint-splattered floor, exposed brick walls
   with conduit and baseboards, hanging bare bulb, paint tubes, ceiling beams + pipes,
   stronger iridescent residue, actual rendered wall writing text, painting frame.
4. **Overall visual polish** — cinematic title screen (glitch, scanlines, animated
   subtitle), HUD fade-in + pulsing accent, dialogue box slide-up + typewriter cursor +
   speaker prefix, post-processing mood pass (tighter bloom, deeper vignette, darker
   exposure, stronger CA).

## Next steps (high priority)

### 1. More interiors
The area system is generic. Adding the Memory Den, the Hotel, or any other enterable
building is just a new `build___Area()` function + a door in Sector 7. The story bible
names several key locations.

### 2. Investigation — Lyra & beyond the studio
The clue + journal layer is in, including the studio case conclusion (all 7 scene
clues found → objective resolves to "take what you have to Lyra," door interaction
gets a closing beat, `studio-case-complete` flag in the journal). What remains for
this line: Lyra herself (an NPC gated on that flag), and street-level clues in
Sector 7 so investigation mode is meaningful outside too.

### 3. NPCs and character dialogue
Lyra is the most important character after Cole. She could appear in the studio or on
the street, with a proper dialogue tree (not just examination text). The journal's
`requiresClue` pattern is the hook: gate Lyra's dialogue beats on collected evidence.

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