import { expect } from 'chai';
import { describe, it } from 'mocha';

import { observeTextContainerResize } from '../src/widgets/template/text-autofit';

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

    resizeCallback?.([], observer as ResizeObserver);
    expect(callbackCalls).to.equal(1);
  });

  it('returns null when there is no parent element', () => {
    (globalThis as any).ResizeObserver = class {
      observe() {}
      disconnect() {}
    };

    const textElement = { parentElement: null } as unknown as HTMLDivElement;

    expect(observeTextContainerResize(textElement, () => undefined)).to.equal(null);
  });
});
