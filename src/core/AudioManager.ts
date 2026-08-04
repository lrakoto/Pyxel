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

  /* ── Discovery chime ─────────────────────────────────────────────── */

  /** Soft two-note synth ping when a new glint catches Cole's eye. */
  playDiscovery() {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    // A tiny rising fifth — quiet, glassy, unobtrusive under the ambient mix.
    for (const [i, freq] of [660, 990].entries()) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const g = ctx.createGain();
      const t0 = t + i * 0.09;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.055, t0 + 0.025);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.55);
      // A little shimmer: fast, shallow vibrato.
      const vib = ctx.createOscillator();
      vib.frequency.value = 6;
      const vibG = ctx.createGain();
      vibG.gain.value = 2.5;
      vib.connect(vibG).connect(osc.frequency);
      vib.start(t0);
      vib.stop(t0 + 0.6);
      osc.connect(g).connect(this.master);
      osc.start(t0);
      osc.stop(t0 + 0.6);
    }
  }

  /* ── Investigation duck ──────────────────────────────────────────── */
  private ducked = false;

  /** Duck the whole mix while investigating (the world "leans in"). */
  duck() {
    if (!this.ctx || !this.master || this.ducked) return;
    this.ducked = true;
    this.master.gain.setTargetAtTime(0.28, this.ctx.currentTime, 0.35);
  }

  /** Restore full ambience. */
  unduck() {
    if (!this.ctx || !this.master || !this.ducked) return;
    this.ducked = false;
    this.master.gain.setTargetAtTime(0.5, this.ctx.currentTime, 0.45);
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

  /* ── Combat one-shots ──────────────────────────────────────────────── */

  /**
   * Machine-pistol crack: a short bright noise transient (the report) layered
   * with a fast low "body" thump. A little random detune per shot stops
   * sustained fire from sounding like a single looped buzz.
   */
  playGunshot() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const detune = 0.92 + Math.random() * 0.16;

    // Report — filtered noise burst, very short.
    const src = ctx.createBufferSource();
    src.buffer = this.createNoiseBuffer(0.06);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1800 * detune;
    bp.Q.value = 0.8;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 600;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.5, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    src.connect(hp).connect(bp).connect(env).connect(this.master!);
    src.start(t);

    // Body — quick pitched snap so each round has weight.
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(220 * detune, t);
    osc.frequency.exponentialRampToValueAtTime(70, t + 0.05);
    const oenv = ctx.createGain();
    oenv.gain.setValueAtTime(0.35, t);
    oenv.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    osc.connect(oenv).connect(this.master!);
    osc.start(t);
    osc.stop(t + 0.07);
  }

  /** Bullet impact tick — bright metallic ping for drones, duller for bodies. */
  playImpact(kind: 'metal' | 'body') {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.createNoiseBuffer(0.04);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = kind === 'metal' ? 3200 : 520;
    bp.Q.value = kind === 'metal' ? 4 : 1.2;
    const env = ctx.createGain();
    env.gain.setValueAtTime(kind === 'metal' ? 0.3 : 0.4, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + (kind === 'metal' ? 0.06 : 0.09));
    src.connect(bp).connect(env).connect(this.master!);
    src.start(t);
  }

  /** Enemy destruction — a noise burst sweeping down over a low boom. */
  playKill() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;

    const src = ctx.createBufferSource();
    src.buffer = this.createNoiseBuffer(0.3);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(3500, t);
    lp.frequency.exponentialRampToValueAtTime(300, t + 0.28);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.5, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    src.connect(lp).connect(env).connect(this.master!);
    src.start(t);

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(110, t);
    osc.frequency.exponentialRampToValueAtTime(38, t + 0.25);
    const oenv = ctx.createGain();
    oenv.gain.setValueAtTime(0.45, t);
    oenv.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    osc.connect(oenv).connect(this.master!);
    osc.start(t);
    osc.stop(t + 0.32);
  }

  /** Cole takes damage — a short distorted descending tone. */
  playHurt() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(300, t);
    osc.frequency.exponentialRampToValueAtTime(90, t + 0.18);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(0.3, t + 0.01);
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    osc.connect(env).connect(this.master!);
    osc.start(t);
    osc.stop(t + 0.22);
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
