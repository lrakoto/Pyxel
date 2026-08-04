/**
 * A transient toast shown when Cole collects new evidence. Slides up from the
 * lower-right, holds, then slides away. Non-blocking — exploration continues.
 */
export class ClueToast {
  private readonly el: HTMLElement;
  private hideTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.el = document.createElement('div');
    this.el.id = 'clue-toast';
    this.el.style.display = 'none';
    document.body.appendChild(this.el);
  }

  /** Show "EVIDENCE ADDED — <title>" for a few seconds. */
  show(title: string) {
    if (this.hideTimer) clearTimeout(this.hideTimer);
    this.el.innerHTML = `
      <span class="clue-toast-label">EVIDENCE ADDED</span>
      <span class="clue-toast-title">${title}</span>`;
    this.el.style.display = 'block';
    // Restart the slide-in animation.
    this.el.classList.remove('clue-toast-in');
    void this.el.offsetWidth;
    this.el.classList.add('clue-toast-in');
    this.hideTimer = setTimeout(() => {
      this.el.style.display = 'none';
    }, 4200);
  }
}
