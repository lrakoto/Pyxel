import { GameState } from './StateMachine';
import type { GameContext } from './GameContext';
import { ExploreState } from './ExploreState';

/**
 * Placeholder battle state — proof that the state machine transitions work.
 * Will be replaced by the full CTB battle system.
 */
export class BattleState extends GameState {
  get name(): string {
    return 'battle';
  }

  enter(ctx: GameContext) {
    const overlay = document.getElementById('battle-overlay');
    if (overlay) overlay.style.display = 'flex';
  }

  exit(ctx: GameContext) {
    const overlay = document.getElementById('battle-overlay');
    if (overlay) overlay.style.display = 'none';
  }

  update(ctx: GameContext, dt: number): GameState | null {
    // Any key returns to the street
    if (ctx.keys.size > 0) {
      ctx.keys.clear();
      return new ExploreState();
    }
    return null;
  }
}
