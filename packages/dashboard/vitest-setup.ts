import '@testing-library/jest-dom';

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
