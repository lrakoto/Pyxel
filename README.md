# EVERYBODY/NOBODY (working title)

A cyberpunk noir turn-based RPG set in **New Angeles, 2077**. Detective Xander Darius Cole investigates the murder of an artist-cyborg in Sector 7 and uncovers a hidden economy of stolen human creativity.

Full narrative design: [docs/STORY_BIBLE.md](docs/STORY_BIBLE.md)

## Visual direction

Inspired by *REPLACED* and HD-2D: **pixel art living inside a real 3D-lit scene**.

- Fixed 960×540 internal render resolution, upscaled with crisp pixels
- Sprites use lit materials so neon point lights tint them as they move
- Cinematic post stack: HDR bloom, film grain, chromatic aberration, vignette
- Fog, rain, flickering neon, and parallax depth layers for atmosphere

All current art is procedural placeholder (generated in `src/world/pixelTextures.ts`) — no binary assets yet. Real sprite sheets (Aseprite) will replace the pixel maps later without changing the lighting pipeline.

## Running

```sh
npm install
npm run dev      # dev server
npm run build    # typecheck + production build
```

Controls: ←/→ or A/D to walk.

## Structure

```
src/
  main.ts               entry point
  core/Game.ts          renderer, camera, post-processing, game loop, input
  world/sector7.ts      Sector 7 scene: buildings, neon signs, lights, fog
  world/Player.ts       Cole placeholder sprite + movement/animation
  world/Rain.ts         additive rain streak particles
  world/pixelTextures.ts  procedural placeholder textures
docs/
  STORY_BIBLE.md        canonical narrative design document
```

## Roadmap

1. ✅ REPLACED-style render pipeline proof-of-scene (walkable Sector 7 street)
2. CTB battle system (FFX-style conditional turn-based queue) with HTML/CSS battle UI
3. Scene/state management (street ↔ battle transitions)
4. Dialogue and investigation systems
5. Real sprite art pipeline (Aseprite sheets + normal maps for sprite lighting)
6. Audio (ambient rain loop, neon hum, battle themes)
