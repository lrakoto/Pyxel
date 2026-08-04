import * as THREE from 'three';
import { GameState } from './StateMachine';
import type { GameContext } from './GameContext';
import { ExploreState } from './ExploreState';
import { Bullets } from '../../world/shooter/Bullets';
import { Sparks } from '../../world/shooter/Sparks';
import { Gun } from '../../world/shooter/Gun';
import { Enemy, type EnemyKind } from '../../world/shooter/Enemy';
import { FloatingText } from '../../world/shooter/FloatingText';

/**
 * Side-scrolling run-and-gun combat ("twin-stick" lineage: walk with the
 * keyboard, aim with the mouse). Cole moves left/right and jumps on the existing
 * Sector 7 street while the mouse cursor drives a 360° aim — the cursor is
 * unprojected onto the z=0 gameplay plane and Cole's pistol rotates to it. The
 * machine pistol auto-fires while the mouse is held, with a small random angular
 * spread per shot so it's pin-accurate up close and loose at range. Ground
 * enforcers and aerial drones approach in waves, take fire (sparks + screen
 * shake), and deal contact damage. Exit back to ExploreState with Esc/Q.
 */

const FIRE_INTERVAL = 0.085; // seconds between rounds
const AIM_SPREAD = 0.06; // radians of half-jitter (~3.4°)
const MAX_HP = 100;
const WAVE_DELAY = 1.6;
const HAND_FORWARD = 0.28; // hand offset ahead of Cole's body, toward aim
const BULLET_DMG = 10;
const HITSTOP = 0.07; // seconds of near-freeze on a kill, for impact

export class ShooterState extends GameState {
  private readonly bullets = new Bullets();
  private readonly sparks = new Sparks();
  private readonly gun = new Gun();
  private readonly floaters = new FloatingText();
  private readonly muzzleLight = new THREE.PointLight('#ffd9a0', 0, 7, 2);
  private enemies: Enemy[] = [];

  private hp = MAX_HP;
  private fireTimer = 0;
  private waveTimer = 0;
  private wave = 0;
  private hurtFlash = 0;
  private downTimer = 0;
  private hitStop = 0;
  private hurtSfxTimer = 0;

  private firing = false;
  private mouseX = 0;
  private mouseY = 0;
  private jumpHeld = false;
  private shakeMag = 0;

  private readonly ray = new THREE.Raycaster();
  private readonly ndc = new THREE.Vector2();
  private readonly proj = new THREE.Vector3();
  private canvas!: HTMLCanvasElement;

  // DOM HUD
  private hud!: HTMLDivElement;
  private healthFill!: HTMLDivElement;
  private crosshair!: HTMLDivElement;

  // Bound listeners (kept so they can be removed on exit).
  private readonly onMove = (e: MouseEvent) => { this.mouseX = e.clientX; this.mouseY = e.clientY; };
  private readonly onDown = (e: MouseEvent) => { if (e.button === 0) this.firing = true; };
  private readonly onUp = (e: MouseEvent) => { if (e.button === 0) this.firing = false; };
  private readonly onContext = (e: Event) => e.preventDefault();

  get name(): string {
    return 'shooter';
  }

  enter(ctx: GameContext) {
    ctx.keys.clear();
    this.canvas = ctx.renderer.domElement;

    ctx.scene.add(this.bullets.group);
    ctx.scene.add(this.sparks.group);
    ctx.scene.add(this.gun.group);
    ctx.scene.add(this.muzzleLight);

    this.buildHud();
    this.canvas.style.cursor = 'none';
    window.addEventListener('mousemove', this.onMove);
    window.addEventListener('mousedown', this.onDown);
    window.addEventListener('mouseup', this.onUp);
    window.addEventListener('contextmenu', this.onContext);

    // Centre the cursor so aim starts forward rather than at (0,0).
    const rect = this.canvas.getBoundingClientRect();
    this.mouseX = rect.left + rect.width * 0.62;
    this.mouseY = rect.top + rect.height * 0.45;

    this.hp = MAX_HP;
    this.wave = 0;
    this.spawnWave(ctx);
  }

