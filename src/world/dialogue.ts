export interface InteractionDef {
  x: number;
  z: number;
  radius: number;
  label: string;
  /** Lines shown when examined without any special clue state. */
  lines: string[];
  /**
   * Optional clue granted the first time this object is examined in
   * investigation mode. Once granted, examining again shows `repeatLines`
   * (if present) or the base `lines`.
   */
  clueId?: string;
  clueTitle?: string;
  clueBody?: string;
  /** Lines shown on re-examination after `clueId` has been collected. */
  repeatLines?: string[];
  /**
   * Conditional insight: shown instead of `lines` when Cole already holds
   * the clue `requiresClue`. Lets objects respond to case progress.
   */
  requiresClue?: string;
  conditionalLines?: string[];
  /**
   * Height above ground (world y) where the investigation glint floats.
   * Defaults to a chest-height marker if unset.
   */
  glintY?: number;
}

/** Sector 7 street interactions — exported so sector7.ts can attach them to the area. */
export const SECTOR7_INTERACTIONS: InteractionDef[] = [
  {
    x: -15.5, z: -8.2, radius: 3,
    label: 'NO/BODY sign',
    lines: [
      'The sign hums in deep violet, casting a bruise-colored glow across the wet sidewalk. "NO/BODY." A nightclub, maybe — or a gallery for art no one claims. The name feels less like a title and more like a verdict.',
    ],
  },
  {
    x: -9.5, z: -8.2, radius: 3,
    label: 'SECTOR 7 sign',
    lines: [
      'Cyan letters blaze against the dark: "SECTOR 7." The municipal marker for this slice of the city — industrial, artistic, forgotten. Home to the dead artist I\'m here about.',
    ],
  },
  {
    x: -4.5, z: -8.2, radius: 3,
    label: 'HOTEL sign',
    lines: [
      'A red vacancy sign flickers above a narrow doorway. Rooms by the hour, no questions asked. The sort of place where people come to disappear — or to be found dead.',
    ],
  },
  {
    x: 2.5, z: -8.2, radius: 3,
    label: 'MEMORY DEN sign',
    lines: [
      '"MEMORY DEN." Pink neon, soft and invasive like a thought you didn\'t invite. They sell experiences here — other people\'s memories, recorded, packaged, pumped straight into your neural jack. Illegal in most sectors. Thriving in this one.',
      'I wonder what memories Marlon Graves left behind.',
    ],
  },
  {
    x: 6.0, z: -8.2, radius: 3,
    label: 'OPEN sign',
    lines: [
      'A small green "OPEN" sign in a ground-floor window. Whatever\'s inside is still running this late. A diner, maybe. A repair shop for augments. In Sector 7, everything stays open because the city never sleeps — just changes shape.',
    ],
  },
  {
    x: 10, z: -8.2, radius: 3,
    label: 'ヌードル sign',
    lines: [
      'The katakana reads "Noodles." Orange neon drips down the wet facade like hot broth. A late-night ramen joint tucked between a memory den and a liquor store. The smell of pork fat and sesame cuts through the rain.',
    ],
  },
  {
    x: 13.5, z: -8.2, radius: 3,
    label: 'LIQUOR sign',
    lines: [
      'Violet light from a storefront window. Bottles lined up behind reinforced glass. The kind of place that sells cheap synth-booze to people trying to forget what they\'ve seen — or what they\'ve become.',
    ],
  },
  {
    x: -11.2, z: -6.5, radius: 2.5,
    label: 'Vending machine',
    lines: [
      'A vending machine glows cyan in the dark. The display cycles through brightly colored cans with names I don\'t recognize — synthetic vitamins, neural boosters, something called "DreamCola." A thin trickle of condensation runs down the glass.',
    ],
  },
  {
    x: 6.7, z: -6.5, radius: 2.5,
    label: 'Vending machine',
    lines: [
      'Pink light pulses from this machine\'s header panel. The selection includes "Focus," "Zen," and "Drive" — over-the-counter neural enhancers. No age check. No receipt. Just a slot and a button.',
    ],
  },
  {
    x: -7, z: -5.0, radius: 2.5,
    label: 'Steam vent',
    lines: [
      'Hot breath from the city\'s belly. Steam rises from a grated vent, carrying the metallic smell of underground railways and buried cables. Somewhere below, the city is still running — indifferent, mechanical, alive.',
    ],
  },
  {
    x: 9.5, z: -5.0, radius: 2.5,
    label: 'Steam vent',
    lines: [
      'A column of steam billows from the street, catching the neon overhead and turning it into shifting clouds of color. The heat is almost pleasant against the cold rain. Almost.',
    ],
  },
  {
    x: 0.8, z: -4.5, radius: 2.5,
    label: 'Manhole cover',
    lines: [
      'A heavy iron disc set into the asphalt. Faint vibrations tremble through its surface — the subway, or something deeper. The City of New Angeles maintains over twelve thousand miles of tunnels down there. Some of them aren\'t on any map.',
    ],
  },
  {
    x: -6, z: 3.3, radius: 3.5,
    label: 'Utility pole',
    lines: [
      'A sagging power pole, thick with cables and transformers. The wires droop between poles like wet clotheslines, humming with an undercurrent of stolen electricity. Someone\'s tapped into the grid — illegally, inevitably.',
    ],
  },
  {
    x: -17, z: -4.0, radius: 2,
    label: 'Curb edge',
    lines: [
      'The curb where the sidewalk meets the road. Water pools in the cracks, reflecting the neon signs upside down. The asphalt is cracked and tar-patched — a map of the city\'s neglect rendered in black ribbon.',
    ],
  },
];

