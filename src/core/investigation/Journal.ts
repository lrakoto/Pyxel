import type { ClueDef } from './Clue';

/**
 * The case journal — Cole's running record of what he's found. Clues are
 * collected once and kept for the session. The journal also tracks the
 * current case objective, which evolves as key clues are found.
 */
export class Journal {
  /** Collected clues in the order they were found. */
  private readonly found: ClueDef[] = [];
  private readonly foundIds = new Set<string>();

  /** Current objective line shown in the journal and HUD. */
  private objective = "Find out what happened to Marlon Graves.";

  /** Optional callback fired when a new clue is added. */
  onClueAdded: ((clue: ClueDef) => void) | null = null;

  /** Objective overrides keyed by the clue that triggers them. */
  private readonly objectiveTriggers: Record<string, string> = {
    'everybody-nobody-painting': "The painting is a map of stolen minds. Find who wired Marlon into it.",
    'neural-device': "The device was still running. Someone wanted into Marlon's head.",
    'wall-writing': '"Find the first one." Marlon left testimony. Find the first fragment.',
  };

  /** Add a clue. Returns true if it was newly collected, false if already have it. */
  add(clue: ClueDef): boolean {
    if (this.foundIds.has(clue.id)) return false;
    this.foundIds.add(clue.id);
    this.found.push(clue);
    const next = this.objectiveTriggers[clue.id];
    if (next) this.objective = next;
    this.onClueAdded?.(clue);
    return true;
  }

  /** True if Cole has collected the given clue. */
  has(id: string): boolean {
    return this.foundIds.has(id);
  }

  /** All collected clues, in discovery order. */
  get clues(): readonly ClueDef[] {
    return this.found;
  }

  /** The current case objective. */
  get currentObjective(): string {
    return this.objective;
  }

  /** Advance the objective directly (case progress beats). */
  setObjective(next: string) {
    this.objective = next;
  }

  /** Number of clues collected. */
  get count(): number {
    return this.found.length;
  }
}
