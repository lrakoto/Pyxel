import { GameState } from './StateMachine';
import type { GameContext } from './GameContext';
import { ShooterState } from './ShooterState';

export class ExploreState extends GameState {
  get name(): string {
    return 'explore';
  }

  update(ctx: GameContext, dt: number): GameState | null {
    const { player, playerLight, signLights, rain, rainFar, splashes, updatables, world, camera, dialogue, audio, keys, puddles, renderer, scene } = ctx;

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
      rain.update(dt, ctx.camX);
      rainFar.update(dt, 0);
      splashes.update(dt, ctx.camX);
      for (const u of updatables) u.update(dt);

      ctx.camX += (player.x * 0.9 - ctx.camX) * Math.min(1, dt * 3);
      camera.position.x = ctx.camX;
      camera.lookAt(ctx.camX, 2.0, 0);
      world.viewPoint.copy(camera.position);

      const nearby = dialogue.findNearby(player.x);
      const hintEl = document.getElementById('interact-hint')!;
      if (nearby) {
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

    puddles.update(camera, dt);
    puddles.render(renderer, scene);

    // Dev trigger: B key enters the shooter combat
    if (keys.has('KeyB')) {
      keys.delete('KeyB');
      return new ShooterState();
    }

    return null;
  }
}
