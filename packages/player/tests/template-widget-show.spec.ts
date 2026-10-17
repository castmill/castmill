import { expect } from 'chai';
import { afterEach, beforeEach, describe, it } from 'mocha';
// @ts-ignore jsdom is hoisted from other workspaces without type declarations.
import { JSDOM } from 'jsdom';
import { firstValueFrom } from 'rxjs';

import { TemplateWidget } from '../dist/index.js';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('TemplateWidget.show', () => {
  const globals = globalThis as any;
  const saved: Record<string, unknown> = {};
  const keys = ['window', 'document', 'Node', 'HTMLElement', 'Element'];
  let dom: any;

  beforeEach(() => {
    dom = new JSDOM('<!doctype html><div id="root"></div>');
    keys.forEach((key) => {
      saved[key] = globals[key];
      globals[key] = key === 'window' ? dom.window : dom.window[key];
    });
    globals.document = dom.window.document;
    // jsdom does not implement media loading.
    dom.window.HTMLMediaElement.prototype.load = () => {};
  });

  afterEach(() => {
    keys.forEach((key) => {
      globals[key] = saved[key];
    });
  });

  const createVideoWidget = () =>
    new TemplateWidget({ getMedia: async (url: string) => url } as any, {
      widget: {
        name: 'video',
        template: {
          type: 'video',
          name: 'video',
          opts: { url: 'https://example.com/clip.mp4' },
        },
      } as any,
      config: { options: {}, data: {} } as any,
      globals: { target: 'poster' },
    });

  it('waits for the first render to be ready when shown again meanwhile', async () => {
    const widget = createVideoWidget();
    const el = dom.window.document.getElementById('root');
    const events: string[] = [];

    widget.show(el, 0).subscribe(() => events.push('first'));
    await flush();
    widget.show(el, 0).subscribe(() => events.push('second'));
    await flush();

    const videos = el.querySelectorAll('video');
    expect(videos.length).to.equal(1);
    // The video has no metadata yet, so its duration is still the default.
    expect(events).to.deep.equal([]);
    expect(widget.duration()).to.equal(10000);

    const video = videos[0];
    Object.defineProperty(video, 'duration', { value: 13.967 });
    Object.defineProperty(video, 'readyState', { value: 4 });
    video.dispatchEvent(new dom.window.Event('loadedmetadata'));
    video.dispatchEvent(new dom.window.Event('canplaythrough'));
    await flush();

    expect(events).to.deep.equal(['first', 'second']);
    expect(widget.duration()).to.equal(13967);

    // Once ready, later shows complete immediately.
    expect(await firstValueFrom(widget.show(el, 0))).to.equal(
      'template-widget:shown'
    );
  });
});
