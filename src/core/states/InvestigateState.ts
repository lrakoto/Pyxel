import * as THREE from 'three';
import { GameState } from './StateMachine';
import type { GameContext } from './GameContext';
import { ExploreState } from './ExploreState';
import { Glint } from '../../world/glint';
import type { InteractionDef } from '../../world/dialogue';

/**
 * Investigation mode. Entered with I from exploration; glints appear on every
 * examinable object in the current area. Walk between them (or click/tap a
 * glint) and press E to examine — which grants evidence and shows dialogue.
 * Press I or ESC to step back out to exploration.
 *
 * The world stays alive (rain, neon, ambient anim keep running) but the
 * camera tightens and the audio ducks, focusing attention on the scene.
 */
/** The collectible evidence set for Marlon Graves' studio. */
const STUDIO_EVIDENCE = [
  'everybody-nobody-painting',
  'unfinished-woman',
  'neural-device',
  'neural-residue',
  'marlons-journal',
  'wall-writing',
  'picked-lock',
] as const;

/** Journal flag marking that the studio case conclusion has fired. */
const CASE_CONCLUSION_FLAG = 'studio-case-complete';

export class InvestigateState extends GameState {
  private glints = new Map<InteractionDef, Glint>();
  private camZRest: number | null = null;
  private readonly camPullInZ = 2.4;

  private onPointerDown: ((e: PointerEvent) => void) | null = null;
  private onPointerMove: ((e: PointerEvent) => void) | null = null;
  private hoveredByMouse: InteractionDef | null = null;

  get name(): string {
    return 'investigate';
  }

  enter(ctx: GameContext) {
    // Pull the camera in slightly for focus, and duck the ambience.
    this.camZRest = ctx.camera.position.z;
    ctx.audio.duck();
    document.getElementById('investigate-banner')!.style.display = 'flex';
    const canvas = ctx.renderer.domElement;

    const scene = ctx.scene;
    for (const def of ctx.area.interactions) {
      const glint = new Glint(def.clueId && ctx.journal.has(def.clueId) ? 0.16 : 0.24);
      const y = def.glintY ?? 1.6;
      glint.show(def.x, y, def.z);
      scene.add(glint.sprite);
      this.glints.set(def, glint);
    }

    // Click/tap a glint: Cole walks over and examines automatically on arrival.
    // Click elsewhere: Cole walks to that spot on the ground.
    this.onPointerDown = (e: PointerEvent) => {
      if (ctx.dialogue.isOpen || ctx.journalUI.isOpen) return;
      const rect = canvas.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      const hit = this.pickGlint(ctx, px, py, rect);
      if (hit) {
        this.walkTarget = this.closestStandPoint(hit, ctx);
        this.examineRequest = hit;
        this.autoExamine = true;
      } else {
        this.examineRequest = null;
        this.autoExamine = false;
        this.walkTarget = this.groundPoint(ctx, px, py, rect)?.x ?? null;
      }
    };

    // Hover: pointer cursor over a glint, else walk cursor.
    this.onPointerMove = (e: PointerEvent) => {
      if (ctx.dialogue.isOpen || ctx.journalUI.isOpen) {
        this.hoveredByMouse = null;
        canvas.style.cursor = '';
        return;
      }
      const rect = canvas.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      this.hoveredByMouse = this.pickGlint(ctx, px, py, rect);
      canvas.style.cursor = this.hoveredByMouse ? 'pointer' : 'crosshair';
    };

    window.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
  }

  exit(ctx: GameContext) {
    for (const glint of this.glints.values()) {
      ctx.scene.remove(glint.sprite);
      (glint.sprite.material as THREE.SpriteMaterial).map?.dispose();
      (glint.sprite.material as THREE.SpriteMaterial).dispose();
    }
    this.glints.clear();
    // Restore the camera distance pulled in during investigation.
    if (this.camZRest !== null) ctx.camera.position.z = this.camZRest;
    ctx.audio.unduck();
    if (this.onPointerDown) {
      window.removeEventListener('pointerdown', this.onPointerDown);
      this.onPointerDown = null;
    }
    if (this.onPointerMove) {
      window.removeEventListener('pointermove', this.onPointerMove);
      this.onPointerMove = null;
    }
    ctx.renderer.domElement.style.cursor = '';
    document.getElementById('interact-hint')!.style.display = 'none';
    document.getElementById('investigate-banner')!.style.display = 'none';
    document.getElementById('examine-vignette')!.classList.remove('active');
  }

