/**
 * CTB (Conditional Turn-Based, FFX-style) battle engine — pure logic, no DOM.
 *
 * Every actor's turn meter fills at its `speed` per second. When a meter reaches
 * METER_MAX the actor takes a turn; faster actors act more often. The upcoming
 * order can be projected forward (without mutating state) for the turn-order bar,
 * and actions that change a meter (e.g. Defend recovers faster) reshuffle it —
 * the "conditional" part of CTB.
 */

export type Side = 'party' | 'enemy';
export type ActionKind = 'attack' | 'skill' | 'defend';

export const METER_MAX = 1000;

export interface Actor {
  id: string;
  name: string;
  side: Side;
  maxHp: number;
  hp: number;
  atk: number;
  def: number;
  speed: number;
  meter: number;
  defending: boolean;
}

export interface QueueEntry {
  id: string;
  name: string;
  side: Side;
}

export interface ActionResult {
  actor: Actor;
  kind: ActionKind;
  target: Actor | null;
  damage: number;
  text: string;
}

const SKILL_MULT = 1.7;
// Defend ends the turn early but the meter recovers faster, so the guard's next
// turn comes sooner — a small tactical reason to use it.
const DEFEND_METER = 360;

export class Battle {
  constructor(readonly actors: Actor[]) {}

  isAlive(a: Actor): boolean {
    return a.hp > 0;
  }

  living(side: Side): Actor[] {
    return this.actors.filter((a) => a.side === side && this.isAlive(a));
  }

  get outcome(): 'win' | 'lose' | null {
    if (this.living('enemy').length === 0) return 'win';
    if (this.living('party').length === 0) return 'lose';
    return null;
  }

  /** Fills meters by dt; returns the actor most over the threshold, or null. */
  advance(dt: number): Actor | null {
    let ready: Actor | null = null;
    for (const a of this.actors) {
      if (!this.isAlive(a)) continue;
      a.meter += a.speed * dt;
      if (a.meter >= METER_MAX && (!ready || a.meter > ready.meter)) ready = a;
    }
    return ready;
  }

  /** Projects the next `count` turns without mutating any actor. */
  projectQueue(count: number): QueueEntry[] {
    const sim = this.actors.filter((a) => this.isAlive(a)).map((a) => ({ a, meter: a.meter }));
    const out: QueueEntry[] = [];
    let guard = 0;
    while (out.length < count && guard++ < 300 && sim.length > 0) {
      let best = 0;
      let bestT = Infinity;
      for (let i = 0; i < sim.length; i++) {
        const t = Math.max(0, (METER_MAX - sim[i].meter) / sim[i].a.speed);
        if (t < bestT) {
          bestT = t;
          best = i;
        }
      }
      for (const s of sim) s.meter += s.a.speed * bestT;
      const a = sim[best].a;
      out.push({ id: a.id, name: a.name, side: a.side });
      sim[best].meter -= METER_MAX;
    }
    return out;
  }

  private rollDamage(attacker: Actor, target: Actor, mult: number): number {
    const base = attacker.atk * mult - target.def * 0.5;
    let dmg = Math.max(1, Math.round(base * (0.9 + Math.random() * 0.2)));
    if (target.defending) dmg = Math.max(1, Math.round(dmg * 0.5));
    return dmg;
  }

  /** Resolves an actor's action and returns a result for the UI/log. */
  resolve(actor: Actor, kind: ActionKind, target: Actor | null): ActionResult {
    actor.defending = false;

    if (kind === 'defend') {
      actor.defending = true;
      actor.meter = DEFEND_METER;
      return { actor, kind, target: null, damage: 0, text: `${actor.name} braces, guarding against the next blow.` };
    }

    actor.meter = 0;
    const t = target!;
    const mult = kind === 'skill' ? SKILL_MULT : 1;
    const dmg = this.rollDamage(actor, t, mult);
    t.hp = Math.max(0, t.hp - dmg);
    const verb = kind === 'skill' ? 'unleashes a synapse burn on' : 'strikes';
    const fell = t.hp === 0 ? ` ${t.name} goes down.` : '';
    return { actor, kind, target: t, damage: dmg, text: `${actor.name} ${verb} ${t.name} for ${dmg}.${fell}` };
  }

  /** Simple enemy AI: guard when badly hurt, otherwise attack a living target. */
  chooseEnemyAction(actor: Actor): { kind: ActionKind; target: Actor | null } {
    const targets = this.living('party');
    if (targets.length === 0) return { kind: 'defend', target: null };
    if (actor.hp / actor.maxHp < 0.3 && Math.random() < 0.35) {
      return { kind: 'defend', target: null };
    }
    const target = targets[(Math.random() * targets.length) | 0];
    const kind: ActionKind = Math.random() < 0.25 ? 'skill' : 'attack';
    return { kind, target };
  }
}
