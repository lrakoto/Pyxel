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
];
