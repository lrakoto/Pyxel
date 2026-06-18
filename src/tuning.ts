// Live-tunable scene values. The numbers below are rewritten in place by the
// in-app tuning panel's Save button (dev server only) — prefer adjusting them
// with the sliders rather than editing by hand, so the panel stays in sync.
export const TUNING = {
  bumpScale: 1,
  groundRoughness: 0.2,
  groundMetalness: 0,
  gritCount: 30000,
  crackCount: 16,
  pedestrianCount: 24,
  pedSpeedMin: 0.7,
  pedSpeedMax: 1.6,
  scarfLength: 1.15,
  scarfWidth: 0.045,
  scarfGravity: 4.5,
  scarfDamping: 0.8,
  scarfWind: 0,
  scarfLoft: 1.6,
  scarfFlutter: 3,
  scarfStiffness: 14,
  scarfGlow: 2,
  footstepInterval: 0.46,
  footstepVolume: 2.05,
  footstepClack: 3,
  footstepPing: 0.45,
  footstepKnock: 2,
  footstepTone: 800,
};

export type TuningKey = keyof typeof TUNING;
