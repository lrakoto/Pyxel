import type { Journal } from './Journal';

/**
 * Full-screen case journal overlay. Toggled with J or Tab; pauses the game
 * while open. Shows the current objective and every clue Cole has collected,
 * most recent last, in a noir case-file layout.
 */
export class JournalUI {
  private readonly rootEl: HTMLElement;
  private readonly objectiveEl: HTMLElement;
  private readonly listEl: HTMLElement;
  private readonly countEl: HTMLElement;
  private open = false;

  constructor(private readonly journal: Journal) {
    this.rootEl = document.createElement('div');
    this.rootEl.id = 'journal-overlay';
    this.rootEl.style.display = 'none';
    this.rootEl.innerHTML = `
      <div id="journal-panel">
        <div id="journal-header">
          <span id="journal-title">CASE FILE — GRAVES, M.</span>
          <span id="journal-hint">J / TAB / ESC — close</span>
        </div>
        <div id="journal-objective-label">CURRENT OBJECTIVE</div>
        <div id="journal-objective"></div>
        <div id="journal-clues-label">EVIDENCE <span id="journal-count"></span></div>
        <div id="journal-list"></div>
      </div>`;
    document.body.appendChild(this.rootEl);

    this.objectiveEl = this.rootEl.querySelector('#journal-objective')!;
    this.listEl = this.rootEl.querySelector('#journal-list')!;
    this.countEl = this.rootEl.querySelector('#journal-count')!;
  }

  get isOpen(): boolean {
    return this.open;
  }

  /** Rebuild the clue list from the journal and show the overlay. */
  show() {
    this.render();
    this.rootEl.style.display = 'flex';
    this.open = true;
  }

  hide() {
    this.rootEl.style.display = 'none';
    this.open = false;
  }

  toggle() {
    if (this.open) this.hide();
    else this.show();
  }

  private render() {
    this.objectiveEl.textContent = this.journal.currentObjective;
    this.countEl.textContent = `(${this.journal.count})`;

    if (this.journal.count === 0) {
      this.listEl.innerHTML =
        '<div class="journal-empty">No evidence yet. Enter investigation mode and examine the scene.</div>';
      return;
    }

    this.listEl.innerHTML = this.journal.clues
      .map(
        (c) => `
        <div class="journal-clue">
          <div class="journal-clue-title">${c.title}</div>
          <div class="journal-clue-body">${c.body}</div>
        </div>`,
      )
      .join('');
    // Scroll to newest (bottom) entry.
    this.listEl.scrollTop = this.listEl.scrollHeight;
  }
}
