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
/* Cole: 24×54. Side-profile, facing right.                            */
/*                                                                     */
/* Vertical layout (texels):                                           */
/*   hat crown   2–9    (the 0–1 rows are padding)                     */
/*   hat brim    10–11  (wide, dips low over the eyes)                 */
/*   face/skin   12–18  (sunglasses + face shade; glint rows ~12–13)   */
/*   scarf wrap  19–21  (the *body* wrap; the verlet tail sits on top) */
/*   coat        22–47  (lapel, shoulders, back seam, belt, hem)       */
/*   legs/boots  48–53  (frame-specific)                               */
/* ------------------------------------------------------------------ */

export const COLE_W = 24;
export const COLE_H = 54;

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
  G: '#ee4444', // scarf
  t: '#0d0f13', // belt
  P: '#20242c', // trousers
  P2: '#282e38', // trouser highlight
  B: '#0d0f13', // boots
};

/**
 * Cole's body for the legs-together frames (idle). Rows 0–47 are the torso;
 * the leg/boot block is supplied per pose.
 */
const COLE_BODY_TOGETHER = [
  '........................', // 0  padding
  '........................', // 1  padding
  '...........HHHH.........', // 2
  '..........HHHHHH........', // 3  crown top taper
  '.........HHHHHHHH.......', // 4
  '.........HHHHHHHH.......', // 5
  '.........HHHHHHHH.......', // 6
  '.........HHHHHHHH.......', // 7
  '.........HHHHHHHH.......', // 8
  '........bbHHHHHHbb......', // 9  hat band
  '......hhhhhhhhhhhhhh....', // 10 brim top
  '.hhhhhhhhhhhhhhhhhhhhhh.', // 11 wide brim
  '........fffSSSSSS.......', // 12
  '........SSSSSSSS........', // 13
  '........SSSSgggg........', // 14 sunglasses
  '........SSSSgggg........', // 15
  '........SSSSSSS.........', // 16 chin
  '.........SSSSS..........', // 17 jaw taper
  '........GGGGGGG.........', // 18 scarf sits at neck
  '.......GGGGGGGGG........', // 19
  '.......GGGGGGGGG........', // 20
  '......LCCCCCCCCC........', // 21 collar / shoulders
  '.....CCCCCCCCCCC........', // 22
  '....CCCCCCCCCCC.........', // 23
  '...CCCCCCCCCCCD.........', // 24
  '...CDCCCCCCCCCD.........', // 25
  '...CDCCCCCCCCCD.........', // 26
  '..CCDCCCCCCCCDD.........', // 27
  '..CCDCCCCCCCCDD.........', // 28
  '..CCDCCCCCCCCDD.........', // 29
  '..CCDCCCCCCCDD..........', // 30
  '..CCDCCCCCCCDD..........', // 31
  '..CCDCCCCCCDD...........', // 32
  '..CCDCCCCCCDD...........', // 33
  '..CCDCCCCCCDD...........', // 34
  '..CCDCCCCCDDD...........', // 35 belt line shadow begins
  '..CCDCCCCCDDD...........', // 36
  '..CCDCCCCDDDD...........', // 37
  '..CCDCCCCDDDD...........', // 38
  '..CCDCCCDDDD............', // 39
  '..CCDCCCDDDD............', // 40
  '..CCDCCDDDD.............', // 41 coat flares back
  '..CCDCCDDDD.............', // 42
  '..CCDCDDDD..............', // 43
  '..CCDCDDDD..............', // 44
  '..CCDDDDD...............', // 45
  '..CCDDDDD...............', // 46 hem
  '..CCDDD.................', // 47 hem tail
];

/** Mirrors each row left-to-right (for alternating walk phases). */
function mirrorRows(rows: string[]): string[] {
  return rows.map((r) => [...r].reverse().join(''));
}

const COLE_LEGS_IDLE = [
  '....PPP..PPP............', // 48
  '....PPP..PPP............', // 49
  '...PPPP..PPPP...........', // 50
  '...PPPP..PPPP...........', // 51
  '..BBBBB..BBBBB..........', // 52 boots
  '..BBBBB..BBBBB..........', // 53
];

