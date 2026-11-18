import '@testing-library/jest-dom';
import { configure } from '@solidjs/testing-library';

// findBy*/waitFor give up after 1s by default, which debounced pages exceed
// when the whole suite runs in parallel; they still resolve as soon as possible.
configure({ asyncUtilTimeout: 3000 });

// Mock ResizeObserver for tests
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const ensureNavigatorProperty = (key: string, value: unknown) => {
  const navigatorRef = (globalThis.navigator ??= {} as Navigator);
  const currentValue = Reflect.get(navigatorRef, key);

  if (currentValue == null) {
    Object.defineProperty(navigatorRef, key, {
      configurable: true,
      enumerable: true,
      writable: true,
      value,
    });
  }
};

ensureNavigatorProperty('language', 'en-US');
ensureNavigatorProperty('languages', ['en-US', 'en']);
ensureNavigatorProperty('userAgent', 'vitest');
