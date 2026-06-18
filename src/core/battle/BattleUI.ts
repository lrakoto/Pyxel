import type { Actor, ActionKind, Battle, QueueEntry } from './Battle';

/**
 * HTML/CSS overlay for the battle: enemy + party pixel portraits with HP bars,
 * a projected turn-order bar, the command menu, and an action-log line. Built
 * dynamically and mounted on document.body; the dimmed 3D street shows behind.
 */

export interface Command {
  kind: ActionKind;
  label: string;
}

// Front-facing battle portraits (pixel maps, '.' = transparent).
const COLE_SPRITE = [
  '....HHHHHH....',
  '...HHHHHHHH...',
  '..hhhhhhhhhh..',
  '....SSSSSS....',
  '....SeSSeS....',
  '....SSSSSS....',
  '...GGGGGGGG...',
  '..LCCCCCCCCL..',
  '..CCCCCCCCCC..',
  '..CCDCCCCDCC..',
  '..CCDCCCCDCC..',
  '..CCCCCCCCCC..',
  '..CCCCCCCCCC..',
  '..CCC....CCC..',
];
const COLE_PALETTE: Record<string, string> = {
  H: '#14171d', h: '#20242c', S: '#c49070', e: '#41301f',
  G: '#9a7c38', C: '#2c333d', D: '#1b212a', L: '#3a4350',
};

const ENEMY_SPRITE = [
  '.....DDDDDD.....',
  '....DDDDDDDD....',
  '...DDdddddDDD...',
  '...DvvvvvvvvD...',
  '...DDdddddDDD...',
  '..mDDDDDDDDDDm..',
  '.mmDDDDDDDDDDmm.',
  '.mDDDDDDDDDDDDm.',
  '..DDDDDDDDDDDD..',
  '..DDDmDDDDmDDD..',
  '..DDDDDDDDDDDD..',
  '..DDDDDDDDDDDD..',
  '...DDDD..DDDD...',
  '...DDD....DDD...',
  '..DDDD....DDDD..',
  '..mmm......mmm..',
];
const ENEMY_PALETTE: Record<string, string> = {
  D: '#222732', d: '#13161d', v: '#ff3b46', m: '#3a4250',
};

function renderSprite(map: string[], palette: Record<string, string>, scale: number): HTMLCanvasElement {
  const w = map[0].length;
  const h = map.length;
  const canvas = document.createElement('canvas');
  canvas.width = w * scale;
  canvas.height = h * scale;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  map.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      const color = palette[ch];
      if (color) {
        ctx.fillStyle = color;
        ctx.fillRect(x * scale, y * scale, scale, scale);
      }
    });
  });
  return canvas;
}

interface ActorView {
  root: HTMLElement;
  hpFill: HTMLElement;
  hpText: HTMLElement;
  sprite: HTMLElement;
}

export class BattleUI {
  private readonly root: HTMLElement;
  private readonly enemyRow: HTMLElement;
  private readonly partyRow: HTMLElement;
  private readonly queueBar: HTMLElement;
  private readonly menu: HTMLElement;
  private readonly logEl: HTMLElement;
  private readonly banner: HTMLElement;
  private readonly views = new Map<string, ActorView>();
  private menuButtons: HTMLElement[] = [];

  constructor() {
    this.root = document.createElement('div');
    this.root.id = 'battle-ui';
    this.root.innerHTML = `
      <div class="bt-stage">
        <div class="bt-enemies"></div>
        <div class="bt-queue-wrap"><span class="bt-queue-label">NEXT</span><div class="bt-queue"></div></div>
        <div class="bt-party"></div>
      </div>
      <div class="bt-log"></div>
      <div class="bt-menu"></div>
      <div class="bt-banner"></div>`;
    this.enemyRow = this.root.querySelector('.bt-enemies')!;
    this.partyRow = this.root.querySelector('.bt-party')!;
    this.queueBar = this.root.querySelector('.bt-queue')!;
    this.menu = this.root.querySelector('.bt-menu')!;
    this.logEl = this.root.querySelector('.bt-log')!;
    this.banner = this.root.querySelector('.bt-banner')!;
  }

