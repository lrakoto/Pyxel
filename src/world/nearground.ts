import * as THREE from 'three';

/**
 * Pre-blurred silhouettes hugging the camera — fake depth-of-field, like the
 * out-of-focus pole and rubble band framing the REPLACED street shot. The
 * blur is baked into the textures (canvas filter), so it costs nothing at
 * render time.
 */

const NEAR_Z = 9.5;

function blurredTexture(
  w: number,
  h: number,
  blur: number,
  draw: (ctx: CanvasRenderingContext2D) => void,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.filter = `blur(${blur}px)`;
  draw(ctx);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function soft(tex: THREE.Texture): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
    fog: false,
  });
}

function noReflect<T extends THREE.Object3D>(obj: T): T {
  obj.userData.noReflect = true;
  return obj;
}

export function buildNearground(scene: THREE.Scene) {
  const poleTex = blurredTexture(64, 256, 5, (ctx) => {
    ctx.fillStyle = 'rgba(4, 6, 10, 0.95)';
    ctx.fillRect(22, 0, 20, 256);
    ctx.fillRect(10, 30, 44, 7);
  });
  const slabTex = blurredTexture(96, 256, 6, (ctx) => {
    ctx.fillStyle = 'rgba(4, 6, 10, 0.95)';
    ctx.fillRect(30, 0, 66, 256);
    ctx.fillRect(18, 90, 78, 30);
  });

  for (const x of [-20, -8, 14, 27]) {
    const pole = noReflect(new THREE.Mesh(new THREE.PlaneGeometry(1.5, 8), soft(poleTex)));
    pole.position.set(x, 2.6, NEAR_Z);
    scene.add(pole);
  }
  const slab = noReflect(new THREE.Mesh(new THREE.PlaneGeometry(2.6, 8), soft(slabTex)));
  slab.position.set(3.5, 2.4, NEAR_Z + 0.3);
  scene.add(slab);

  // blurred rubble band hiding the bottom edge of the frame
  const bandTex = blurredTexture(512, 64, 6, (ctx) => {
    ctx.fillStyle = 'rgba(3, 5, 9, 0.96)';
    ctx.fillRect(0, 26, 512, 38);
    for (let i = 0; i < 40; i++) {
      ctx.fillRect(Math.random() * 512, 18 + Math.random() * 10, 8 + Math.random() * 18, 14);
    }
    ctx.fillStyle = 'rgba(140, 170, 210, 0.18)';
    for (let i = 0; i < 24; i++) {
      ctx.fillRect(Math.random() * 512, 34 + Math.random() * 24, 4, 2);
    }
  });
  const band = noReflect(new THREE.Mesh(new THREE.PlaneGeometry(46, 2), soft(bandTex)));
  band.position.set(0, 0.15, 8.2);
  scene.add(band);
}
