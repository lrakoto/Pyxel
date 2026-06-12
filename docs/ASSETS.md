# Asset workflow

How art gets from your editor into the game. All current visuals are procedural placeholders generated in `src/world/pixelTextures.ts` — each one is designed to be replaced by a real PNG without touching the rendering/lighting code.

## Folder conventions

```
assets/            source files (Aseprite .ase, reference images) — not shipped
public/sprites/    exported PNGs the game loads, e.g. public/sprites/cole/idle.png
public/sprites/... one folder per character/prop
```

Vite serves everything in `public/` as-is, so a sprite is loaded by URL: `/sprites/cole/idle.png`.

## Drawing tools

- **Aseprite** (~$20, the standard) or **LibreSprite/Piskel** (free) for pixel art
- **Laigter** (free) or **Sprite DLight** to generate normal maps from sprites later — this is what makes the neon lights wrap around the character dimensionally instead of just tinting it

## Sprite specs

- **Characters:** 32×64 px per frame (Cole's placeholder is 12×22; real art gets ~3× the detail). Export as a horizontal strip: one PNG per animation (`idle.png`, `walk.png`), frames left to right, transparent background.
- **Keep a hard 1px dark outline** on silhouettes — the wet rim shader finds edges via the alpha channel, so clean silhouettes = clean rim glow.
- **Palette:** desaturated darks for the base (the scene is dark; midtones read as bright), saturated color reserved for emissive details (visor lights, implants, signs). Check art in-game early — the bloom/grain/fog stack changes how colors read.
- **Buildings/props:** any size, just keep pixel density consistent with characters (1 world unit ≈ 13 texture px at current scale).

## The loop

1. Drop an exported PNG into `public/sprites/<name>/`
2. Tell Claude the file name, frame size, and frame count
3. Claude wires the loader, frame timing, and material (lighting + rim shader apply automatically) and verifies in-browser with a screenshot
4. Iterate — hot reload shows changes instantly while the dev server runs

Reference images (REPLACED screenshots, mood boards, palette swatches) go in `assets/reference/` — useful for tuning post-processing against a target look.
