/**
 * Pooled floating combat numbers — small DOM labels that pop at a screen
 * position, drift upward, and fade. Used for hit damage and kill markers.
 * Pooling keeps a fixed set of <div>s so rapid fire doesn't thrash the DOM.
 */

interface Tick {
  el: HTMLDivElement;
  life: number;
  max: number;
  x: number;
  y: number;
  vy: number;
  active: boolean;
}

const POOL = 28;

export class FloatingText {
  readonly root: HTMLDivElement;
  private readonly pool: Tick[] = [];

  constructor() {
    this.root = document.createElement('div');
    this.root.className = 'sh-floaters';
    for (let i = 0; i < POOL; i++) {
      const el = document.createElement('div');
      el.className = 'sh-float';
      el.style.opacity = '0';
      this.root.appendChild(el);
      this.pool.push({ el, life: 0, max: 1, x: 0, y: 0, vy: 0, active: false });
    }
  }

  /** Spawns text at screen px (sx, sy). `big` is used for kill markers. */
  spawn(text: string, sx: number, sy: number, color: string, big = false) {
    const t = this.pool.find((p) => !p.active);
    if (!t) return;
    t.active = true;
    t.max = t.life = big ? 0.8 : 0.55;
    t.x = sx + (Math.random() - 0.5) * 14;
    t.y = sy;
    t.vy = big ? 70 : 48;
    t.el.textContent = text;
    t.el.style.color = color;
    t.el.style.fontSize = big ? '20px' : '13px';
    t.el.style.fontWeight = big ? '700' : '600';
    t.el.style.textShadow = `0 0 6px ${color}`;
    t.el.style.opacity = '1';
  }

  update(dt: number) {
    for (const t of this.pool) {
      if (!t.active) continue;
      t.life -= dt;
      if (t.life <= 0) {
        t.active = false;
        t.el.style.opacity = '0';
        continue;
      }
      t.y -= t.vy * dt;
      t.vy *= Math.max(0, 1 - dt * 2.5);
      const k = t.life / t.max;
      t.el.style.opacity = String(Math.min(1, k * 1.6));
      t.el.style.transform = `translate(${t.x}px, ${t.y}px)`;
    }
  }

  reset() {
    for (const t of this.pool) {
      t.active = false;
      t.el.style.opacity = '0';
    }
  }
}