  mount(battle: Battle) {
    for (const actor of battle.actors) {
      const row = actor.side === 'enemy' ? this.enemyRow : this.partyRow;
      const view = this.buildActorView(actor);
      row.appendChild(view.root);
      this.views.set(actor.id, view);
    }
    document.body.appendChild(this.root);
  }

  unmount() {
    this.root.remove();
    this.views.clear();
  }

  private buildActorView(actor: Actor): ActorView {
    const root = document.createElement('div');
    root.className = `bt-actor bt-${actor.side}`;
    const map = actor.side === 'enemy' ? ENEMY_SPRITE : COLE_SPRITE;
    const palette = actor.side === 'enemy' ? ENEMY_PALETTE : COLE_PALETTE;
    const sprite = document.createElement('div');
    sprite.className = 'bt-sprite';
    sprite.appendChild(renderSprite(map, palette, actor.side === 'enemy' ? 7 : 8));

    const name = document.createElement('div');
    name.className = 'bt-name';
    name.textContent = actor.name;

    const bar = document.createElement('div');
    bar.className = 'bt-hpbar';
    const fill = document.createElement('div');
    fill.className = 'bt-hpfill';
    bar.appendChild(fill);
    const hpText = document.createElement('div');
    hpText.className = 'bt-hptext';

    root.append(sprite, name, bar, hpText);
    return { root, hpFill: fill, hpText, sprite };
  }

  /** Refreshes HP bars, the active highlight, and the turn-order bar. */
  refresh(battle: Battle, activeId: string | null) {
    for (const actor of battle.actors) {
      const view = this.views.get(actor.id);
      if (!view) continue;
      const pct = Math.max(0, actor.hp / actor.maxHp) * 100;
      view.hpFill.style.width = `${pct}%`;
      view.hpText.textContent = `${actor.hp}/${actor.maxHp}`;
      view.root.classList.toggle('bt-dead', actor.hp <= 0);
      view.root.classList.toggle('bt-active', actor.id === activeId);
      view.root.classList.toggle('bt-guarding', actor.defending);
    }
    this.renderQueue(battle.projectQueue(6));
  }

  private renderQueue(entries: QueueEntry[]) {
    this.queueBar.innerHTML = '';
    entries.forEach((e, i) => {
      const tok = document.createElement('div');
      tok.className = `bt-token bt-${e.side}`;
      tok.textContent = e.name[0];
      tok.title = e.name;
      if (i === 0) tok.classList.add('bt-token-next');
      this.queueBar.appendChild(tok);
    });
  }

  showMenu(commands: Command[], selected: number) {
    this.menu.style.display = 'flex';
    this.menu.innerHTML = '';
    this.menuButtons = commands.map((c, i) => {
      const b = document.createElement('div');
      b.className = 'bt-cmd' + (i === selected ? ' bt-cmd-sel' : '');
      b.textContent = c.label;
      this.menu.appendChild(b);
      return b;
    });
  }

  updateMenuSelection(selected: number) {
    this.menuButtons.forEach((b, i) => b.classList.toggle('bt-cmd-sel', i === selected));
  }

  hideMenu() {
    this.menu.style.display = 'none';
  }

  log(text: string) {
    this.logEl.textContent = text;
  }

  /** Hit feedback: flash + shake the target's portrait, pop a damage number. */
  flashHit(actorId: string, damage: number) {
    const view = this.views.get(actorId);
    if (!view) return;
    view.sprite.classList.remove('bt-hit');
    void view.sprite.offsetWidth; // restart the animation
    view.sprite.classList.add('bt-hit');

    const pop = document.createElement('div');
    pop.className = 'bt-damage';
    pop.textContent = String(damage);
    view.root.appendChild(pop);
    setTimeout(() => pop.remove(), 800);
  }

  showBanner(text: string, kind: 'win' | 'lose') {
    this.banner.textContent = text;
    this.banner.className = `bt-banner bt-banner-${kind} bt-banner-show`;
  }
}
