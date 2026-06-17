/**
 * Procedural audio for the night street. All sounds are synthesized through
 * the Web Audio API — no external assets needed.
 *
 * The AudioContext is created lazily on the first user interaction (keypress)
 * to satisfy browser autoplay policies.
 */

const FOOTSTEP_INTERVAL = 0.16; // matches the animation FRAME_TIME

export class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private footstepTimer = 0;

  /** Initialises the AudioContext and wires up all continuous sound sources. */
  init() {
    if (this.ctx) return;
    this.ctx = new AudioContext();

    // Master gain (all sounds route through this)
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.4;
    this.master.connect(this.ctx.destination);

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
    const buf = this.createNoiseBuffer(0.06);
    const src = ctx.createBufferSource();
    src.buffer = buf;

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 600 + Math.random() * 400;
    bp.Q.value = 1.5;

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.35, ctx.currentTime);
    env.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);

    src.connect(bp).connect(env).connect(this.master!);
    src.start(ctx.currentTime);
  }

  /* ── Per-frame update ──────────────────────────────────────────────── */

  /** Called each frame. `walking` should be true when the player is moving. */
  update(dt: number, walking: boolean) {
    if (!this.ctx) return;

    if (walking) {
      this.footstepTimer += dt;
      if (this.footstepTimer >= FOOTSTEP_INTERVAL) {
        this.footstepTimer -= FOOTSTEP_INTERVAL;
        this.playFootstep();
      }
    } else {
      this.footstepTimer = 0;
    }
  }
}
