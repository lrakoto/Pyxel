import * as THREE from 'three';
import { canvasTexture } from './pixelTextures';

/**
 * High-resolution procedural sprite frames. This module is the stand-in art
 * layer for the Aseprite pipeline: it draws each character at the detail
 * level we expect from real imports, so the switch to compiled .aseprite
 * sheets is a content drop, not a code change.
 *
 * Sprites are authored as string rows ('.' = transparent), built once via a
 * helper so width mismatches can't silently shift a silhouette. Palette
 * definitions stay as close to the legacy 14x28 originals as possible so the
 * rim shader, scarf anchor, and lighting relationships survive the upgrade.
 */

/** Turns row strings into a canvas texture, asserting uniform width. */
export function framesFromRows(w: number, rows: string[][], palette: Record<string, string>): THREE.CanvasTexture[] {
  for (const [i, frame] of rows.entries()) {
    if (frame.some((r) => r.length !== w)) {
      throw new Error(`sprite frame ${i} has a row that isn't ${w}px wide`);
    }
  }
  return rows.map((frame) => spriteFromRows(frame, palette));
}

function spriteFromRows(rows: string[], palette: Record<string, string>): THREE.CanvasTexture {
  return canvasTexture(rows[0].length, rows.length, (ctx) => {
    rows.forEach((row, y) => {
      [...row].forEach((ch, x) => {
        const color = palette[ch];
        if (color) {
          ctx.fillStyle = color;
          ctx.fillRect(x, y, 1, 1);
        }
      });
    });
  });
}

/* ------------------------------------------------------------------ */
/* Cole: 32×64. Tall cinematic side-profile, facing right.             */
/*                                                                     */
/* Vertical layout (texels):                                           */
/*   hat crown   2–9    (the 0–1 rows are padding)                     */
/*   hat brim    10–11  (wide, dips low over the eyes)                 */
/*   face/skin   12–18  (sunglasses + face shade; glint rows ~12–13)   */
/*   scarf wrap  19–21  (the *body* wrap; the verlet tail sits on top) */
/*   coat        22–47  (lapel, shoulders, back seam, belt, hem)       */
/*   legs/boots  48–53  (frame-specific)                               */
/* ------------------------------------------------------------------ */

export const COLE_W = 32;
export const COLE_H = 64;

export const COLE_PALETTE: Record<string, string> = {
  H: '#14171d', // hat
  h: '#20242c', // hat brim
  b: '#1a1f28', // hat band
  S: '#c49070', // skin
  f: '#7a5a44', // face shadow (under hat brim)
  g: '#0d0f13', // sunglasses lens
  C: '#2c333d', // trench coat
  D: '#1b212a', // coat shadow (seam, hem)
  L: '#3a4350', // coat highlight (lapel, shoulder)
  N: '#62788a', // rain-caught blue-grey edge
  G: '#ee4444', // scarf
  t: '#0d0f13', // belt
  P: '#20242c', // trousers
  P2: '#282e38', // trouser highlight
  B: '#0d0f13', // boots
};

type ColePose = { stride?: number; crouch?: number; airborne?: boolean };

