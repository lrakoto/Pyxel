import * as THREE from 'three';

/**
 * A glint — the small pulsing cyan-white sparkle that marks an examinable
 * object while investigation mode is active. Cheap additive sprite; one per
 * interaction point, shown/hidden by the investigate state.
 */
export class Glint {
  readonly sprite: THREE.Sprite;
  private readonly baseScale: number;
  private phase: number;
  private collected = false;

  constructor(radius = 0.22) {
    this.baseScale = radius;
    this.collected = radius < 0.2; // constructed small => already collected
    this.phase = Math.random() * Math.PI * 2;

    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d')!;
    // Four-point star: tight core + cross flare.
    const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.25, 'rgba(120,230,255,0.85)');
    grad.addColorStop(0.55, 'rgba(54,224,255,0.25)');
    grad.addColorStop(1, 'rgba(54,224,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 32, 32);
    ctx.strokeStyle = 'rgba(220,250,255,0.9)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(16, 3); ctx.lineTo(16, 29);
    ctx.moveTo(3, 16); ctx.lineTo(29, 16);
    ctx.stroke();

    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
      opacity: 0.9,
    });
    this.sprite = new THREE.Sprite(mat);
    this.sprite.scale.setScalar(radius);
    this.sprite.renderOrder = 999;
    this.sprite.visible = false;
    this.sprite.userData.noReflect = true;
  }

  /** Show the glint at a world position. */
  show(x: number, y: number, z: number) {
    this.sprite.position.set(x, y, z);
    this.sprite.visible = true;
  }

  hide() {
    this.sprite.visible = false;
  }

  get visible(): boolean {
    return this.sprite.visible;
  }

  /** Mark as already-collected: dim the pulse permanently. */
  setCollected(v: boolean) {
    this.collected = v;
  }

  /** Pulse the glint — call each frame while shown. */
  update(dt: number, emphasized = false) {
    if (!this.sprite.visible) return;
    this.phase += dt * (emphasized ? 5.5 : 2.6);
    const pulse = 0.72 + 0.28 * Math.sin(this.phase);
    const mat = this.sprite.material as THREE.SpriteMaterial;
    const base = this.collected ? 0.22 : 0.4;
    mat.opacity = emphasized && !this.collected
      ? 0.75 + 0.25 * Math.sin(this.phase)
      : base + (this.collected ? 0.15 : 0.5) * pulse;
    const s = this.baseScale * (emphasized && !this.collected ? 1.5 : 1.0) * (0.9 + 0.25 * pulse);
    this.sprite.scale.setScalar(s);
  }
}