  exit(ctx: GameContext) {
    ctx.scene.remove(this.bullets.group);
    ctx.scene.remove(this.sparks.group);
    ctx.scene.remove(this.gun.group);
    ctx.scene.remove(this.muzzleLight);
    for (const e of this.enemies) {
      ctx.scene.remove(e.mesh);
      e.dispose();
    }
    this.enemies = [];
    this.bullets.reset();
    this.sparks.reset();
    this.floaters.reset();

    this.canvas.style.cursor = '';
    window.removeEventListener('mousemove', this.onMove);
    window.removeEventListener('mousedown', this.onDown);
    window.removeEventListener('mouseup', this.onUp);
    window.removeEventListener('contextmenu', this.onContext);
    this.hud.remove();
    ctx.keys.clear();
  }

  update(ctx: GameContext, dt: number): GameState | null {
    const { player, playerLight, signLights, rain, rainFar, splashes, updatables, area, camera, audio, keys, puddles, renderer, scene } = ctx;

    // Exit back to exploration.
    if (keys.has('Escape') || keys.has('KeyQ')) {
      keys.delete('Escape');
      keys.delete('KeyQ');
      return new ExploreState();
    }

    // Hit-stop: a brief near-freeze of the gameplay sims on a kill, so impacts
    // land with weight. HUD, screen shake and floaters keep running on real dt.
    let gdt = dt;
    if (this.hitStop > 0) {
      this.hitStop -= dt;
      gdt = dt * 0.06;
    }

    // --- Movement + jump ---
    const left = keys.has('ArrowLeft') || keys.has('KeyA');
    const right = keys.has('ArrowRight') || keys.has('KeyD');
    const wantJump = keys.has('Space') || keys.has('KeyW') || keys.has('ArrowUp');
    const jump = wantJump && !this.jumpHeld && player.grounded;
    this.jumpHeld = wantJump;
    const downed = this.downTimer > 0;
    player.update(gdt, { left: left && !downed, right: right && !downed, jump: jump && !downed });
    playerLight.position.set(player.x + 0.4, 2.3, 2.2);
    player.updateRim(signLights);

    // --- Camera follow (with screen shake) ---
    ctx.camX += (player.x * 0.9 - ctx.camX) * Math.min(1, gdt * 3);
    if (this.shakeMag > 0) this.shakeMag = Math.max(0, this.shakeMag - dt * 1.4);
    const sx = (Math.random() - 0.5) * this.shakeMag;
    const sy = (Math.random() - 0.5) * this.shakeMag;
    camera.position.set(ctx.camX + sx, 2.4 + sy, 16);
    camera.lookAt(ctx.camX, 2.0, 0);
    camera.updateMatrixWorld();
    area.viewPoint.copy(camera.position);

    // --- Aim: unproject cursor onto the z=0 plane ---
    const aim = this.cursorWorld(camera);
    const handX = player.x;
    const handY = player.muzzleY;
    const angle = Math.atan2(aim.y - handY, aim.x - handX);
    const muzzle = this.gun.aim(handX + Math.cos(angle) * HAND_FORWARD, handY + Math.sin(angle) * HAND_FORWARD, angle);
    this.gun.update(dt);

    // --- Firing ---
    this.fireTimer -= gdt;
    if (this.firing && !downed && this.fireTimer <= 0) {
      this.fireTimer = FIRE_INTERVAL;
      const jitter = (Math.random() - 0.5 + Math.random() - 0.5) * AIM_SPREAD;
      this.bullets.fire(muzzle.x, muzzle.y, angle + jitter);
      this.gun.fireFlash(muzzle.x, muzzle.y);
      this.sparks.burst(muzzle.x, muzzle.y, '#ffd27a', 2, 4);
      this.shakeMag = Math.min(0.12, this.shakeMag + 0.03);
      audio.playGunshot();
      this.muzzleLight.position.set(muzzle.x, muzzle.y, 0.45);
      this.muzzleLight.intensity = 8;
    }

    // --- Bullets vs enemies ---
    this.bullets.update(gdt, (bx, by) => {
      for (const e of this.enemies) {
        if (e.dead) continue;
        const dx = bx - e.x;
        const dy = by - e.y;
        if (dx * dx + dy * dy < e.radius * e.radius) {
          const killed = e.damage(BULLET_DMG);
          const tint = e.kind === 'drone' ? '#9fe0ff' : '#ffd27a';
          this.sparks.burst(bx, by, tint, 6, 7);
          this.shakeMag = Math.min(0.18, this.shakeMag + 0.05);
          audio.playImpact(e.kind === 'drone' ? 'metal' : 'body');
          // Knock the enemy back along the line from Cole through the hit.
          let kx = e.x - player.x;
          let ky = e.y - player.muzzleY;
          const kl = Math.hypot(kx, ky) || 1;
          kx /= kl;
          ky /= kl;
          e.knockback(kx, ky, killed ? 5 : 2.2);
          const hs = this.worldToScreen(bx, by, camera);
          this.floaters.spawn(String(BULLET_DMG), hs.x, hs.y, tint);
          if (killed) {
            this.sparks.burst(e.x, e.y, '#ff8a3a', 22, 9);
            this.shakeMag = Math.min(0.4, this.shakeMag + 0.22);
            this.hitStop = HITSTOP;
            audio.playKill();
            const ks = this.worldToScreen(e.x, e.y, camera);
            this.floaters.spawn(e.kind === 'drone' ? 'DRONE DOWN' : 'ENFORCER DOWN', ks.x, ks.y - 8, '#ff8a3a', true);
          }
          return true;
        }
      }
      return false;
    });

    // --- Enemies: move, contact damage, cull dead ---
    const alive: Enemy[] = [];
    for (const e of this.enemies) {
      e.update(gdt, player.x, player.muzzleY);
      if (e.dead) {
        scene.remove(e.mesh);
        e.dispose();
        continue;
      }
      if (!downed) {
        const dx = e.x - player.x;
        const dy = e.y - player.muzzleY;
        if (dx * dx + dy * dy < (e.radius + 0.45) * (e.radius + 0.45)) {
          this.hurt(e.contactDps * gdt, audio);
        }
      }
      alive.push(e);
    }
    this.enemies = alive;

    // --- Wave respawn ---
    if (this.enemies.length === 0 && !downed) {
      this.waveTimer -= gdt;
      if (this.waveTimer <= 0) this.spawnWave(ctx);
    }

    // --- Down / revive ---
    if (downed) {
      this.downTimer -= dt;
      if (this.downTimer <= 0) {
        this.hp = MAX_HP;
        this.spawnWave(ctx);
      }
    }

    // Muzzle light flash decays fast; sparks freeze with the gameplay sims.
    this.muzzleLight.intensity *= Math.max(0, 1 - dt * 26);
    this.sparks.update(gdt);

    // --- World ambience (keep the street alive) ---
    rain.update(dt, ctx.camX);
    rainFar.update(dt, 0);
    splashes.update(dt, ctx.camX);
    for (const u of updatables) u.update(dt);
    audio.update(dt, left || right);
    puddles.update(camera, dt);
    puddles.render(renderer, scene);

    // --- HUD ---
    if (this.hurtSfxTimer > 0) this.hurtSfxTimer = Math.max(0, this.hurtSfxTimer - dt);
    if (this.hurtFlash > 0) this.hurtFlash = Math.max(0, this.hurtFlash - dt * 2.5);
    this.floaters.update(dt);
    this.updateHud();

    return null;
  }

