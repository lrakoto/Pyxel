import type { TuningKey } from './tuning';

export interface TuningParam {
  key: TuningKey;
  label: string;
  min: number;
  max: number;
  step: number;
  group: string;
}

/** Drives the tuning panel's sliders. Order here is the order shown. */
export const TUNING_SCHEMA: TuningParam[] = [
  { key: 'bumpScale', label: 'Bump scale', min: 0, max: 1, step: 0.01, group: 'Street' },
  { key: 'groundRoughness', label: 'Roughness', min: 0, max: 1, step: 0.01, group: 'Street' },
  { key: 'groundMetalness', label: 'Metalness', min: 0, max: 1, step: 0.01, group: 'Street' },
  { key: 'gritCount', label: 'Grit density', min: 2000, max: 30000, step: 500, group: 'Street' },
  { key: 'crackCount', label: 'Cracks', min: 0, max: 20, step: 1, group: 'Street' },
  { key: 'pedestrianCount', label: 'Count', min: 0, max: 24, step: 1, group: 'Pedestrians' },
  { key: 'pedSpeedMin', label: 'Speed min', min: 0.2, max: 2, step: 0.05, group: 'Pedestrians' },
  { key: 'pedSpeedMax', label: 'Speed max', min: 0.5, max: 3, step: 0.05, group: 'Pedestrians' },
  { key: 'scarfLength', label: 'Length', min: 0.3, max: 1.8, step: 0.05, group: 'Scarf' },
  { key: 'scarfWidth', label: 'Width', min: 0.02, max: 0.16, step: 0.005, group: 'Scarf' },
  { key: 'scarfGravity', label: 'Gravity', min: 0, max: 16, step: 0.5, group: 'Scarf' },
  { key: 'scarfDamping', label: 'Damping', min: 0.8, max: 0.99, step: 0.005, group: 'Scarf' },
  { key: 'scarfWind', label: 'Wind', min: 0, max: 10, step: 0.1, group: 'Scarf' },
  { key: 'scarfLoft', label: 'Loft', min: 0, max: 5, step: 0.1, group: 'Scarf' },
  { key: 'scarfFlutter', label: 'Flutter', min: 0, max: 3, step: 0.05, group: 'Scarf' },
  { key: 'scarfStiffness', label: 'Stiffness', min: 2, max: 14, step: 1, group: 'Scarf' },
  { key: 'scarfGlow', label: 'Edge glow', min: 0, max: 2, step: 0.05, group: 'Scarf' },
  { key: 'footstepInterval', label: 'Cadence', min: 0.2, max: 1, step: 0.02, group: 'Footsteps' },
  { key: 'footstepVolume', label: 'Volume', min: 0, max: 3, step: 0.05, group: 'Footsteps' },
  { key: 'footstepClack', label: 'Clack', min: 0, max: 3, step: 0.05, group: 'Footsteps' },
  { key: 'footstepPing', label: 'Tok', min: 0, max: 2, step: 0.05, group: 'Footsteps' },
  { key: 'footstepKnock', label: 'Knock', min: 0, max: 2, step: 0.05, group: 'Footsteps' },
  { key: 'footstepTone', label: 'Tone (Hz)', min: 800, max: 5000, step: 100, group: 'Footsteps' },
  { key: 'ambienceExterior', label: 'Exterior bed', min: 0, max: 1.5, step: 0.05, group: 'Ambience' },
  { key: 'ambienceInterior', label: 'Interior bed', min: 0, max: 1.5, step: 0.05, group: 'Ambience' },
  { key: 'interiorMuffledRain', label: 'Muffled rain', min: 0, max: 1.5, step: 0.05, group: 'Ambience' },
  { key: 'interiorBuildingHum', label: 'Building hum', min: 0, max: 1.5, step: 0.05, group: 'Ambience' },
  { key: 'neuralPulse', label: 'Neural pulse', min: 0, max: 1.5, step: 0.05, group: 'Ambience' },
];