  /** Where the player is auto-walking toward after a click. */
  private walkTarget: number | null = null;
  private examineRequest: InteractionDef | null = null;
  /** Fire examine automatically once Cole arrives at the requested object. */
  private autoExamine = false;
  /** Objects whose glint has already chimed this session (collected ones never chime). */
  private readonly discovered = new Set<InteractionDef>();

  update(ctx: GameContext, dt: number): GameState | null {
    const { player, playerLight, signLights, rain, rainFar, splashes, updatables, area, camera, dialogue, keys, audio } = ctx;

    // Exit investigation mode.
    if (keys.has('KeyI') || keys.has('Escape')) {
      keys.delete('KeyI');
      keys.delete('Escape');
      dialogue.close();
      return new ExploreState();
    }

    // Dialogue takes priority — examining an object.
    if (dialogue.isOpen) {
      document.getElementById('examine-vignette')!.classList.add('active');
      if (keys.has('KeyE') || keys.has('Space')) {
        keys.delete('KeyE');
        keys.delete('Space');
        dialogue.advance();
        if (!dialogue.isOpen) this.walkTarget = null;
      }
      dialogue.update(dt);
      audio.update(dt, false);
      return null;
    }
    document.getElementById('examine-vignette')!.classList.remove('active');

    // Movement: click-to-walk overrides keyboard, otherwise arrows/A-D.
    let left = keys.has('ArrowLeft') || keys.has('KeyA');
    let right = keys.has('ArrowRight') || keys.has('KeyD');
    if (this.walkTarget !== null) {
      // Any manual key input cancels click-to-walk.
      if (left || right) {
        this.walkTarget = null;
        this.examineRequest = null;
        this.autoExamine = false;
      } else {
        const dx = this.walkTarget - player.x;
        if (Math.abs(dx) > 0.35) {
          left = dx < 0;
          right = dx > 0;
        } else {
          this.walkTarget = null;
        }
      }
    }

    player.update(dt, { left, right });
    playerLight.position.set(player.x + 0.4, 2.3, 2.2);
    player.updateRim(signLights);

    if (area.exterior) {
      rain.update(dt, ctx.camX);
      rainFar.update(dt, 0);
      splashes.update(dt, ctx.camX);
    }
    for (const u of updatables) u.update(dt);

    // Camera: follow player, pulled slightly toward the scene for focus.
    ctx.camX += (player.x * 0.9 - ctx.camX) * Math.min(1, dt * 3);
    const targetZ = (this.camZRest ?? camera.position.z) - this.camPullInZ;
    camera.position.x = ctx.camX;
    camera.position.z += (targetZ - camera.position.z) * Math.min(1, dt * 2.2);
    camera.lookAt(ctx.camX, area.cameraTarget.y, area.cameraTarget.z);
    area.viewPoint.copy(camera.position);

    // Glint pulses; emphasise the one Cole would examine.
    const nearest = this.nearestGlint(player.x);
    const emphasized = this.examineRequest ?? this.hoveredByMouse ?? nearest;
    for (const [def, glint] of this.glints) {
      glint.update(dt, def === emphasized);
    }

    // Discovery chime: an uncollected glint rings once the first time it
    // appears on screen during this investigation session.
    this.updateDiscovery(ctx, dt);

    // Cycle focus between glints with [ (previous) / ] (next). A cycled
    // object becomes the examine target: Cole walks over; E/auto-examine.
    if (keys.has('BracketLeft')) {
      keys.delete('BracketLeft');
      this.cycleFocus(ctx, -1);
    }
    if (keys.has('BracketRight')) {
      keys.delete('BracketRight');
      this.cycleFocus(ctx, +1);
    }

    // Hint + examine. A click sets examineRequest + autoExamine: examination
    // fires by itself once Cole is within the object's radius.
    const hintEl = document.getElementById('interact-hint')!;
    let pending: InteractionDef | null = null;
    if (this.examineRequest && Math.abs(this.examineRequest.x - player.x) < this.examineRequest.radius) {
      pending = this.examineRequest;
    } else if (nearest && !this.examineRequest) {
      pending = nearest;
    }

    if (pending && this.autoExamine && this.examineRequest === pending) {
      // Arrived at the clicked glint — examine without another click.
      this.examineRequest = null;
      this.autoExamine = false;
      this.walkTarget = null;
      this.examine(ctx, pending, dialogue);
      hintEl.style.display = 'none';
    } else if (pending) {
      const collected = pending.clueId ? ctx.journal.has(pending.clueId) : false;
      hintEl.textContent = collected
        ? `E — re-examine ${pending.label}`
        : `E — examine ${pending.label}  ·  I — step back`;
      hintEl.style.display = 'block';
      if (keys.has('KeyE')) {
        keys.delete('KeyE');
        this.examineRequest = null;
        this.autoExamine = false;
        this.walkTarget = null;
        this.examine(ctx, pending, dialogue);
        hintEl.style.display = 'none';
      }
    } else {
      hintEl.textContent = '[ ] — cycle glints  ·  I — step back';
      hintEl.style.display = 'block';
    }

    audio.update(dt, left || right);

    if (area.exterior) {
      ctx.puddles.update(camera, dt);
      ctx.puddles.render(ctx.renderer, ctx.scene);
    }
    return null;
  }