/** Fresh 32×64 Cole art: every pose is drawn independently at native pixel size. */
function makeColeFrame({ stride = 0, crouch = 0, airborne = false }: ColePose = {}): THREE.CanvasTexture {
  return canvasTexture(COLE_W, COLE_H, (ctx) => {
    const rect = (color: string, x: number, y: number, w: number, h: number) => {
      ctx.fillStyle = color;
      ctx.fillRect(Math.round(x), Math.round(y + crouch), w, h);
    };
    const poly = (color: string, pts: [number, number][]) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y + crouch) : ctx.moveTo(x, y + crouch));
      ctx.closePath();
      ctx.fill();
    };

    // Low fedora with a restrained brim; crown, band and wet edge stay
    // separate so the hat no longer merges into one oversized dark block.
    rect(COLE_PALETTE.H, 13, 2, 8, 1);
    rect(COLE_PALETTE.H, 11, 3, 12, 6);
    rect(COLE_PALETTE.b, 10, 8, 14, 2);
    rect(COLE_PALETTE.h, 8, 10, 18, 2);
    rect('#080a0d', 10, 11, 15, 1);
    rect(COLE_PALETTE.N, 22, 4, 1, 4);

    // Refined side-profile head: hair/ear at the rear, two-value face,
    // slim glasses with a cyan catch, and an explicit nose/chin silhouette.
    rect('#201711', 11, 12, 4, 7);
    rect(COLE_PALETTE.f, 13, 12, 9, 8);
    rect(COLE_PALETTE.S, 15, 12, 8, 7);
    rect(COLE_PALETTE.S, 22, 14, 3, 2);
    rect(COLE_PALETTE.S, 23, 15, 3, 2);
    rect(COLE_PALETTE.f, 13, 14, 2, 3);
    rect('#5f4233', 13, 15, 1, 1);
    rect(COLE_PALETTE.g, 16, 13, 8, 2);
    rect('#273746', 18, 13, 3, 1);
    rect(COLE_PALETTE.N, 23, 13, 1, 1);
    rect(COLE_PALETTE.f, 16, 19, 7, 1);
    rect(COLE_PALETTE.S, 17, 20, 5, 1);

    // Compact scarf wrap leaves breathing room beneath the jaw; the
    // simulated tail supplies the dramatic motion outside the sprite.
    rect('#9e2630', 11, 20, 12, 2);
    rect(COLE_PALETTE.G, 12, 22, 10, 2);

    // Structured shoulders, lapels, waist and two distinct coat tails.
    poly(COLE_PALETTE.D, [[8, 23], [12, 21], [22, 22], [25, 27], [23, 44], [18, 49], [9, 46], [6, 28]]);
    poly(COLE_PALETTE.C, [[10, 23], [14, 22], [21, 23], [23, 28], [21, 43], [17, 48], [11, 45], [9, 28]]);
    poly(COLE_PALETTE.L, [[10, 23], [15, 22], [13, 32], [10, 28]]);
    poly(COLE_PALETTE.L, [[21, 23], [23, 26], [19, 32], [15, 23]]);
    rect(COLE_PALETTE.t, 10, 34, 13, 2);
    rect('#59616d', 17, 34, 3, 2);
    poly(COLE_PALETTE.D, [[10, 36], [16, 37], [15, 49], [9, 46]]);
    poly('#141922', [[16, 37], [21, 36], [23, 46], [17, 49]]);
    rect(COLE_PALETTE.N, 23, 25, 1, 15);

    // Arms counter-swing with the stride; hands remain clearly separate.
    const arm = Math.round(stride * 2);
    poly(COLE_PALETTE.C, [[8, 24], [11, 25], [10 + arm, 36], [7 + arm, 36], [5, 28]]);
    rect(COLE_PALETTE.B, 7 + arm, 35, 4, 4);
    poly(COLE_PALETTE.C, [[22, 24], [25, 27], [23 - arm, 36], [20 - arm, 35], [20, 27]]);
    rect(COLE_PALETTE.B, 20 - arm, 35, 4, 4);

    // Anatomical legs: hip → knee → ankle, with a six-phase stride.
    const front = Math.round(stride * 5);
    const back = Math.round(-stride * 4);
    const legTop = airborne ? 46 : 45;
    poly(COLE_PALETTE.P2, [[14, legTop], [18, legTop], [20 + front, 53], [19 + front, 61], [16 + front, 61], [16, 52]]);
    poly(COLE_PALETTE.P, [[10, legTop], [14, legTop], [12 + back, 53], [11 + back, 61], [8 + back, 61], [9, 52]]);
    rect(COLE_PALETTE.B, 15 + front, 60, 7, 3);
    rect(COLE_PALETTE.B, 7 + back, 60, 7, 3);
    rect('#343b47', 17 + front, 60, 3, 1);
  });
}

export const COLE_FRAMES: { idle: THREE.CanvasTexture[]; walk: THREE.CanvasTexture[]; jump: THREE.CanvasTexture[] } = {
  idle: [makeColeFrame()],
  walk: [-1, -0.62, -0.18, 0.18, 0.62, 1].map((stride) => makeColeFrame({ stride })),
  jump: [makeColeFrame({ stride: 0.45, airborne: true }), makeColeFrame({ stride: 0.15, crouch: 1 })],
};

