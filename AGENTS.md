# Working context — EVERYBODY/NOBODY

## Project state (August 2026)

A cyberpunk noir turn-based RPG with a pixel-in-3D (REPLACED-style) visual pipeline.
Walking prototype of Sector 7 street with investigation dialogue, procedural audio,
a state machine, an area transition system, and one enterable interior (Marlon's studio).

The investigation layer exists: glint-marked investigation mode, evidence clues,
a case journal overlay, and clue-conditional re-examination.

The real-time side-scrolling shooter combat slice has landed in main (replacing the
CTB battle concept). Press B on the street to enter combat: keyboard moves and jumps,
mouse aims a 360° machine pistol, hold to fire. Waves of ground enforcers and aerial
drones, with hit-stop, screen shake, knockback, damage numbers, and combat SFX.
The old CTB files (BattleState, core/battle/) still exist but are unwired dead code.

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
| B | Dev trigger — enter shooter combat |
| → in combat | A/D or ←/→ move · Space/W/↑ jump · mouse aim · hold LMB fire · Esc/Q exit |

## Architecture

```
src/
  main.ts — entry point
  core/
    Game.ts — creates renderer, camera, scene, all shared resources, wires up state machine, area registry + transitions
    AudioManager.ts — procedural Web Audio: rain, neon hum, drone, footsteps, combat one-shots (gunshot/impact/kill/hurt), swappable exterior/interior ambience beds (crossfaded on area transition), interior muffled-rain + building hum + neural-device pulse for the studio
    states/
      GameContext.ts — interface for all shared objects + requestAreaTransition callback
      StateMachine.ts — generic state machine with enter/exit/update lifecycle
      ExploreState.ts — exploration (player movement, rain, dialogue, puddles, door prompts, area transitions, E → investigation mode, B → shooter)
      InvestigateState.ts — investigation mode: pulsing glints on examinables, click/tap-to-walk selection, clue grant on examine, camera pull-in
      ShooterState.ts — real-time combat side-slice: keyboard move/jump, 360° mouse-aim machine pistol, waves, hit-stop/shake/knockback, damage numbers, HP/down-revive
      BattleState.ts — CTB battle state (unwired dead code; kept for reference)
    investigation/
      Clue.ts — ClueDef (id, title, journal body)
      Journal.ts — collected clues + case objective that evolves on key clues
      JournalUI.ts — full-screen case-file overlay (J/Tab/Esc, pauses world)
      ClueToast.ts — transient "EVIDENCE ADDED" notification
    battle/
      Battle.ts — CTB engine: turn meters, queue, attack/skill/defend, enemy AI
      BattleUI.ts — HTML/CSS battle overlay: portraits, HP bars, turn order, command menu, action log
  world/
    area.ts — AreaWorld/DoorDef interfaces: self-contained scenes with doors, interactions, bounds, exterior flag, onClueAdded/onEnter hooks (areas react to case progress)
    sector7.ts — Sector 7 street: buildings, signs, lights, fog, props, sparkles, pedestrians, Lyra NPC (revealed after studio-case-complete). buildSector7Area() returns AreaWorld
    studio.ts — Marlon Graves' studio interior: crime scene with walls, floor, Everybody/Nobody painting, easels, neural device, body outline, wall writing. 9 interactables.
    Player.ts — detective Cole: sprite, verlet scarf, wet-rim shader, sunglass reflections, jump physics (grounded/muzzleY), setFacing()/setBounds() for area transitions
    dialogue.ts — DialogueManager with dynamic interaction sets (setInteractions for area swapping) + clue-conditional line resolution + appearsAfterClue gating (NPCs that only appear after a story beat)
    glint.ts — pulsing additive sparkle marking examinables in investigation mode
    Rain.ts — additive line-segment rain streaks (near + far layers)
    RainSplash.ts — ground splash particles cycling near the camera
    puddles.ts — planar mirror puddle system with chromatic edge shift
    props.ts — vending machines, bins, crates, steam vents, sparkle system
    pedestrians.ts — background walkers with umbrellas
    pixelTextures.ts — procedural texture generation (env surfaces; character art moved to sprites.ts)
    sprites.ts — procedural character frames drawn to the same spec the Aseprite pipeline imports: Cole 24×54 (idle / 4-phase walk / jump / land), enforcer 24×30 walk, drone 16×10 hover, pedestrians 14×28 coat+hood walks, Lyra 16×32 hooded AI idle. This is the runtime stand-in until compiled .aseprite sheets replace it.
    foreground.ts — utility poles + catenary wires (parallax layer)
    nearground.ts — blurred foreground silhouettes (fake DOF)
    shooter/
      Enemy.ts — camera-facing pixel billboards: ground enforcers (walk, contact DPS) + aerial drones (hover, sinusoidal drift); HP, hit-flash, knockback, death burst
      Bullets.ts — pooled tracer lines, per-frame segment collision callback
      Gun.ts — the machine pistol sprite + muzzle flash, rotates to the aim angle
      Sparks.ts — pooled additive spark bursts (muzzle, impacts, kills)
      FloatingText.ts — DOM-composited damage numbers + "DOWN" labels
  sprites/
    types.ts — SpriteManifest / AsepriteSheetMeta / tag & frame schemas (the JSON contract)
    SpriteLibrary.ts — loads /sprites/manifest.json + atlas once, exposes sheets with tag windows; texture cache so all instances share frames; missing sheets → null so procedural art stays the fallback
    SpriteAnimator.ts — per-instance tag playback: forward / reverse / ping-pong(-reverse), per-frame durations, holdLast + resume, per-play onDone
  tuning.ts — live-tunable scene values (rewritten in place by the tuning panel)
  tuningSchema.ts — slider metadata for the tuning panel
  debug/
    tuningPanel.ts — dev-only tuning sliders
  style.css — all UI styling (title screen, HUD, dialogue, shooter HUD/crosshair, battle overlay)
tools/
  aseprite-import.mjs — .aseprite → sprite sheet compiler (see below)
```

## Sprite pipeline (Aseprite)

Real art path: **`.aseprite` file → packed atlas + JSON manifest → runtime swap**. The pipeline
is hot-reloading and zero-friction for an artist — drop a file and it appears in-game.

- **`tools/aseprite-import.mjs`** — parses the Aseprite binary format (RGBA frames, zlib
  compressed cels, layer visibility, frame durations, tags, pivot slices), flattens each frame,
  shelf-packs into one atlas, and writes `public/sprites/sprites.png` + `manifest.json`.
- **Trigger**: `npm run import-art` standalone, or automatically on `npm run dev` /
  `npm run build` via a Vite plugin that also watches `assets/sprites/*.aseprite` and
  full-reloads on change.
- **Source art** lives in `assets/sprites/` (gitignored PNG/manifest outputs go to
  `public/sprites/`).
- **Runtime**: `SpriteLibrary.loadSheet('cole')` → a sheet with per-tag frame windows; if a
  sheet is absent every call site falls back to the procedural frames in `world/sprites.ts`, so
  the game runs identically before any real art exists.
- **Tags that the code asks for** (use these names in Aseprite, lowercase): `idle`, `walk`,
  `jump` on Cole; `walk`, `death` on enforcer / drone; `walk` on `ped_a`/`ped_b`; `idle` on
  Lyra (`lyra`); `static` (implicit—first frame) on the studio `painting`.

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

1. **Shooter combat slice (merged into main)** — `ShooterState` + `world/shooter/`
   module. Side-scrolling run-and-gun: A/D walk, Space/W jump (new jump physics on
   Player with `grounded`/`muzzleY`), 360° mouse aim (cursor unprojected onto the
   z=0 plane), hold-LMB auto-fire machine pistol with angular spread. Ground
   enforcers + aerial drones arrive in opposite-side waves; contact damage drains a
   100 HP vitals bar; downed state clears the field and revives at full. Game feel:
   0.07s hit-stop on kills, per-hit screen shake, directional knockback, DOM damage
   numbers + "ENFORCER/DRONE DOWN" labels, muzzle point-light flash, and procedural
   combat SFX in AudioManager (gunshot/impact body-vs-metal/kill/hurt). HUD is a DOM
   overlay (`#shooter-hud`) with crosshair, vitals bar, and controls hint; Esc/Q
   exits back to ExploreState. Story bible also gained Cole's "what makes him
   exceptional" traits (aug tolerance, athleticism, intellect, moral compass).
2. **Investigation gameplay layer** — new `InvestigateState`: press I (or E near an
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
3. **Area system + Marlon's studio** — built AreaWorld/DoorDef interfaces, refactored
   sector7 and dialogue to support area swapping, built the studio interior (crime scene
   with 9 interactables, procedural textures, flickering light, body outline, the
   Everybody/Nobody painting, neural device, wall writing, easels, workbench, pipes).
4. **Studio visual polish** — 4x detail on the Everybody/Nobody painting (50 fragmented
   faces, neural traces, convergence point), paint-splattered floor, exposed brick walls
   with conduit and baseboards, hanging bare bulb, paint tubes, ceiling beams + pipes,
   stronger iridescent residue, actual rendered wall writing text, painting frame.
5. **Overall visual polish** — cinematic title screen (glitch, scanlines, animated
   subtitle), HUD fade-in + pulsing accent, dialogue box slide-up + typewriter cursor +
   speaker prefix, post-processing mood pass (tighter bloom, deeper vignette, darker
   exposure, stronger CA).
6. **Lyra first encounter + interior audio (this session)** — two coupled features.
   (a) **Lyra reveal**: new `appearsAfterClue` gate on `InteractionDef` hides an
   interaction until a clue is held; `DialogueManager` gained `isAvailable()` /
   `availableInteractions` + a `setClueCheck` predicate; `AreaWorld` gained
   `onClueAdded`/`onEnter` hooks so areas react to case progress. A procedural Lyra
   sprite (16×32 hooded AI, cyan face-glow band, `makeLyraFrame()` in sprites.ts) was
   added with a breathing cyan point-light; she stands beneath the Memory Den awning
   and is invisible until `studio-case-complete` fires. Her dialogue is written as a
   *reveal to Cole* — she has been watching him, lists his studio evidence back at
   him, calls Marlon a friend, and points to the first fragment in her archive. (b)
   **Interior ambience bed**: AudioManager refactored into two crossfaded beds —
   exterior (rain/hum/drone) and interior (muffled-rain-through-walls + building hum +
   a slow ~38 bpm neural-device pulse). `setExterior(boolean)` flips the active bed;
   the crossfade is driven per-frame from `TUNING.ambienceExterior`/`ambienceInterior`
   so the tuning panel's new Ambience group affects live audio. Studio case-complete
   → Lyra appears → interior audio plays on the next studio visit.

## Next steps (high priority)

### 1. More interiors
The area system is generic. Adding the Memory Den, the Hotel, or any other enterable
building is just a new `build___Area()` function + a door in Sector 7. The story bible
names several key locations.

### 2. Investigation — beyond the studio
The clue + journal layer is in, including the studio case conclusion (all 7 scene
clues found → objective resolves to "take what you have to Lyra," door interaction
gets a closing beat, `studio-case-complete` flag in the journal) and the Lyra
reveal (she appears on the street once that flag fires). What remains for this
line: street-level clues in Sector 7 so investigation mode is meaningful outside
the studio too, and the Memory Den as an enterable interior where Lyra's archive
lives.

### 3. NPCs and character dialogue
Lyra's first encounter is in (this session) — she appears on the street once
`studio-case-complete` fires and her dialogue plays as a reveal to Cole. The
remaining work on her arc is the *companion transition*: per the story bible's
**Canonical direction** (Aug 2026), her arc is locked — she has been *watching*
Cole before they meet and eventually becomes a Cortana-style traveling companion
(present across areas, not locked to one interior). The four "possible versions"
of Lyra are read as facets of one character revealed over the arc, not
alternatives.

Implementation implications:
- The first encounter (already in) plays as a *reveal to Cole*, not a first
  meeting for her — her dialogue references things she has already observed about
  him/the case.
- The `requiresClue` / `conditionalLines` pattern is the hook for her early beats,
  but the eventual companion transition is a story flag, not a clue gate. Plan a
  `lyra-companion-active` journal/state flag analogous to `studio-case-complete`.
- A companion Lyra needs a persistent presence that travels across areas (HUD
  element, dialogue-on-demand, possibly the city-grid / an implant voice —
  diegetic form TBD), not a single `build___Area()` NPC.

### 4. Sprite art content: feed the new pipeline real sheets
The `.aseprite` → atlas → runtime-swap pipeline is built (see *Sprite pipeline* above) and
the procedural frames in `world/sprites.ts` were redrawn to its spec (Cole 24×54, enforcer
24×30, drone 16×10, peds 14×28). What remains is **content**: hand-drawn Aseprite files to
replace the procedural stand-ins. The moment `assets/sprites/cole.aseprite` lands with
`idle`/`walk`/`jump` tags it goes live — no code change.

### 5. Audio for interiors
The studio has its own ambient bed: low building hum, muffled rain through
walls, and a slow neural-device pulse (~38 bpm). The AudioManager crossfades
between exterior (rain/hum/drone) and interior beds on area transition via
`setExterior()`; interior sub-levels are live-tunable in the tuning panel
(Ambience group). Other interiors should plug into the same interior bed;
area-specific pulses (like the studio's neural device) are currently hardcoded
to the interior bed — generalize if a second interior needs a different pulse.

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