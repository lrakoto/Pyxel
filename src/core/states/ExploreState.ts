import { GameState } from './StateMachine';
import type { GameContext } from './GameContext';
import { BattleState } from './BattleState';
import type { DoorDef } from '../../world/area';

export class ExploreState extends GameState {
  get name(): string {
    return 'explore';
  }

  update(ctx: GameContext, dt: number): GameState | null {
    const { player, playerLight, signLights, rain, rainFar, splashes, updatables, area, camera, dialogue, audio, keys, puddles, renderer, scene } = ctx;

    // Dialogue input takes priority — freezes movement while open
    if (dialogue.isOpen) {
      if (keys.has('KeyE') || keys.has('Space')) {
        keys.delete('KeyE');
        keys.delete('Space');
        dialogue.advance();
      }
      const nearby = dialogue.findNearby(player.x);
      if (!nearby) dialogue.close();
    } else {
      player.update(dt, {
        left: keys.has('ArrowLeft') || keys.has('KeyA'),
        right: keys.has('ArrowRight') || keys.has('KeyD'),
      });
      playerLight.position.set(player.x + 0.4, 2.3, 2.2);
      player.updateRim(signLights);

      // Only update exterior effects if this area is exterior
      if (area.exterior) {
        rain.update(dt, ctx.camX);
        rainFar.update(dt, 0);
        splashes.update(dt, ctx.camX);
      }
      for (const u of updatables) u.update(dt);

      ctx.camX += (player.x * 0.9 - ctx.camX) * Math.min(1, dt * 3);
      camera.position.x = ctx.camX;
      camera.lookAt(ctx.camX, area.cameraTarget.y, area.cameraTarget.z);
      area.viewPoint.copy(camera.position);

      // Check for nearby interactions
      const nearby = dialogue.findNearby(player.x);
      // Check for nearby doors
      const door = this.findNearbyDoor(player.x, area.doors);

      const hintEl = document.getElementById('interact-hint')!;
      if (door && !dialogue.isOpen) {
        // Door prompt takes priority over interaction prompt
        hintEl.innerHTML = `E — ${door.label}`;
        hintEl.style.display = 'block';
        if (keys.has('KeyE')) {
          keys.delete('KeyE');
          hintEl.style.display = 'none';
          ctx.requestAreaTransition(door.target, door.spawnX, door.spawnFacing);
        }
      } else if (nearby) {
        hintEl.textContent = 'E — examine';
        hintEl.style.display = 'block';
        if (keys.has('KeyE')) {
          keys.delete('KeyE');
          dialogue.openDialogue(nearby);
          hintEl.style.display = 'none';
        }
      } else {
        hintEl.style.display = 'none';
      }
    }

    dialogue.update(dt);

    const walking = keys.has('ArrowLeft') || keys.has('KeyA')
                 || keys.has('ArrowRight') || keys.has('KeyD');
    audio.update(dt, walking);

    if (area.exterior) {
      puddles.update(camera, dt);
      puddles.render(renderer, scene);
    }

    // Dev trigger: B key enters battle stub
    if (keys.has('KeyB')) {
      keys.delete('KeyB');
      return new BattleState();
    }

    return null;
  }

  private findNearbyDoor(playerX: number, doors: DoorDef[]): DoorDef | null {
    let best: { door: DoorDef; dist: number } | null = null;
    for (const door of doors) {
      const dist = Math.abs(door.x - playerX);
      if (dist < door.radius && (!best || dist < best.dist)) {
        best = { door, dist };
      }
    }
    return best?.door ?? null;
  }
}