/** Mirrors each row left-to-right (used by the compact NPC fallback art). */
function mirrorRows(rows: string[]): string[] {
  return rows.map((r) => [...r].reverse().join(''));
}

/* ------------------------------------------------------------------ */
/* Sector 7 Enforcer: 24×30. Armoured, heavy-visor ground unit.         */
/*                                                                      */
/*   helmet   2–9    (dome + visor slit)                                */
/*   jacket   10–27  (plates, chest emblem, armoured skirt)             */
/*   legs     28–29  (frame-specific) + boots                           */
/* ------------------------------------------------------------------ */

export const ENFORCER_W = 24;
export const ENFORCER_H = 30;

export const ENFORCER_PALETTE: Record<string, string> = {
  M: '#3a4250', // helmet / armour plate
  A: '#667180', // hard armour edge
  m: '#2a3140', // plate shade
  V: '#ff3b46', // visor glow
  J: '#262b35', // jacket
  j: '#161a21', // jacket shadow
  K: '#1c212b', // knee / joint
  B: '#0e1014', // boots
};

const ENFORCER_BODY = [
  '........MMMMMMMM........', // 0
  '.......MMMMMMMMM........', // 1  dome top
  '......AMMMMMMMMA........', // 2
  '......MMMMMMMMMM........', // 3
  '......MMMMMMMMMM........', // 4
  '......VVVVVVVVVV........', // 5  visor slit glows
  '......MMMMMMMMMM........', // 6
  '.......MMMMMMMM.........', // 7
  '........MMMMMM..........', // 8  chin guard
  '.......JJJJJJJJ.........', // 9  collar
  '......JJJJJJJJJJ........', // 10 shoulders
  '.....JJJJJJJJJJJ........', // 11
  '....AJJJJJJJJJJA........', // 12 pauldron edges
  '....JJJJJJJJJJJJ........', // 13
  '....JJjJJJJJJjJJ........', // 14 chest plate seam
  '....JJjJJJJJJjJJ........', // 15
  '....JJjJJJJJJjJJ........', // 16
  '....JJJJJJJJJJJJ........', // 17
  '....JJJJJJJJJJJJ........', // 18
  '....JJJJJJJJJJJJ........', // 19
  '....JJJJJJJJJJJJ........', // 20
  '....JJJJJJJJJJJJ........', // 21 mid torso
  '....JJJJJJJJJJJJ........', // 22
  '.....JJJJJJJJJJ.........', // 23 armoured skirt
  '.....JJJJJJJJJJ.........', // 24
  '.....JJJJJJJJJJ.........', // 25
  '......JJJJJJJJ..........', // 26
  '......JJJJJJJJ..........', // 27 hem
];

const ENFORCER_LEGS_STEP_A = [
  '....KKK....KKK..........', // 28
  '...BBB......BBB.........', // 29
];

const ENFORCER_LEGS_STEP_B = [
  '.....KKKKKKK............', // 28
  '....BBBBBBBB............', // 29
];

export const ENFORCER_FRAMES: { walk: THREE.CanvasTexture[] } = {
  walk: framesFromRows(
    ENFORCER_W,
    [
      [...ENFORCER_BODY, ...ENFORCER_LEGS_STEP_A],
      [...ENFORCER_BODY, ...ENFORCER_LEGS_STEP_B],
      [...ENFORCER_BODY, ...mirrorRows(ENFORCER_LEGS_STEP_A)],
      [...ENFORCER_BODY, ...ENFORCER_LEGS_STEP_B],
    ],
    ENFORCER_PALETTE,
  ),
};

/* ------------------------------------------------------------------ */
/* Aerial drone: 16×10. Hover body, rotor blur, sensor eye.             */
/* ------------------------------------------------------------------ */

export const DRONE_W = 16;
export const DRONE_H = 10;

export const DRONE_PALETTE: Record<string, string> = {
  M: '#4a5360', // rotor blur
  D: '#2b313c', // hull
  d: '#161a21', // hull shadow
  V: '#36e0ff', // sensor eye
  R: '#ff3548', // hostile sensor core
};