  /** Examine an object: grant its clue (first time), then open its dialogue. */
  private examine(ctx: GameContext, def: InteractionDef, dialogue: GameContext['dialogue']) {
    if (def.clueId && def.clueTitle && def.clueBody && !ctx.journal.has(def.clueId)) {
      const granted = ctx.journal.add({
        id: def.clueId,
        title: def.clueTitle,
        body: def.clueBody,
      });
      if (granted) {
        ctx.clueToast.show(def.clueTitle);
        // Shrink the collected object's glint — a subtle "consumed" marker.
        const g = this.glints.get(def);
        if (g) g.setCollected(true);
        this.checkCaseCompletion(ctx);
      }
    }
    dialogue.openDialogue(def);
  }

  /**
   * Studio case conclusion: once every piece of the crime scene is in the
   * journal, the case resolves — the objective advances and a final toast
   * marks the scene cleared. Fires once per session.
   */
  private checkCaseCompletion(ctx: GameContext) {
    if (ctx.area.id !== 'studio') return;
    if (ctx.journal.has(CASE_CONCLUSION_FLAG)) return;
    const complete = STUDIO_EVIDENCE.every((id) => ctx.journal.has(id));
    if (!complete) return;
    ctx.journal.add({
      id: CASE_CONCLUSION_FLAG,
      title: 'CASE STATUS: SCENE CLOSED',
      body:
        'The studio has given up everything it knows. Marlon found the theft, painted it, ' +
        'and died holding the map. The wall says "find the first one" — and there\'s one person ' +
        'in Sector 7 who traffics in first-hand memories. Time to find Lyra.',
    });
    ctx.journal.setObjective(
      'The scene is cleared. Take what you have to Lyra — she sells memories, and the first victim is in someone\'s archive.',
    );
    ctx.clueToast.show('CASE UPDATED — SCENE CLOSED');
    ctx.audio.playDiscovery();
  }

  /** Nearest glint within its radius, or null. */
  private nearestGlint(playerX: number): InteractionDef | null {
    let best: { def: InteractionDef; dist: number } | null = null;
    for (const def of this.glints.keys()) {
      const d = Math.abs(def.x - playerX);
      if (d < def.radius && (!best || d < best.dist)) best = { def, dist: d };
    }
    return best?.def ?? null;
  }

