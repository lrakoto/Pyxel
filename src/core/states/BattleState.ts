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
    ctx.keys.clear();
    const overlay = document.getElementById('battle-overlay');
    if (overlay) overlay.style.display = 'flex';
  }

  exit(ctx: GameContext) {
    const overlay = document.getElementById('battle-overlay');
    if (overlay) overlay.style.display = 'none';
  }

  update(ctx: GameContext, dt: number): GameState | null {
    if (ctx.keys.has('Space') || ctx.keys.has('Enter')) {
      ctx.keys.delete('Space');
      ctx.keys.delete('Enter');
      return new ExploreState();
    }
    return null;
  }
}
