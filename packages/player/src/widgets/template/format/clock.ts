import { createSignal } from 'solid-js';

const MINUTE = 60000;

const [minute, setMinute] = createSignal(0);
let started = false;

function start() {
  started = true;
  const tick = () => setMinute(Date.now());
  // Align ticks with the start of each minute so "HH:mm" changes on time.
  const first = setTimeout(
    () => {
      tick();
      const interval = setInterval(tick, MINUTE);
      unref(interval);
    },
    MINUTE - (Date.now() % MINUTE)
  );
  unref(first);
}

// Timers must not keep Node processes (tests, tools) alive.
function unref(timer: unknown) {
  const handle = timer as { unref?: () => void };
  if (handle && typeof handle.unref === 'function') {
    handle.unref();
  }
}

/**
 * The current time in milliseconds. Reading it inside a reactive scope (such
 * as a component's resolved options) re-evaluates that scope every minute, so
 * values derived from `@now` stay current while a widget is shown.
 */
export function now(): number {
  if (!started) {
    start();
  }
  minute();
  return Date.now();
}

/**
 * Re-evaluates everything that depends on `@now` right away, e.g. after the
 * device wakes up or in tests.
 */
export function tickClock(): void {
  setMinute(Date.now());
}
