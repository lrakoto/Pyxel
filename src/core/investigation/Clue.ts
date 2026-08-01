/**
 * A clue is a discrete piece of the case Cole has uncovered. Clues are granted
 * by examining objects in investigation mode, persist for the whole session,
 * and unlock conditional insight on other examinables.
 */
export interface ClueDef {
  /** Unique clue id, e.g. "neural-device", "wall-writing". */
  id: string;
  /** Short journal title, e.g. "The Neural Interface". */
  title: string;
  /** Journal body — Cole's notes on what this means for the case. */
  body: string;
}