const COLE_LEGS_WALK_A = [
  '....PPP....PPP..........', // 48
  '...PPP......PPP.........', // 49
  '..PPP........PPP........', // 50
  '..PP..........PP........', // 51
  '.BBB..........BBB.......', // 52
  '.BBB..........BBB.......', // 53
];

const COLE_LEGS_WALK_B = [
  '.....PPPPPPP............', // 48
  '.....PPP.PPP............', // 49
  '....PPP..PPP............', // 50
  '....PP....PP............', // 51
  '..BBBB...BBBB...........', // 52
  '..BBBB...BBBB...........', // 53
];

const COLE_LEGS_LAND = [
  '.....PPPPPPP............', // 48 legs compressed together
  '....PPPPPPPPP...........', // 49
  '...PPPPP..PPPPP.........', // 50 knees bent wide
  '...PPPP....PPPP.........', // 51
  '..BBBBB....BBBBB........', // 52 boots, knees apart
  '..BBBBB....BBBBB........', // 53
];

// Jump pose: legs tucked and raised off the ground line.
const COLE_LEGS_JUMP = [
  '....PPPP..PPPP..........', // 48 raised
  '...PPPP....PPPP.........', // 49
  '..PPPP......PPPP........', // 50 knees bent forward
  '..BBP........PBB........', // 51 boots tucked
  '..BB.........BB.........', // 52
  '........................', // 53 airborne spacing
];

export const COLE_FRAMES: { idle: THREE.CanvasTexture[]; walk: THREE.CanvasTexture[]; jump: THREE.CanvasTexture[] } = {
  idle: framesFromRows(COLE_W, [[...COLE_BODY_TOGETHER, ...COLE_LEGS_IDLE]], COLE_PALETTE),
  // 4-phase walk cycle: contact A → pass → contact B (mirror of A) → pass
  walk: framesFromRows(
    COLE_W,
    [
      [...COLE_BODY_TOGETHER, ...COLE_LEGS_WALK_A],
      [...COLE_BODY_TOGETHER, ...COLE_LEGS_WALK_B],
      [...COLE_BODY_TOGETHER, ...mirrorRows(COLE_LEGS_WALK_A)],
      [...COLE_BODY_TOGETHER, ...COLE_LEGS_WALK_B],
    ],
    COLE_PALETTE,
  ),
  jump: framesFromRows(
    COLE_W,
    [
      [...COLE_BODY_TOGETHER, ...COLE_LEGS_JUMP],
      [...COLE_BODY_TOGETHER, ...COLE_LEGS_LAND],
    ],
    COLE_PALETTE,
  ),
};

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
  '......MMMMMMMMMM........', // 2
  '......MMMMMMMMMM........', // 3
  '......MMMMMMMMMM........', // 4
  '......VVVVVVVVVV........', // 5  visor slit glows
  '......MMMMMMMMMM........', // 6
  '.......MMMMMMMM.........', // 7
  '........MMMMMM..........', // 8  chin guard
  '.......JJJJJJJJ.........', // 9  collar
  '......JJJJJJJJJJ........', // 10 shoulders
  '.....JJJJJJJJJJJ........', // 11
  '....mJJJJJJJJJJm........', // 12 pauldron shadows
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
};

const DRONE_BODY = [
  '.M...M....M...M.', // 0 rotor tips
  '..MM........MM..', // 1 rotor blur
  '...dDDDDDDd.....', // 2 top hull
  '..dDDDDDDDDd....', // 3
  '..DDDDDDDDDD....', // 4
  '..DDVVVVVVDD....', // 5 sensor eye band
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
    '..DDVVVVVVDD....',
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
  B: '#0d1218', // boots
};

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
  '.csssssssssc...', // 14
  '.csssssssssc...', // 15
  '.csssssssssc...', // 16
  '.csssssssssc...', // 17
  '.cssssssssc....', // 18
  '.cssssssssc....', // 19
  '.cssssssssc....', // 20
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
];

export function makeLyraFrame(): THREE.CanvasTexture {
  return framesFromRows(LYRA_W, [LYRA_IDLE], LYRA_PALETTE)[0];
}
