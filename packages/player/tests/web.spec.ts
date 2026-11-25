import { expect } from 'chai';
import { afterEach, beforeEach, describe, it } from 'mocha';
// @ts-ignore jsdom is hoisted from other workspaces without type declarations.
import { JSDOM } from 'jsdom';
import sinon from 'sinon';
import { ResourceManager } from '@castmill/cache';
import {
  PlayerRuntimeError,
  TemplateComponentType,
  TemplateWidget,
} from '../dist/index.js';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('Web template component', () => {
  const globals = globalThis as typeof globalThis & Record<string, unknown>;
  const keys = ['window', 'document', 'Node', 'HTMLElement', 'Element'];
  const saved = new Map<string, PropertyDescriptor | undefined>();
  let dom: JSDOM;
  let widget: TemplateWidget | undefined;
  let unsubscribe: (() => void) | undefined;
  let clock: sinon.SinonFakeTimers | undefined;
  let errors: PlayerRuntimeError[];
  let ready: number;

  beforeEach(() => {
    dom = new JSDOM('<!doctype html><div id="root"></div>');
    for (const key of keys) {
      saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
      Object.defineProperty(globalThis, key, {
        configurable: true,
        writable: true,
        value: key === 'window' ? dom.window : dom.window[key],
      });
    }
    errors = [];
    ready = 0;
  });

  afterEach(async () => {
    unsubscribe?.();
    unsubscribe = undefined;
    await widget?.unload();
    widget = undefined;
    clock?.restore();
    clock = undefined;
    dom.window.close();
    for (const key of keys) {
      const descriptor = saved.get(key);
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globals[key];
    }
  });

  const show = (url: unknown, nested = false) => {
    const web = {
      type: TemplateComponentType.Web,
      name: 'web',
      opts: { url },
      style: { width: '640px', height: '360px' },
    };
    const template = nested
      ? {
          type: TemplateComponentType.Group,
          name: 'group',
          opts: {},
          context: { key: 'data.page' },
          components: [web],
        }
      : web;
    const unexpectedCacheAccess = (): never => {
      throw new Error(
        'Web pages must load directly, not through the media cache'
      );
    };
    widget = new TemplateWidget(
      new ResourceManager({
        init: unexpectedCacheAccess,
        list: unexpectedCacheAccess,
        count: unexpectedCacheAccess,
        get: unexpectedCacheAccess,
        hasUrl: unexpectedCacheAccess,
        set: unexpectedCacheAccess,
        del: unexpectedCacheAccess,
        invalidate: unexpectedCacheAccess,
        clean: unexpectedCacheAccess,
        close: unexpectedCacheAccess,
      }),
      {
        widget: { name: 'Web', template },
        config: {
          widget_id: 1,
          options: { url: 'https://example.com/dashboard' },
          data: { page: { url: 'https://example.com/context' } },
        },
        globals: {
          target: 'preview',
          reportError: (error) => errors.push(error),
        },
      }
    );
    const showing = widget
      .show(dom.window.document.getElementById('root')!, 0)
      .subscribe(() => ready++);
    unsubscribe = () => showing.unsubscribe();
  };

  const frame = (): HTMLIFrameElement =>
    dom.window.document.querySelector('iframe')!;

  it('supports the seeded Web template and waits for its page to load', async () => {
    show({ key: 'options.url' });
    await flush();
    expect(frame().src).to.equal('https://example.com/dashboard');
    expect(frame().style.width).to.equal('640px');
    expect(frame().style.height).to.equal('360px');
    expect(frame().getAttribute('sandbox')).not.to.contain(
      'allow-top-navigation'
    );
    expect(ready).to.equal(0);
    frame().dispatchEvent(new dom.window.Event('load'));
    await flush();
    expect(ready).to.equal(1);
    frame().dispatchEvent(new dom.window.Event('load'));
    await flush();
    expect(ready).to.equal(1);
  });

  it('resolves a URL from nested group context', async () => {
    show({ key: '$.url' }, true);
    await flush();
    expect(frame().src).to.equal('https://example.com/context');
    frame().dispatchEvent(new dom.window.Event('load'));
    await flush();
    expect(ready).to.equal(1);
  });

  it('reports missing, malformed and non-web URLs without navigating', async () => {
    for (const url of [
      undefined,
      '',
      '/relative',
      'https://',
      'javascript:alert(1)',
      'data:text/html,test',
    ]) {
      show(url);
      await flush();
      expect(frame()).to.equal(null);
      expect(
        dom.window.document.querySelector('[role=alert]')!.textContent
      ).to.contain('HTTP or HTTPS URL');
      expect(errors[errors.length - 1].code).to.equal('web-invalid-url');
      expect(ready).to.equal(0);
      unsubscribe?.();
      await widget!.unload();
    }
  });

  it('reports a failed page and recovers if a later load succeeds', async () => {
    show('https://example.com/dashboard');
    await flush();
    frame().dispatchEvent(new dom.window.Event('error'));
    expect(errors[0].code).to.equal('web-load-failed');
    expect(ready).to.equal(0);
    frame().dispatchEvent(new dom.window.Event('load'));
    await flush();
    expect(ready).to.equal(1);
    const blocks: unknown[] = [];
    widget!
      .blocked$()
      .subscribe((block) => blocks.push(block))
      .unsubscribe();
    expect(blocks).to.deep.equal([undefined]);
  });

  it('bounds loading time and cancels the timeout when unloaded', async () => {
    clock = sinon.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    show('https://example.com/dashboard');
    await Promise.resolve();
    clock.tick(30000);
    expect(errors[0].code).to.equal('web-load-timeout');
    expect(ready).to.equal(0);
    const detached = frame();
    await widget!.unload();
    expect(detached.src).to.equal('about:blank');
    detached.dispatchEvent(new dom.window.Event('load'));
    detached.dispatchEvent(new dom.window.Event('error'));
    clock.tick(60000);
    expect(errors).to.have.length(1);
    expect(ready).to.equal(0);
  });

  it('cancels a pending page without a late readiness or timeout report', async () => {
    show('https://example.com/dashboard');
    await flush();
    const detached = frame();
    await widget!.unload();
    expect(detached.src).to.equal('about:blank');
    detached.dispatchEvent(new dom.window.Event('load'));
    await flush();
    expect(errors).to.have.length(0);
    expect(ready).to.equal(0);
  });
});
