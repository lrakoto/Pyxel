import * as THREE from 'three';
import { spriteTexture } from '../pixelTextures';

/**
 * Cole's machine pistol as a small pixel sprite pinned at his hands and rotated
 * to point at the aim angle (the mouse cursor) — the twin-stick "right stick"
 * made visible. The grip sits near the pivot and the barrel extends along +x, so
 * setting rotation.z aims it. When aiming to Cole's left (|angle| > 90°) the
 * sprite is flipped on its local y so the gun stays upright instead of inverted.
 * A separate additive muzzle-flash quad blinks at the barrel tip on each shot.
 */

// Compact machine pistol, facing right. Grip bottom-left, barrel to the right.
const PISTOL = [
  '..............',
  '....mMMMMMM...',
  '...mMMMMMMMm..',
  '..bMMMMMMMMm..',
  '..bMMMmm......',
  '..bbMb........',
  '..bbb.........',
  '...bb.........',
];
const PALETTE: Record<string, string> = {
  M: '#2b313c', // body / slide
  m: '#4a5360', // metal highlight
  b: '#15181f', // grip
};

const PX_W = 14;
const PX_H = 8;
const GUN_W = 0.95;
const GUN_H = GUN_W * (PX_H / PX_W);
// Distance from the pivot (hand) to the barrel tip, in world units.
const MUZZLE_REACH = 0.62;

export interface Muzzle {
  x: number;
  y: number;
}

export class Gun {
  readonly group = new THREE.Group();
  private readonly pistol: THREE.Mesh;
  private readonly flash: THREE.Mesh;
  private readonly flashMat: THREE.MeshBasicMaterial;
  private flashTimer = 0;
  private recoil = 0; // current recoil push-back, world units, decays to 0

  constructor() {
    const mat = new THREE.MeshBasicMaterial({
      map: spriteTexture(PISTOL, PALETTE),
      transparent: true,
      alphaTest: 0.5,
      depthWrite: false,
      depthTest: false,
      side: THREE.DoubleSide,
    });
    const geo = new THREE.PlaneGeometry(GUN_W, GUN_H);
    // Shift the sprite forward of the pivot so the hand grips near origin and
    // the barrel points out along +x.
    geo.translate(GUN_W * 0.28, 0, 0);
    this.pistol = new THREE.Mesh(geo, mat);
    this.pistol.renderOrder = 12;

    this.flashMat = new THREE.MeshBasicMaterial({
      color: '#ffdca0',
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
    });
    this.flash = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.32), this.flashMat);
    this.flash.renderOrder = 13;
    this.flash.visible = false;

    this.group.add(this.pistol);
    this.group.add(this.flash);
    this.group.renderOrder = 12;
  }

  /**
   * Places and aims the gun at the hand position (hx, hy) along `angle`.
   * Returns the world-space barrel tip so the caller can spawn bullets/flash.
   */
  aim(hx: number, hy: number, angle: number): Muzzle {
    // Recoil shoves the whole gun back along -aim, easing forward again.
    const rx = hx - Math.cos(angle) * this.recoil;
    const ry = hy - Math.sin(angle) * this.recoil;
    this.pistol.position.set(rx, ry, 0.04);
    this.pistol.rotation.z = angle;
    const aimingLeft = Math.abs(angle) > Math.PI / 2;
    this.pistol.scale.y = aimingLeft ? -1 : 1;
    return {
      x: rx + Math.cos(angle) * MUZZLE_REACH,
      y: ry + Math.sin(angle) * MUZZLE_REACH,
    };
  }

  /** Blinks the muzzle flash at (mx, my) and kicks the gun back. */
  fireFlash(mx: number, my: number) {
    this.flash.position.set(mx, my, 0.05);
    this.flash.rotation.z = Math.random() * Math.PI;
    this.flash.scale.setScalar(0.8 + Math.random() * 0.5);
    this.flashTimer = 0.05;
    this.flashMat.opacity = 1;
    this.flash.visible = true;
    this.recoil = Math.min(0.16, this.recoil + 0.09);
  }

  update(dt: number) {
    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      this.flashMat.opacity = Math.max(0, this.flashTimer / 0.05);
      if (this.flashTimer <= 0) this.flash.visible = false;
    }
    // Ease the recoil back to rest.
    if (this.recoil > 0) this.recoil = Math.max(0, this.recoil - dt * 1.1);
  }
}
