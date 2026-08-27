import ResizeObserver from 'resize-observer-polyfill';

if (!global.ResizeObserver) {
  global.ResizeObserver = ResizeObserver;
}
