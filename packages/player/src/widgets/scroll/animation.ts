/*
 * Resolve requestAnimationFrame and cancelAnimationFrame regardless of whether window exists.
 * Source: https://gist.github.com/mertenvg/704cc30f419bb14bf34df9ef3083c1bf
 */

/*
 * make window type index-able
 */
interface IndexableWindow {
  [key: string]: any;
}

/*
 * Create an object to store the requestAnimationFrame and cancelAnimationFrame functions so it doesn't interfere
 * with functions declared in the global space.
 */
const animation: {
  requestAnimationFrame(callback: FrameRequestCallback): number;
  cancelAnimationFrame(id: number): void;
} = {
  requestAnimationFrame: () => 0,
  cancelAnimationFrame: () => undefined,
};

/*
 * Look for browser specific implementations of the requestAnimationFrame, and cancelAnimationFrame functions
 */
if (window) {
  const vendors = ['ms', 'moz', 'webkit', 'o'];
  const win = window as IndexableWindow;

  animation.requestAnimationFrame = vendors
    .map((vendor) => win[vendor + 'RequestAnimationFrame'])
    .reduce(
      (accumulator, func) => accumulator || func,
      window.requestAnimationFrame
    );

  animation.cancelAnimationFrame = vendors
    .map(
      (vendor) =>
        win[vendor + 'CancelAnimationFrame'] ||
        win[vendor + 'CancelRequestAnimationFrame']
    )
    .reduce(
      (accumulator, func) => accumulator || func,
      window.cancelAnimationFrame
    );
}

/*
 * Fallback to setTimeout logic if no existing alternatives can be found
 */
if (!animation.requestAnimationFrame) {
  let lastTime = 0;
  animation.requestAnimationFrame = (callback) => {
    const currTime = new Date().getTime();
    const timeToCall = Math.max(0, 16 - (currTime - lastTime));
    const id = window.setTimeout(() => {
      callback(currTime + timeToCall);
    }, timeToCall);
    lastTime = currTime + timeToCall;
    return id;
  };

  if (!animation.cancelAnimationFrame) {
    animation.cancelAnimationFrame = (id) => {
      clearTimeout(id);
    };
  }
}

export const requestAnimationFrame = animation.requestAnimationFrame;

export const cancelAnimationFrame = animation.cancelAnimationFrame;