const DRONE_BODY = [
  '.M...M....M...M.', // 0 rotor tips
  '..MM........MM..', // 1 rotor blur
  '...dDDDDDDd.....', // 2 top hull
  '..dDDDDDDDDd....', // 3
  '..DDDDDDDDDD....', // 4
  '..DDVVRVVVDD....', // 5 sensor eye band + red lock core
  '..dDDDDDDDDd....', // 6
  '...dDDDDDDd.....', // 7
  '....dDDDDd......', // 8 belly
  '.....d..d.......', // 9 landing skids
];

export const DRONE_FRAMES: { hover: THREE.CanvasTexture[] } = {
  // Two hover frames: the rotor blur alternates which diagonal it biases, so
  // the eye reads as a fast spin even at 2 fps.
  hover: framesFromRows(
    DRONE_W,
    [DRONE_BODY, droneRotorFrame(true)],
    DRONE_PALETTE,
  ),
};

/** A second hover frame with the rotor blur drawn on the opposite diagonal. */
function droneRotorFrame(_alt: boolean): string[] {
  return [
    'M.....M..M....M.', // 0 rotor tips, shifted
    '..M........MM...', // 1 blur
    '...dDDDDDDd.....',
    '..dDDDDDDDDd....',
    '..DDDDDDDDDD....',
    '..DDVVRVVVDD....',
    '..dDDDDDDDDd....',
    '...dDDDDDDd.....',
    '....dDDDDd......',
    '.....d..d.......',
  ];
}

/* ------------------------------------------------------------------ */
/* Street pedestrians: 16 wide, 28 tall. Two cut silhouettes that stroll */
/* the sidewalk — a coat walker and a hood walker. 4-phase walk legs.    */
/* ------------------------------------------------------------------ */

export const PED_W = 16;
export const PED_H = 28;

/**
 * Ped palettes are per-instance (rain-slicked tones); rows use a fixed key
 * set that the caller maps to a chosen tone. 'k' is the coat/hood fill, 'f'
 * the sliver of face at the collar.
 */
export function pedPalette(coat: string, face = '#caa07c'): Record<string, string> {
  return {
    H: '#15191f',
    k: coat,
    f: face,
    P: '#1b1f25',
    B: '#0d0f13',
  };
}

const PED_COAT_BODY = [
  '......HHH.......', // 0 hat crown
  '.....HHHf.......', // 1 hat + face sliver
  '.....kkkk.......', // 2 collar
  '....kkkkkk......', // 3 shoulders
  '....kkkkkk......', // 4
  '...kkkkkkkk.....', // 5
  '...kkkkkkkk.....', // 6
  '...kkkkkkkk.....', // 7
  '...kkkkkkk......', // 8
  '...kkkkkkk......', // 9
  '...kkkkkkk......', // 10
  '...kkkkkk.......', // 11
  '...kkkkkk.......', // 12
  '...kkkkkk.......', // 13
  '....kkkkk.......', // 14
  '....kkkkk.......', // 15
  '....kkkk........', // 16
  '....kkkk........', // 17
  '.....kk.........', // 18
  '.....kk.........', // 19
  '................', // 20
  '................', // 21
  '................', // 22
  '................', // 23 gap before legs
  '................', // 24
  '................', // 25
  '................', // 26
  '................', // 27 legs rows are pose-specific
];

const PED_HOOD_BODY = [
  '.....kkkk.......',
  '....kkkkfk......',
  '....kkkkkk......',
  '...kkkkkkkk.....',
  '..kkkkkkkkk.....',
  '..kkkkkkkk......',
  '..kkkkkkk.......',
  '..kkkkkkk.......',
  '..kkkkkk........',
  '..kkkkkk........',
  '..kkkkkk........',
  '..kkkkk.........',
  '..kkkkk.........',
  '..kkkkk.........',
  '...kkkk.........',
  '...kkkk.........',
  '...kkk..........',
  '...kkk..........',
  '...kk...........',
  '...kk...........',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
];

