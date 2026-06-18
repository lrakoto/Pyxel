import * as THREE from 'three';
import { GameState } from './StateMachine';
import type { GameContext } from './GameContext';
import { ExploreState } from './ExploreState';
import { Battle, type Actor, type ActionKind } from '../battle/Battle';
import { BattleUI, type Command } from '../battle/BattleUI';

const COMMANDS: Command[] = [
  { kind: 'attack', label: 'ATTACK' },
  { kind: 'skill', label: 'SYNAPSE BURN' },
  { kind: 'defend', label: 'DEFEND' },
];

type Phase = 'intro' | 'idle' | 'menu' | 'resolve' | 'finish';

function makeActor(p: Omit<Actor, 'meter' | 'defending' | 'hp'> & { hp?: number }): Actor {
  return { ...p, hp: p.hp ?? p.maxHp, meter: 0, defending: false };
}

/**
 * Full CTB battle: meters fill until an actor is ready, the player picks from
 * the command menu (the enemy uses simple AI), the action resolves with hit
 * feedback, and the turn-order bar reprojects. Returns to ExploreState on a
 * win or loss. The dimmed street renders behind the overlay and keeps its rain
 * and neon flicker alive.
 */
export class BattleState extends GameState {
  private readonly battle: Battle;
  private readonly ui = new BattleUI();
  private phase: Phase = 'intro';
  private timer = 0;
  private active: Actor | null = null;
  private selected = 0;
  // Camera push-in state, restored on exit.
  private camStart = new THREE.Vector3();
  private camTarget = new THREE.Vector3();
  private fovStart = 0;
  private fovTarget = 0;

  constructor() {
    super();
    this.battle = new Battle([
      makeActor({ id: 'cole', name: 'Cole', side: 'party', maxHp: 130, atk: 26, def: 12, speed: 430 }),
      makeActor({ id: 'ripper', name: 'Ripper', side: 'enemy', maxHp: 85, atk: 23, def: 9, speed: 370 }),
    ]);
  }

  get name(): string {
    return 'battle';
  }

  enter(ctx: GameContext) {
    ctx.keys.clear();
    // Stage the camera: remember where it was, push it in toward the player.
    this.camStart.copy(ctx.camera.position);
    this.camTarget.set(ctx.player.x, 1.9, 11);
    this.fovStart = ctx.camera.fov;
    this.fovTarget = 32;
    this.ui.mount(this.battle);
    this.ui.refresh(this.battle, null);
    this.ui.log('A Sector 7 enforcer blocks the alley. He moves to attack.');
    this.phase = 'intro';
    this.timer = 0;
  }

  exit(ctx: GameContext) {
    this.ui.unmount();
    ctx.camera.fov = this.fovStart;
    ctx.camera.position.copy(this.camStart);
    ctx.camera.updateProjectionMatrix();
    ctx.keys.clear();
  }

  update(ctx: GameContext, dt: number): GameState | null {
    // Keep the street alive behind the overlay (rain + neon flicker) and ease
    // the camera toward its battle framing.
    ctx.rain.update(dt, ctx.camX);
    ctx.rainFar.update(dt, 0);
    for (const u of ctx.updatables) u.update(dt);
    const k = Math.min(1, dt * 3.5);
    ctx.camera.position.lerp(this.camTarget, k);
    ctx.camera.fov += (this.fovTarget - ctx.camera.fov) * k;
    ctx.camera.updateProjectionMatrix();
    ctx.camera.lookAt(this.camTarget.x, 1.7, 0);
    ctx.world.viewPoint.copy(ctx.camera.position);
    ctx.puddles.update(ctx.camera, dt);
    ctx.puddles.render(ctx.renderer, ctx.scene);

    this.timer -= dt;

    switch (this.phase) {
      case 'intro':
        if (this.timer <= 0) this.phase = 'idle';
        break;

      case 'idle': {
        const ready = this.battle.advance(dt);
        if (ready) {
          ready.defending = false; // guard lapses on the actor's own turn
          this.active = ready;
          if (ready.side === 'party') {
            this.selected = 0;
            this.ui.showMenu(COMMANDS, this.selected);
            this.ui.log(`${ready.name}'s move.`);
            this.phase = 'menu';
          } else {
            const choice = this.battle.chooseEnemyAction(ready);
            this.performAction(ready, choice.kind, choice.target);
          }
        }
        this.ui.refresh(this.battle, null);
        break;
      }

      case 'menu':
        this.handleMenu(ctx);
        break;

      case 'resolve':
        if (this.timer <= 0) {
          const result = this.battle.outcome;
          if (result) {
            this.ui.hideMenu();
            this.ui.showBanner(result === 'win' ? 'VICTORY' : 'DEFEATED', result);
            this.ui.log(result === 'win'
              ? 'The enforcer collapses. The alley falls quiet.'
              : 'Cole drops to one knee. The street swims back into focus...');
            this.phase = 'finish';
            this.timer = 2.0;
          } else {
            this.phase = 'idle';
          }
        }
        this.ui.refresh(this.battle, this.active?.id ?? null);
        break;

      case 'finish':
        if (this.timer <= 0) return new ExploreState();
        break;
    }

    return null;
  }

  private handleMenu(ctx: GameContext) {
    const { keys } = ctx;
    if (keys.has('ArrowUp') || keys.has('KeyW')) {
      keys.delete('ArrowUp');
      keys.delete('KeyW');
      this.selected = (this.selected + COMMANDS.length - 1) % COMMANDS.length;
      this.ui.updateMenuSelection(this.selected);
    } else if (keys.has('ArrowDown') || keys.has('KeyS')) {
      keys.delete('ArrowDown');
      keys.delete('KeyS');
      this.selected = (this.selected + 1) % COMMANDS.length;
      this.ui.updateMenuSelection(this.selected);
    } else if (keys.has('Enter') || keys.has('Space')) {
      keys.delete('Enter');
      keys.delete('Space');
      const cmd = COMMANDS[this.selected];
      const target = cmd.kind === 'defend' ? null : this.battle.living('enemy')[0] ?? null;
      this.ui.hideMenu();
      this.performAction(this.active!, cmd.kind, target);
    }
  }

  private performAction(actor: Actor, kind: ActionKind, target: Actor | null) {
    const result = this.battle.resolve(actor, kind, target);
    this.ui.log(result.text);
    if (result.target && result.damage > 0) {
      this.ui.flashHit(result.target.id, result.damage);
    }
    this.ui.refresh(this.battle, actor.id);
    this.phase = 'resolve';
    this.timer = 0.85;
  }
}
