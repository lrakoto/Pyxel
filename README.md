# EVERYBODY/NOBODY (working title)

A cyberpunk noir turn-based RPG set in **New Angeles, 2077**. Detective Xander Darius Cole investigates the murder of an artist-cyborg in Sector 7 and uncovers a hidden economy of stolen human creativity.

Full narrative design: [docs/STORY_BIBLE.md](docs/STORY_BIBLE.md)
Full project context / next steps: [AGENTS.md](AGENTS.md)

## Visual direction

Inspired by *REPLACED* and HD-2D: **pixel art living inside a real 3D-lit scene**.

- Fixed 960x540 internal render resolution, upscaled with crisp pixels
- Sprites use lit materials so neon point lights tint them as they move
- Cinematic post stack: HDR bloom, film grain, chromatic aberration, vignette, lens dirt
- Fog, rain, flickering neon, and parallax depth layers for atmosphere
- Cinematic glitch title screen with scanlines and chromatic split

All current art is procedural placeholder (generated in `src/world/pixelTextures.ts`) — no binary assets yet. Real sprite sheets (Aseprite) will replace the pixel maps later without changing the lighting pipeline.

## Running

```sh
npm install
npm run dev      # dev server
npm run build    # typecheck + production build
```

Controls:

| Key | Action |
|-----|--------|
| ←/→ or A/D | Walk |
| E | Investigate / examine / advance dialogue |
| I or Esc | Exit investigation mode |
| Click/tap a glint | Walk there; examination fires automatically on arrival |
| Click/tap the ground | Walk there (investigation mode) |
| [ / ] | Cycle focus between glints (investigation mode) |
| Space | Advance dialogue |
| J or Tab | Case journal (pauses the game) |
| B | Dev trigger — enter shooter combat |
| → in combat | A/D or ←/→ move · Space/W/↑ jump · mouse aim · hold LMB fire · Esc/Q exit |

## Structure

```
src/
  main.ts               entry point
  core/Game.ts          renderer, camera, post-processing, game loop, area registry + transitions
  core/states/          state machine (Explore ↔ Investigate ↔ Shooter), area transition system
  core/investigation/   clue model, case journal store, journal overlay UI, evidence toast
  world/sector7.ts      Sector 7 street scene (exterior area)
  world/studio.ts       Marlon Graves' studio (interior crime scene area)
  world/area.ts         AreaWorld/DoorDef interfaces for area transitions
  world/glint.ts        pulsing sparkle marking examinables in investigation mode
  world/Player.ts       Cole placeholder sprite + movement/animation/scarf
  world/dialogue.ts     DialogueManager with dynamic per-area interaction sets + clue-conditional lines
  world/pixelTextures.ts  procedural placeholder textures
docs/
  STORY_BIBLE.md        canonical narrative design document
```

## Roadmap

1. ✅ REPLACED-style render pipeline proof-of-scene (walkable Sector 7 street)
2. ✅ Real-time shooter combat slice (side-scrolling run-and-gun in ShooterState — replaced the earlier CTB prototype)
3. ✅ Scene/state management (street ↔ combat transitions, area system with fade transitions)
4. ✅ Dialogue and investigation systems (14 street + 9 studio interactables, typewriter text)
5. ✅ Area expansion (Sector 7 street ↔ Marlon's studio interior)
6. 🚧 Visual polish (cinematic title, HUD, post-processing, studio textures — done; more to come)
7. 🚧 Investigation gameplay layer — done: glint-marked investigation mode (E near an object or I to enter), evidence clues with journal (J/Tab), clue-conditional re-examination. Next: usable items, NPC-driven dialogue trees
8. ⬜ NPCs and character dialogue (Lyra, Marlon, the Broker)
9. ⬜ Real sprite art pipeline (Aseprite sheets + normal maps for sprite lighting)
10. ⬜ Audio for interiors (ambient hum, muffled rain, neural device pulse)
11. ⬜ More interiors (Memory Den, Hotel, clinics, galleries)

## Recent additions

- **Shooter combat slice** — press B on the street to enter real-time side-scrolling combat: keyboard moves and jumps Cole, mouse aims a 360° machine pistol, hold LMB to auto-fire. Ground enforcers and aerial drones arrive in waves; kills trigger hit-stop, screen shake, knockback, damage numbers, and procedural combat SFX. A vitals bar, downed/revive flow, and DOM crosshair HUD complete the slice; Esc/Q returns to exploration.

- **Investigation mode + case journal** — press I (or E near an object) to enter investigation: examinables pulse with cyan glints, walk or click between them, E to examine. Objects grant evidence clues (toast notification + journal entry); the journal overlay (J/Tab) pauses the game with a case-file layout (current objective + collected evidence). Objects respond differently once you hold related clues — 8 clues and 5 conditional reveals wired into the studio scene.
- **Area transition system** — fade-out/swap-scene/fade-in between exterior and interior areas. Door prompts, dynamic interaction sets, player repositioning, bounds per area.
- **Marlon's studio** — the crime scene interior: cracked concrete walls with exposed brick, paint-splattered tile floor, the "Everybody/Nobody" painting (50 fragmented faces, neural traces), unfinished canvases on easels, neural interface device, chalk body outline with iridescent residue, wall writing, flickering bare bulb, ceiling pipes.
- **Cinematic title screen** — glitch effect with cyan/magenta chromatic split, drifting scanlines, animated subtitle, cycling "/" colors.
- **Post-processing mood pass** — tighter bloom, deeper vignette, darker exposure, stronger chromatic aberration for a more cinematic look.
- **Investigation dialogue** — 14 street + 9 studio interactables with noir-flavoured examination text, typewriter reveal, blinking cursor.
- **Procedural audio** — rain (2-layer noise), neon hum, ambient drone, footstep impacts, all via Web Audio API.
- **Weather / atmosphere** — rain splash particles, volumetric sign light beams, puddle chromatic aberration.
- **Character polish** — 3-frame walk cycle, idle breathing, fedora brim shadow, lens edge fade on sunglasses, scarf glint catch, verlet scarf sim.