  /** Pick a glint whose projected screen position is near the pointer. */
  private pickGlint(
    ctx: GameContext,
    px: number,
    py: number,
    rect: DOMRect,
  ): InteractionDef | null {
    let best: { def: InteractionDef; d2: number } | null = null;
    const v = new THREE.Vector3();
    for (const [def, glint] of this.glints) {
      v.copy(glint.sprite.position).project(ctx.camera);
      if (v.z > 1) continue; // behind camera
      const sx = ((v.x + 1) / 2) * rect.width;
      const sy = ((1 - v.y) / 2) * rect.height;
      const d2 = (sx - px) * (sx - px) + (sy - py) * (sy - py);
      // Generous hit radius (~60px) for the 960x540 internal resolution.
      if (d2 < 60 * 60 && (!best || d2 < best.d2)) best = { def, d2 };
    }
    return best?.def ?? null;
  }

  /**
   * The walk destination for a clicked object — its anchor, clamped to bounds.
   * Cole stops at the object itself (z never changes in the side view).
   */
  private closestStandPoint(def: InteractionDef, ctx: GameContext): number {
    return this.clampToBounds(def.x, ctx);
  }

  /** Project a screen point onto the ground plane the player walks on. */
  private groundPoint(
    ctx: GameContext,
    px: number,
    py: number,
    rect: DOMRect,
  ): { x: number } | null {
    const ndcX = (px / rect.width) * 2 - 1;
    const ndcY = -(py / rect.height) * 2 + 1;
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(ndcX, ndcY), ctx.camera);
    const playerZ = 0.0; // player sprite plane (Player.mesh sits at z=0)
    const origin = ray.ray.origin;
    const dir = ray.ray.direction;
    if (Math.abs(dir.z) < 1e-5) return null;
    const t = (playerZ - origin.z) / dir.z;
    if (t <= 0) return null;
    const hitX = origin.x + dir.x * t;
    const hitY = origin.y + dir.y * t;
    // Only accept clicks near the ground band — above-horizon clicks mean nothing.
    if (hitY > 3.5) return null;
    return { x: this.clampToBounds(hitX, ctx) };
  }

  private clampToBounds(x: number, ctx: GameContext): number {
    return Math.max(ctx.area.bounds.min, Math.min(ctx.area.bounds.max, x));
  }

  /**
   * Cycle the examine focus to the next/previous glint by world x. Skips
   * already-collected objects? No — those still reward re-examination, so all
   * objects participate in the cycle.
   */
  private cycleFocus(ctx: GameContext, dir: 1 | -1) {
    const defs = [...this.glints.keys()].sort((a, b) => a.x - b.x);
    if (defs.length === 0) return;
    const current = this.examineRequest ?? this.nearestGlint(ctx.player.x);
    let idx = current ? defs.indexOf(current) : -1;
    if (idx < 0) {
      // No current focus: jump to the closest by world x.
      idx = defs.reduce((best, d, i) =>
        Math.abs(d.x - ctx.player.x) < Math.abs(defs[best].x - ctx.player.x) ? i : best, 0);
    } else {
      idx = (idx + dir + defs.length) % defs.length;
    }
    const target = defs[idx];
    this.examineRequest = target;
    this.autoExamine = true;
    this.walkTarget = this.closestStandPoint(target, ctx);
  }

  /** Ring the discovery chime for newly-on-screen uncollected glints. */
  private discoveryCooldown = 0;

  private updateDiscovery(ctx: GameContext, dt: number) {
    this.discoveryCooldown = Math.max(0, this.discoveryCooldown - dt);
    const v = new THREE.Vector3();
    for (const [def, glint] of this.glints) {
      if (this.discovered.has(def)) continue;
      if (def.clueId && ctx.journal.has(def.clueId)) continue; // already known
      v.copy(glint.sprite.position).project(ctx.camera);
      const onScreen = v.z < 1 && Math.abs(v.x) < 0.92 && Math.abs(v.y) < 0.92;
      // Each new glint rings as Cole brings it into view, spaced by a short
      // cooldown so a room reveal sings one note at a time.
      if (onScreen && this.discoveryCooldown <= 0) {
        this.discovered.add(def);
        this.discoveryCooldown = 0.35;
        ctx.audio.playDiscovery();
      }
    }
  }
}
