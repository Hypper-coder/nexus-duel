/**
 * Replaces window.setTimeout / window.clearTimeout with a Web Worker-backed
 * version for the duration of a Phaser game instance.
 *
 * Why: Chrome throttles setTimeout in hidden/background tabs to ~1 fps.
 * A dedicated Worker's own setTimeout is NOT subject to this throttle, so
 * routing Phaser's timer calls through the Worker keeps the game loop running
 * at full speed even when the host's tab is off-screen.
 *
 * Usage:
 *   const uninstall = installWorkerTimer();
 *   const game = new Phaser.Game(config);
 *   // later, on cleanup:
 *   game.destroy(true);
 *   uninstall();
 */

const WORKER_SRC = `
  const timers = {};
  self.onmessage = ({ data }) => {
    if (data.type === 'set') {
      timers[data.id] = setTimeout(() => {
        delete timers[data.id];
        self.postMessage(data.id);
      }, data.ms);
    } else if (data.type === 'clear') {
      clearTimeout(timers[data.id]);
      delete timers[data.id];
    }
  };
`;

export function installWorkerTimer() {
  const blob = new Blob([WORKER_SRC], { type: "text/javascript" });
  const url = URL.createObjectURL(blob);
  const worker = new Worker(url);
  URL.revokeObjectURL(url);

  const callbacks = {};
  let seq = 0;

  worker.onmessage = ({ data: id }) => {
    const cb = callbacks[id];
    if (cb) {
      delete callbacks[id];
      cb();
    }
  };

  const origSet = window.setTimeout.bind(window);
  const origClear = window.clearTimeout.bind(window);

  window.setTimeout = (fn, ms = 0, ...args) => {
    const id = ++seq;
    callbacks[id] = typeof fn === "function" ? () => fn(...args) : () => new Function(fn)(); // eslint-disable-line no-new-func
    worker.postMessage({ type: "set", id, ms });
    return id;
  };

  window.clearTimeout = (id) => {
    if (callbacks[id]) {
      delete callbacks[id];
      worker.postMessage({ type: "clear", id });
    } else {
      origClear(id);
    }
  };

  return function uninstall() {
    window.setTimeout = origSet;
    window.clearTimeout = origClear;
    worker.terminate();
  };
}
