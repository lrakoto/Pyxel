/**
 * Drives a single plane mesh with frames from a SpriteSheet, honoring
 * Aseprite tags: it understands the four loop directions and per-frame
 * durations. One animator per sprite instance; the underlying textures are
 * shared across all instances by SpriteLibrary's cache.
 */
import * as THREE from 'three';
import type { SpriteSheet } from './SpriteLibrary';

export interface PlayOptions {
  /** Tag name (case-insensitive). If omitted / missing, plays all frames. */
  tag?: string;
  /** Called when the tag finishes (once, for ping-pong and reverse). */
  onDone?: () => void;
  /** Restart even if this tag is already playing. */
  restart?: boolean;
}

type Direction = 0 | 1 | 2 | 3;

export class SpriteAnimator {
  private sheet: SpriteSheet;
  private material: THREE.MeshStandardMaterial | THREE.MeshBasicMaterial;
  private frames: number[] = [];
  private idx = 0;
  private timer = 0;
  private pingPongDir: 1 | -1 = 1;
  private playing = false;
  private onDone: (() => void) | null = null;
  private currentTag = '';
  /** Frames-per-second used to play ranges (defaults to the first frame's duration). */
  private overrideDuration = -1;
  private holdLast = false;

  constructor(
    mesh: THREE.Mesh,
    sheet: SpriteSheet,
    material: THREE.MeshStandardMaterial | THREE.MeshBasicMaterial,
  ) {
    this.sheet = sheet;
    this.material = material;
    this.setFrame(sheet.frames[0] ? 0 : -1);
    void mesh; // mesh kept for API clarity / future pivot use
  }

  /** Starts playback of a tag, or of the full frame range when no tag matches. */
  play(opts: PlayOptions = {}) {
    const tagName = (opts.tag ?? '').toLowerCase();
    if (!opts.restart && tagName === this.currentTag && this.playing) return;
    this.currentTag = tagName;

    let from = 0;
    let to = this.sheet.frames.length - 1;
    let direction: Direction = 0;

    if (tagName) {
      const tag = this.sheet.tags[tagName];
      if (tag) {
        from = tag.from;
        to = tag.to;
        direction = tag.direction;
      } else {
        console.warn(`[sprites] no tag "${tagName}" on ${this.sheet.id}; playing all frames`);
      }
    }

    // Materialise the frame order for the tag's direction up front, so the
    // update loop is a simple index walk.
    if (direction === 0 || direction === 2) {
      this.frames = range(from, to);
    } else {
      this.frames = range(to, from);
    }
    // Ping-pong plays forward then back; the reverse edge starts the ping.
    this.pingPongDir = direction === 3 ? -1 : 1;
    this.idx = 0;
    this.timer = 0;
    this.playing = true;
    this.onDone = opts.onDone ?? null;
    this.overrideDuration = -1;
    this.holdLast = false;
    this.applyCurrent();
  }

  /** Override: treat every frame as `seconds` long instead of the authored time. */
  setOverrideDuration(seconds: number) {
    this.overrideDuration = seconds;
  }

  /** When true, looping tags cycle; when false they freeze on the last frame. */
  setHoldLast(hold: boolean) {
    this.holdLast = hold;
  }

  /** Resumes a paused / held animation. */
  resume() {
    if (!this.playing && this.frames.length > 1) this.playing = true;
  }

  stop() {
    this.playing = false;
  }

  /** Advances the animation; call every frame with the world dt. */
  update(dt: number) {
    if (!this.playing || this.frames.length <= 1) return;
    this.timer += dt;
    const frame = this.sheet.frames[this.currentFrameIndex()];
    const duration = this.overrideDuration > 0 ? this.overrideDuration : (frame?.duration ?? 0);
    if (duration <= 0) {
      this.advance();
      return;
    }
    while (this.timer >= duration) {
      this.timer -= duration;
      if (!this.advance()) return;
    }
  }

  /** Moves to the next frame; returns false when the animation has ended. */
  private advance(): boolean {
    const dir = this.currentDirection();
    if (dir !== 2 && dir !== 3) {
      this.idx++;
      if (this.idx >= this.frames.length) {
        if (this.holdLast) {
          this.idx = this.frames.length - 1;
          this.playing = false;
          this.onDone?.();
          return false;
        }
        this.idx = 0;
        this.applyCurrent();
        this.onDone?.();
        return true;
      }
      this.applyCurrent();
      return true;
    }

    // Ping-pong / ping-pong-reverse: bounce at the ends.
    const next = this.idx + this.pingPongDir;
    if (next < 0 || next >= this.frames.length) {
      if (this.holdLast) {
        this.playing = false;
        this.onDone?.();
        return false;
      }
      // Wrap around for continuous loops.
      this.pingPongDir = (this.pingPongDir * -1) as 1 | -1;
      this.idx = THREE.MathUtils.clamp(this.idx + this.pingPongDir, 0, this.frames.length - 1);
      this.applyCurrent();
      return true;
    }
    this.idx = next;
    if (this.idx === (this.pingPongDir === 1 ? this.frames.length - 1 : 0)) {
      this.pingPongDir = (this.pingPongDir * -1) as 1 | -1;
    }
    this.applyCurrent();
    return true;
  }

  private currentDirection(): Direction {
    const tag = this.sheet.tags[this.currentTag];
    return tag ? tag.direction : 0;
  }

  private currentFrameIndex(): number {
    return this.frames[this.idx] ?? 0;
  }

  private setFrame(i: number) {
    if (i < 0) return;
    const frame = this.sheet.frames[i];
    if (frame) this.material.map = frame.texture;
  }

  private applyCurrent() {
    this.setFrame(this.currentFrameIndex());
  }
}

function range(a: number, b: number): number[] {
  const out: number[] = [];
  const step = a <= b ? 1 : -1;
  for (let i = a; i !== b + step; i += step) out.push(i);
  return out;
}
