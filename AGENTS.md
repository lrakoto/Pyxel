# Working context — EVERYBODY/NOBODY

## Project state (June 2026)

A cyberpunk noir turn-based RPG with a pixel-in-3D (REPLACED-style) visual pipeline.
Walking prototype of Sector 7 street with investigation dialogue, procedural audio, and a
state machine ready for battle integration.

## Controls

| Key | Action |
|-----|--------|
| ← → / A D | Walk |
| E | Examine nearby object / advance dialogue |
| Space | Advance dialogue (when open) / dismiss battle stub |
| B | Dev trigger — enter battle stub |
| Enter | Dismiss battle stub |

## Architecture

```
src/
  main.ts — entry point
  core/
    Game.ts — creates renderer, camera, scene, all shared resources, wires up state machine
    AudioManager.ts — procedural Web Audio: rain, neon hum, drone, footsteps
    states/
      GameContext.ts — interface for all shared objects passed to states
      StateMachine.ts — generic state machine with enter/exit/update lifecycle
      ExploreState.ts — street gameplay (player movement, rain, dialogue, puddles, audio)
      BattleState.ts — placeholder overlay, returns to ExploreState on Space/Enter
  world/
    sector7.ts — world builder: buildings, signs, lights, fog, props, sparkles, pedestrians
    Player.ts — detective Cole: sprite, verlet scarf, wet-rim shader, sunglass reflections
    dialogue.ts — 14 interactable objects, DialogueManager class, typewriter text
    Rain.ts — additive line-segment rain streaks (near + far layers)
    RainSplash.ts — ground splash particles cycling near the camera
    puddles.ts — planar mirror puddle system with chromatic edge shift
    props.ts — vending machines, bins, crates, steam vents, sparkle system
    pedestrians.ts — 24 background walkers with umbrellas
    pixelTextures.ts — all procedural texture generation (zero binary assets)
    foreground.ts — utility poles + catenary wires (parallax layer)
    nearground.ts — blurred foreground silhouettes (fake DOF)
```

## Visual pipeline

- 960×540 fixed internal resolution → CSS `image-rendering: pixelated` upscale
- `depth: false`, `antialias: false` — all sorting by painter's algorithm
- ACESFilmic tone mapping, exposure 1.15
- Post stack: bloom (threshold 0.15), chromatic aberration, film grain, vignette, lens dirt
- Tone mapping and post-processing are applied BEFORE the pixelated upscale → smooth HDR bloom on chunky pixels

## Next steps (high priority)

### 1. CTB battle system (roadmap item #2)
The state machine is ready. `BattleState.ts` is a placeholder. What it needs:

- **Turn queue** — CTB (Conditional Turn-Based, FFX-style): each character/enemy has a
  speed stat. A `turnMeter` fills at `speed` rate per second. When it reaches 1000, the
  unit takes a turn. The queue visualises the next ~6 actors in order.
- **Party/enemy data** — HP, ATK, DEF, Speed, skills. Cole + allies vs Sector 7 enemies.
- **Battle UI** — HTML/CSS overlay (the existing `#battle-overlay` is temporary). Needs:
  - Party status bars (HP, turn meter)
  - Enemy health display
  - Command menu (Attack, Skill, Item, Defend)
  - Action log / feedback text
  - Turn order bar
- **Animations** — Camera pushes in, character sprites face the enemy, attack/damage
  feedback via sprite flash + screen shake.
- **Scene transition** — street dims, camera zooms to Cole, overlay fades in.
  Use the existing state machine: `ExploreState` → `BattleState` → `ExploreState`.

### 2. Real sprite art (roadmap item #5)
All current art is procedural placeholder (`pixelTextures.ts`). The pipeline supports
real sprite sheets via `spriteTexture()` — swap the pixel-map rows for Aseprite exports.
Same for building facades (`facadeTexture`), signs (`neonSignTexture`), etc.

### 3. Audio tuning
The Web Audio system works but hasn't been tuned in-engine. Volumes, filter frequencies,
and footstep timing may need adjustment when heard in the actual scene.

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
