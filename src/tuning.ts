// Live-tunable scene values. The numbers below are rewritten in place by the
// in-app tuning panel's Save button (dev server only) — prefer adjusting them
// with the sliders rather than editing by hand, so the panel stays in sync.
export const TUNING = {
  bumpScale: 1,
  groundRoughness: 0.22,
  groundMetalness: 0,
  gritCount: 30000,
  crackCount: 16,
  pedestrianCount: 24,
  pedSpeedMin: 0.7,
  pedSpeedMax: 1.6,
};

export type TuningKey = keyof typeof TUNING;
