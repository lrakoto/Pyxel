import * as THREE from 'three';

const SPLASH_COUNT = 20;

function splashTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 16;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
  g.addColorStop(0, 'rgba(160, 190, 220, 0.6)');
  g.addColorStop(0.3, 'rgba(160, 190, 220, 0.25)');
  g.addColorStop(1, 'rgba(160, 190, 220, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 16, 16);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class RainSplash {
  readonly group = new THREE.Group();
  private readonly items: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; phase: number; speed: number; xOff: number; zOff: number }[] = [];
  private t = 0;

  constructor() {
    const tex = splashTexture();
    const geo = new THREE.PlaneGeometry(0.25, 0.25);
    for (let i = 0; i < SPLASH_COUNT; i++) {
      const mat = new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(
        (Math.random() - 0.5) * 30,
        0.04,
        -4 + Math.random() * 5,
      );
      mesh.rotation.x = -Math.PI / 2;
      this.group.add(mesh);
      this.items.push({
        mesh,
        mat,
        phase: Math.random() * Math.PI * 2,
        speed: 0.4 + Math.random() * 0.5,
        xOff: (Math.random() - 0.5) * 30,
        zOff: -4 + Math.random() * 5,
      });
    }
    this.group.userData.noReflect = true;
  }

  update(dt: number, camX: number) {
    this.t += dt;
    for (const it of this.items) {
      const cycle = (this.t * it.speed + it.phase) % 1;
      // Fade in, hold briefly, fade out
      if (cycle < 0.15) {
        it.mat.opacity = cycle / 0.15 * 0.35;
      } else if (cycle < 0.5) {
        it.mat.opacity = 0.35 * (1 - (cycle - 0.15) / 0.35);
      } else {
        it.mat.opacity = 0;
      }
      // Reposition relative to camera so splashes follow the player
      const sweep = (cycle - 0.5) * 0.6;
      it.mesh.position.set(camX + it.xOff + sweep, 0.04, it.zOff);
      it.mesh.scale.setScalar(0.8 + sweep * 2);
    }
  }

}