  /** Projects a world point on the z=0 plane to client-space px for the DOM HUD. */
  private worldToScreen(x: number, y: number, camera: THREE.PerspectiveCamera): { x: number; y: number } {
    this.proj.set(x, y, 0).project(camera);
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: rect.left + (this.proj.x * 0.5 + 0.5) * rect.width,
      y: rect.top + (-this.proj.y * 0.5 + 0.5) * rect.height,
    };
  }

  /** Raycasts the cursor against the z=0 plane and returns the world hit. */
  private cursorWorld(camera: THREE.PerspectiveCamera): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    this.ndc.set(
      ((this.mouseX - rect.left) / rect.width) * 2 - 1,
      -((this.mouseY - rect.top) / rect.height) * 2 + 1,
    );
    this.ray.setFromCamera(this.ndc, camera);
    const { origin, direction } = this.ray.ray;
    const t = direction.z !== 0 ? -origin.z / direction.z : 0;
    return { x: origin.x + direction.x * t, y: origin.y + direction.y * t };
  }

  private spawnWave(ctx: GameContext) {
    this.wave++;
    const px = ctx.player.x;
    const side = Math.random() < 0.5 ? -1 : 1;
    const spawn: { kind: EnemyKind; x: number }[] = [
      { kind: 'ground', x: THREE.MathUtils.clamp(px + side * 9, -15, 15) },
      { kind: 'drone', x: THREE.MathUtils.clamp(px - side * 8, -15, 15) },
    ];
    for (const s of spawn) {
      const e = new Enemy(s.kind, s.x);
      ctx.scene.add(e.mesh);
      this.enemies.push(e);
    }
    this.waveTimer = WAVE_DELAY;
  }

  private hurt(amount: number, audio: GameContext['audio']) {
    this.hp -= amount;
    this.hurtFlash = 0.6;
    this.shakeMag = Math.min(0.2, this.shakeMag + amount * 0.01);
    if (this.hurtSfxTimer <= 0) {
      audio.playHurt();
      this.hurtSfxTimer = 0.35; // throttle: contact damage is continuous
    }
    if (this.hp <= 0) {
      this.hp = 0;
      this.downTimer = 1.8;
      // Clear the field so the player isn't ground-locked while down.
      for (const e of this.enemies) {
        this.sparks.burst(e.x, e.y, '#ff8a3a', 10, 8);
      }
    }
  }

  // ---- HUD ----

  private buildHud() {
    this.hud = document.createElement('div');
    this.hud.id = 'shooter-hud';
    this.hud.innerHTML = `
      <div class="sh-top">
        <div class="sh-label">MACHINE PISTOL</div>
        <div class="sh-bar"><div class="sh-bar-fill"></div></div>
        <div class="sh-hp">VITALS</div>
      </div>
      <div class="sh-hint">A/D or &larr;/&rarr; move &nbsp;·&nbsp; SPACE jump &nbsp;·&nbsp; MOUSE aim &nbsp;·&nbsp; HOLD to fire &nbsp;·&nbsp; ESC exit</div>
      <div id="sh-crosshair"></div>
      <div id="sh-flash"></div>`;
    this.hud.appendChild(this.floaters.root);
    document.body.appendChild(this.hud);
    this.healthFill = this.hud.querySelector('.sh-bar-fill') as HTMLDivElement;
    this.crosshair = this.hud.querySelector('#sh-crosshair') as HTMLDivElement;
  }

  private updateHud() {
    const pct = Math.max(0, this.hp / MAX_HP);
    this.healthFill.style.width = `${pct * 100}%`;
    this.healthFill.style.background = pct > 0.5 ? '#36e0ff' : pct > 0.25 ? '#ffd34a' : '#ff3da0';
    this.crosshair.style.left = `${this.mouseX}px`;
    this.crosshair.style.top = `${this.mouseY}px`;
    const flash = this.hud.querySelector('#sh-flash') as HTMLDivElement;
    flash.style.opacity = String(this.hurtFlash * 0.5);
    this.crosshair.classList.toggle('sh-down', this.downTimer > 0);
  }
}
