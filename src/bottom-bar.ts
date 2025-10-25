export class BottomBar {
  private text: string;
  private out = process.stdout;
  private hadTTY = this.out.isTTY;
  private onResizeBound = this.onResize.bind(this);
  private enabled = false;

  constructor(text: string) {
    this.text = text;
  }

  enable() {
    if (!this.hadTTY) {
      console.error("BottomBar: not a TTY; skipping status bar.");
      return;
    }
    if (this.enabled) return;
    this.enabled = true;

    // Save cursor position
    this.write("\x1b[s");

    // Hide cursor, disable line wrap (for the bottom line), set scroll region
    this.write("\x1b[?25l"); // hide cursor
    this.write("\x1b[?7l"); // wrap off
    this.applyScrollRegion();
    this.renderBar();

    // Restore cursor position
    this.write("\x1b[u");

    // Handle resize and cleanup
    this.out.on("resize", this.onResizeBound);
  }

  disable() {
    if (!this.enabled) return;
    this.enabled = false;
    this.cleanup();
  }

  updateText(text: string) {
    this.text = text;
    if (!this.enabled) return;

    // Save cursor position
    this.write("\x1b[s");

    // Render the bar with new text
    this.renderBar();

    // Restore cursor position
    this.write("\x1b[u");
  }

  private write(s: string) {
    this.out.write(s);
  }

  private moveCursorTo(row: number, col: number) {
    this.write(`\x1b[${row};${col}H`);
  }

  private clearLine() {
    this.write("\x1b[2K");
  }

  private applyScrollRegion() {
    // Reserve the last line for the bar
    const rows = this.out.rows ?? 24;
    const top = 1;
    const bottom = Math.max(1, rows - 1);
    this.write(`\x1b[${top};${bottom}r`); // set scroll region [top..bottom]
  }

  private resetScrollRegion() {
    this.write("\x1b[r"); // reset scroll region to full screen
  }

  private renderBar() {
    const rows = this.out.rows ?? 24;
    const cols = this.out.columns ?? 80;

    // Compute one-line bar text (truncate and pad to fill width)
    // biome-ignore lint/suspicious/noControlCharactersInRegex: <explanation>
    const raw = this.text.replace(/\x1b\[[0-9;]*m/g, ""); // strip color len for trunc (optional)
    const visible =
      raw.length > cols ? raw.slice(0, Math.max(0, cols - 1)) : raw;
    const padded = visible.padEnd(cols, " ");

    // Draw at bottom row
    this.moveCursorTo(rows, 1);
    this.clearLine();
    this.write(padded);
  }

  private onResize() {
    if (!this.enabled) return;
    // Re-apply scroll region and redraw bar
    this.applyScrollRegion();
    this.renderBar();
    // Put cursor back to end of scroll area so prints continue above bar
    this.moveCursorTo(this.out.rows - 1, 1);
  }

  cleanup() {
    // Restore terminal state
    this.resetScrollRegion();
    this.write("\x1b[?7h"); // wrap on
    this.write("\x1b[?25h"); // show cursor
    // Move cursor to last line and clear (tidy exit)
    const rows = this.out.rows ?? 24;
    this.moveCursorTo(rows, 1);
    this.clearLine();
    this.out.off("resize", this.onResizeBound);
  }
}