const PED_LEGS_A = [
  '....PP..PP......', // 20
  '....PP..PP......',
  '...PP....PP.....',
  '...PP....PP.....',
  '..BBB....BBB....',
  '..BBB....BBB....',
  '................',
  '................',
];

const PED_LEGS_B = [
  '.....PPPP.......',
  '.....PPPP.......',
  '....PPP.PPP.....',
  '....PP...PP.....',
  '..BBB....BBB....',
  '..BBB....BBB....',
  '................',
  '................',
];

/** Pads the body block (rows 0–19) with an 8-row leg pose to reach 28 rows. */
function pedRows(body: string[], legs: string[]): string[] {
  return [...body.slice(0, 20), ...legs];
}

export function makePedFrames(kind: 'coat' | 'hood', coatTone: string): THREE.CanvasTexture[] {
  const body = kind === 'coat' ? PED_COAT_BODY : PED_HOOD_BODY;
  const pal = pedPalette(coatTone);
  return framesFromRows(
    PED_W,
    [
      pedRows(body, PED_LEGS_A),
      pedRows(body, PED_LEGS_B),
      pedRows(body, mirrorRows(PED_LEGS_A)),
      pedRows(body, PED_LEGS_B),
    ],
    pal,
  );
}

/* ------------------------------------------------------------------ */
/* Lyra: 16×32. Hooded AI silhouette with a cyan face-glow.             */
/*                                                                     */
/* She is a humanoid AI who has been watching Cole; her face is a soft   */
/* cyan light set deep in a dark hood — the inhuman tell. A single idle */
/* frame with a subtle two-stage glow flicker (handled by the caller via*/
/* emissive intensity), no walk cycle yet (she is met standing still).   */
/* ------------------------------------------------------------------ */

export const LYRA_W = 16;
export const LYRA_H = 32;

export const LYRA_PALETTE: Record<string, string> = {
  c: '#0a0e14', // cloak fill (near-black blue)
  C: '#141a24', // cloak rim (slightly lighter edge)
  g: '#7fe9ff', // face glow (cyan)
  G: '#bff5ff', // face glow core (brighter)
  h: '#2a3a4a', // hood inner shadow
  s: '#1a2230', // cloak seam
  m: '#562044', // restrained magenta cloak lining
  B: '#0d1218', // boots
};

// The hand-shaped hood/cloak rows intentionally vary by a pixel at the right
// edge; normalize that transparent padding before the strict frame validator.
const LYRA_IDLE = [
  '......cccc......', // 0 hood apex
  '.....cC CCc.....', // 1
  '....cC   Cc....', // 2
  '...cC     Cc...', // 3
  '..cC  GGGG  Cc.', // 4 face glow band (eyes)
  '..cC  gggg  Cc.', // 5
  '..cChhGGGGhhCc.', // 6 cheeks/jaw glow
  '..cChhgggghhCc.', // 7
  '...cChhhhhCc...', // 8 chin
  '....cCCCCc....', // 9 hood lip
  '...cccccccc....', // 10 shoulders yoke
  '..ccssssssscc..', // 11 cloak shoulders
  '..cssssssssc...', // 12
  '.csssssssssc...', // 13
  '.cssssssssmc...', // 14
  '.cssssssssmc...', // 15
  '.csssssssssc...', // 16
  '.csssssssssc...', // 17
  '.cssssssssc....', // 18
  '.cssssssssc....', // 19
  '.csssssssmc....', // 20
  '..cssssssc.....', // 21
  '..cssssssc.....', // 22
  '..cssssssc.....', // 23
  '..csss.sssc....', // 24 split before legs
  '..css...ssc....', // 25
  '..css...ssc....', // 26
  '..c.....cc.....', // 27 legs
  '..c.....cc.....', // 28
  '.cc.....ccc....', // 29
  '.cc.....ccc....', // 30
  '.BB.....BBB....', // 31 feet
].map((row) => row.padEnd(LYRA_W, '.'));

export function makeLyraFrame(): THREE.CanvasTexture {
  return framesFromRows(LYRA_W, [LYRA_IDLE], LYRA_PALETTE)[0];
}
