import type { GameContext } from './GameContext';

export abstract class GameState {
  abstract get name(): string;
  enter(_ctx: GameContext) {}
  exit(_ctx: GameContext) {}
  /** Return a new state to trigger a transition, or null to stay. */
  update(ctx: GameContext, dt: number): GameState | null { return null; }
}

export class StateMachine {
  private current: GameState | null = null;

  constructor(private readonly ctx: GameContext) {}

  get currentState(): GameState | null {
    return this.current;
  }

  transition(newState: GameState) {
    this.current?.exit(this.ctx);
    this.current = newState;
    this.current.enter(this.ctx);
  }

  update(dt: number) {
    if (!this.current) return;
    const next = this.current.update(this.ctx, dt);
    if (next && next !== this.current) {
      this.transition(next);
    }
  }
}