export class DialogueManager {
  private interactions: InteractionDef[] = [];
  private interactIndex = -1;
  private open = false;
  private lineIndex = 0;
  private charIndex = 0;
  private charTimer = 0;
  private typed = '';
  /** Lines resolved for the currently open interaction. */
  private activeLines: string[] = [];

  /**
   * Resolve which of an interaction's line sets applies, given clue state.
   * `hasClue` is provided by the game (backed by the journal). Priority:
   * conditional insight → repeat-after-clue → base lines.
   */
  private resolver: ((def: InteractionDef) => string[]) | null = null;

  /** Register the line resolver (called once at startup). */
  setResolver(fn: (def: InteractionDef) => string[]) {
    this.resolver = fn;
  }

  private readonly hintEl: HTMLElement;
  private readonly boxEl: HTMLElement;
  private readonly textEl: HTMLElement;
  private readonly speakerEl: HTMLElement;
  private readonly advanceEl: HTMLElement;

  constructor() {
    this.hintEl = document.getElementById('interact-hint')!;
    this.boxEl = document.getElementById('dialogue-box')!;
    this.textEl = document.getElementById('dialogue-text')!;
    this.speakerEl = document.getElementById('dialogue-speaker')!;
    this.advanceEl = document.getElementById('dialogue-advance')!;
    this.close();
  }

  /** Swap the active interaction set — called on area transition. */
  setInteractions(defs: InteractionDef[]) {
    if (this.open) this.close();
    this.interactions = defs;
  }

  /** Returns the nearest interaction within range, or null. */
  findNearby(playerX: number): InteractionDef | null {
    let best: { def: InteractionDef; dist: number } | null = null;
    for (const def of this.interactions) {
      const dx = def.x - playerX;
      const dist = Math.abs(dx);
      if (dist < def.radius && (!best || dist < best.dist)) {
        best = { def, dist };
      }
    }
    return best?.def ?? null;
  }

  get isOpen(): boolean {
    return this.open;
  }

  /** Start a dialogue session with the given interaction. */
  openDialogue(def: InteractionDef) {
    const idx = this.interactions.indexOf(def);
    this.interactIndex = idx;
    this.open = true;
    this.lineIndex = 0;
    this.charIndex = 0;
    this.typed = '';
    this.activeLines = this.resolver ? this.resolver(def) : def.lines;
    this.hintEl.style.display = 'none';
    this.boxEl.style.display = 'block';
    this.speakerEl.textContent = def.label;
    this.advanceEl.style.display = 'none';
    this.textEl.textContent = '';
  }

  /** The interaction currently open, or null. */
  get current(): InteractionDef | null {
    return this.open && this.interactIndex >= 0 ? this.interactions[this.interactIndex] : null;
  }

  /** Close the dialogue and restore the hint. */
  close() {
    this.open = false;
    this.interactIndex = -1;
    this.boxEl.style.display = 'none';
    this.hintEl.style.display = 'block';
  }

  /** Advance to the next line, or close if on the last line. */
  advance(): boolean {
    if (!this.open) return false;
    if (this.interactIndex < 0) { this.close(); return false; }

    // If still typing, finish the current line instantly
    if (this.charIndex < this.activeLines[this.lineIndex].length) {
      this.typed = this.activeLines[this.lineIndex];
      this.charIndex = this.typed.length;
      this.textEl.textContent = this.typed;
      this.advanceEl.style.display = 'block';
      return true;
    }

    // Move to next line
    this.lineIndex++;
    if (this.lineIndex >= this.activeLines.length) {
      this.close();
      return true;
    }
    this.charIndex = 0;
    this.typed = '';
    this.advanceEl.style.display = 'none';
    this.textEl.textContent = '';
    return true;
  }

  /** Called each frame to drive the typewriter effect. */
  update(dt: number) {
    if (!this.open) return;
    if (this.interactIndex < 0) return;
    const line = this.activeLines[this.lineIndex];
    if (this.charIndex < line.length) {
      this.charTimer += dt;
      // ~45 chars per second
      const charsToAdd = Math.floor(this.charTimer * 45);
      if (charsToAdd > 0) {
        this.charIndex = Math.min(this.charIndex + charsToAdd, line.length);
        this.typed = line.slice(0, this.charIndex);
        this.textEl.textContent = this.typed;
        this.charTimer = 0;
        if (this.charIndex >= line.length) {
          this.advanceEl.style.display = 'block';
        }
      }
    }
  }
}
