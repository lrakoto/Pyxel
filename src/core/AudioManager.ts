/**
 * Procedural audio for the night street. All sounds are synthesized through
 * the Web Audio API — no external assets needed.
 *
 * The AudioContext is created lazily on the first user interaction (keypress)
 * to satisfy browser autoplay policies.
 */

import { TUNING } from '../tuning';

/** exponentialRampToValueAtTime can't target 0, so floor slider-driven peaks. */
const audible = (v: number) => Math.max(v, 0.0001);

export class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private footstepTimer = 0;
  private stepParity = 0;

  /** Initialises the AudioContext and wires up all continuous sound sources. */
  init() {
    if (this.ctx) return;
    this.ctx = new AudioContext();

    // Master gain (all sounds route through this) → a limiter that tames
    // transient peaks so footsteps can be loud without clipping the mix.
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    const limiter = this.ctx.createDynamicsCompressor();
    limiter.threshold.value = -6;
    limiter.knee.value = 6;
    limiter.ratio.value = 12;
    limiter.attack.value = 0.002;
    limiter.release.value = 0.12;
    this.master.connect(limiter).connect(this.ctx.destination);

    this.startRain();
    this.startHum();
    this.startDrone();
  }

  private createNoiseBuffer(duration: number): AudioBuffer {
    const sr = this.ctx!.sampleRate;
    const len = Math.ceil(sr * duration);
    const buf = this.ctx!.createBuffer(1, len, sr);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  private noiseSource(buffer: AudioBuffer, loop = true): AudioBufferSourceNode {
    const src = this.ctx!.createBufferSource();
    src.buffer = buffer;
    src.loop = loop;
    return src;
  }

  /* ── Rain (two-layer noise: near + far) ─────────────────────────────── */

  private startRain() {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    g.gain.value = 0.35;
    g.connect(this.master!);

    // Near rain — brighter noise, moderate low-pass
    const near = this.noiseSource(this.createNoiseBuffer(2));
    const nearF = ctx.createBiquadFilter();
    nearF.type = 'lowpass';
    nearF.frequency.value = 800;
    near.connect(nearF).connect(g);

    // Far rain — darker, muffled
    const far = this.noiseSource(this.createNoiseBuffer(3));
    const farF = ctx.createBiquadFilter();
    farF.type = 'lowpass';
    farF.frequency.value = 250;
    const farG = ctx.createGain();
    farG.gain.value = 0.5;
    far.connect(farF).connect(farG).connect(g);

    // Volume wobble for motion
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.15;
    const lfoG = ctx.createGain();
    lfoG.gain.value = 0.12;
    lfo.connect(lfoG).connect(g.gain);
    lfo.start();

    near.start();
    far.start();
  }

  /* ── Neon hum (detuned 50/60 Hz harmonics) ─────────────────────────── */

  private startHum() {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    g.gain.value = 0.06;
    g.connect(this.master!);

    const freqs = [50, 60, 100, 120, 180];
    for (const f of freqs) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = f + (Math.random() - 0.5) * 1.5;
      const og = ctx.createGain();
      og.gain.value = 0.02 + (f < 80 ? 0.03 : 0.015);
      osc.connect(og).connect(g);
      osc.start();
    }
  }

  /* ── Deep ambient drone ────────────────────────────────────────────── */

  private startDrone() {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    g.gain.value = 0.08;
    g.connect(this.master!);

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 100;

    for (const f of [32, 45, 55]) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = f + (Math.random() - 0.5) * 0.5;
      osc.connect(lp).connect(g);
      osc.start();
    }
  }

  /* ── Footstep ──────────────────────────────────────────────────────── */

  private playFootstep() {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    // Alternate feet: a small pitch offset keeps it from sounding mechanical.
    this.stepParity ^= 1;
    const detune = this.stepParity ? 1 : 0.94;
    const vol = TUNING.footstepVolume;

    // Sharp heel "clack" — a bright, short noise transient through a resonant
    // bandpass, for the hard crack of a sole on concrete. This is the loud,
    // defining layer; its mid-high energy carries on any speaker.
    const src = ctx.createBufferSource();
    src.buffer = this.createNoiseBuffer(0.04);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 750;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = TUNING.footstepTone * detune;
    bp.Q.value = 2.2;
    const clack = ctx.createGain();
    clack.gain.setValueAtTime(audible(TUNING.footstepClack * vol), t);
    clack.gain.exponentialRampToValueAtTime(0.001, t + 0.045);
    src.connect(hp).connect(bp).connect(clack).connect(this.master!);
    src.start(t);

    // Resonant "tok" — a fast-decaying pitched snap that gives the heel its
    // hard, tonal ring on stone (sits between the crack and the low knock).
    const ping = ctx.createOscillator();
    ping.type = 'triangle';
    ping.frequency.setValueAtTime(1350 * detune, t);
    ping.frequency.exponentialRampToValueAtTime(720 * detune, t + 0.03);
    const pingEnv = ctx.createGain();
    pingEnv.gain.setValueAtTime(0.0001, t);
    pingEnv.gain.exponentialRampToValueAtTime(audible(TUNING.footstepPing * vol), t + 0.003);
    pingEnv.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    ping.connect(pingEnv).connect(this.master!);
    ping.start(t);
    ping.stop(t + 0.06);

    // A small, tight low knock just to ground the step — no boomy thud.
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150 * detune, t);
    osc.frequency.exponentialRampToValueAtTime(85 * detune, t + 0.04);
    const knock = ctx.createGain();
    knock.gain.setValueAtTime(0.0001, t);
    knock.gain.exponentialRampToValueAtTime(audible(TUNING.footstepKnock * vol), t + 0.005);
    knock.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    osc.connect(knock).connect(this.master!);
    osc.start(t);
    osc.stop(t + 0.1);
  }

  /* ── Per-frame update ──────────────────────────────────────────────── */

  /** Called each frame. `walking` should be true when the player is moving. */
  update(dt: number, walking: boolean) {
    if (!this.ctx) return;

    if (walking) {
      this.footstepTimer += dt;
      if (this.footstepTimer >= TUNING.footstepInterval) {
        this.footstepTimer -= TUNING.footstepInterval;
        this.playFootstep();
      }
    } else {
      this.footstepTimer = 0;
    }
  }
}
