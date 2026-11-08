// A debounce that always runs on the main window's timers.
//
// Obsidian's own debounce() sets its timer on the window that is active at the first call (activeWindow). If that
// window closes before the timer fires (a popout window, or Settings, which is its own window in Obsidian 1.15),
// the timer is lost while the debouncer still counts it as pending, so every later call only moves the deadline
// and the callback never runs again. On a vault's first open that happens for real: the "Trust author" prompt
// opens Settings, the plugins load while it's the active window, and Settings closes a moment later.

/** A debounced function: call it to (re)schedule; `cancel()` drops a pending run; `run()` runs it now if pending. */
export interface Debounced<A extends unknown[]> {
  (...args: A): void;
  cancel(): void;
  run(): void;
}

/** The main window's timers (globalThis is the main window in Obsidian, and Node's globals in unit tests). */
const timers = globalThis;

/**
 * Runs `fn` with the latest arguments `wait` ms after the first call of a burst, or, with `resetTimer`, `wait` ms
 * after the last call (like Obsidian's debounce).
 */
export function debounce<A extends unknown[]>(
  fn: (...args: A) => unknown,
  wait: number,
  resetTimer = false,
): Debounced<A> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let due = 0;
  let args: A | null = null;
  const fire = () => {
    timer = null;
    const left = due - Date.now();
    if (left > 0) {
      timer = timers.setTimeout(fire, left);
      return;
    }
    const a = args;
    args = null;
    if (a) fn(...a);
  };
  const call = (...a: A) => {
    args = a;
    if (timer === null) {
      due = Date.now() + wait;
      timer = timers.setTimeout(fire, wait);
    } else if (resetTimer) due = Date.now() + wait;
  };
  return Object.assign(call, {
    cancel() {
      if (timer !== null) timers.clearTimeout(timer);
      timer = null;
      args = null;
    },
    run() {
      if (timer === null) return;
      timers.clearTimeout(timer);
      timer = null;
      const a = args;
      args = null;
      if (a) fn(...a);
    },
  });
}
