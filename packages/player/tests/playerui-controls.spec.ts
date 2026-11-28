import { expect } from 'chai';
import { describe, it } from 'mocha';
// @ts-ignore jsdom is hoisted from other workspaces without type declarations.
import { JSDOM } from 'jsdom';

import { PlayerUIControls } from '../dist/index.js';

const withDom = (fn: () => void) => {
  const g = globalThis as any;
  const keys = ['window', 'document', 'HTMLElement', 'Element', 'Node'];
  const saved = keys.map((key) => g[key]);
  const dom = new JSDOM('<!doctype html><div id="controls"></div>');
  keys.forEach((key) => {
    g[key] = key === 'window' ? dom.window : dom.window[key];
  });
  try {
    fn();
  } finally {
    keys.forEach((key, i) => (g[key] = saved[i]));
  }
};

describe('PlayerUIControls', () => {
  it('keeps the time label width fixed while the time changes', () => {
    withDom(() => {
      const controls = new PlayerUIControls('controls');
      controls.setTimeDuration(0, 754000, true);
      const { time, duration } = controls.elements;

      // "12:34:0" is the longest time label for a 12:34 playlist.
      expect(time.style.minWidth).to.equal('7ch');
      for (const label of [time, duration]) {
        expect(label.style.flexShrink).to.equal('0');
        expect(label.style.whiteSpace).to.equal('nowrap');
      }

      controls.updateTime(1100);
      expect(time.style.minWidth).to.equal('7ch');
      controls.destroy();
    });
  });
});
