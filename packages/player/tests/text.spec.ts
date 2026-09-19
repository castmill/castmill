import { expect } from 'chai';
import { afterEach, describe, it } from 'mocha';

import {
  observeTextContainerResize,
  observeTextContentChanges,
} from '../src/widgets/template/text-autofit';

const originalResizeObserver = globalThis.ResizeObserver;
const originalMutationObserver = globalThis.MutationObserver;

afterEach(() => {
  globalThis.ResizeObserver = originalResizeObserver;
  globalThis.MutationObserver = originalMutationObserver;
});

describe('observeTextContainerResize', () => {
  it('observes the text parent element and reruns the callback on resize', () => {
    let resizeCallback: ResizeObserverCallback | undefined;
    let observedElement: unknown;
    let callbackCalls = 0;

    (globalThis as any).ResizeObserver = class {
      constructor(callback: ResizeObserverCallback) {
        resizeCallback = callback;
      }

      observe(element: unknown) {
        observedElement = element;
      }

      disconnect() {}
    };

    const parentElement = { id: 'parent' } as unknown as HTMLDivElement;
    const textElement = { parentElement } as unknown as HTMLDivElement;

    const observer = observeTextContainerResize(textElement, () => {
      callbackCalls += 1;
    });

    expect(observer).to.not.equal(null);
    expect(observedElement).to.equal(parentElement);

    resizeCallback?.([], observer as unknown as ResizeObserver);
    expect(callbackCalls).to.equal(1);
  });

  it('returns a no-op cleanup when there is no parent element', () => {
    (globalThis as any).ResizeObserver = class {
      observe() {}
      disconnect() {}
    };

    const textElement = { parentElement: null } as unknown as HTMLDivElement;

    expect(observeTextContainerResize(textElement, () => undefined)).to.be.a(
      'function'
    );
  });
});

describe('observeTextContentChanges', () => {
  it('observes text mutations and reruns the callback', () => {
    let mutationCallback: MutationCallback | undefined;
    let observedElement: unknown;
    let callbackCalls = 0;

    (globalThis as any).MutationObserver = class {
      constructor(callback: MutationCallback) {
        mutationCallback = callback;
      }

      observe(element: unknown) {
        observedElement = element;
      }

      disconnect() {}
    };

    const textElement = { id: 'text' } as unknown as HTMLDivElement;

    const observer = observeTextContentChanges(textElement, () => {
      callbackCalls += 1;
    });

    expect(observer).to.not.equal(null);
    expect(observedElement).to.equal(textElement);

    mutationCallback?.([], observer as MutationObserver);
    expect(callbackCalls).to.equal(1);
  });

  it('returns null when MutationObserver is unavailable', () => {
    (globalThis as any).MutationObserver = undefined;

    const textElement = { id: 'text' } as unknown as HTMLDivElement;

    expect(observeTextContentChanges(textElement, () => undefined)).to.equal(
      null
    );
  });
});
