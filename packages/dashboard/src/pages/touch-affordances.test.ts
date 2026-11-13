import { describe, expect, it } from 'vitest';
import { resolve } from 'node:path';
import { compile } from 'sass';

/** Rules of a compiled stylesheet, keyed by "<media>|<selector>". */
const compiledRules = (file: string) => {
  const style = document.createElement('style');
  style.textContent = compile(resolve(__dirname, file)).css;
  document.head.appendChild(style);
  const rules = new Map<string, CSSStyleDeclaration>();
  const collect = (list: CSSRuleList, media: string) =>
    Array.from(list).forEach((rule) => {
      if (rule instanceof CSSMediaRule) {
        collect(rule.cssRules, rule.media.mediaText);
      } else if (rule instanceof CSSStyleRule) {
        rule.selectorText
          .split(',')
          .forEach((selector) =>
            rules.set(`${media}|${selector.trim()}`, rule.style)
          );
      }
    });
  collect(style.sheet!.cssRules, '');
  style.remove();
  return rules;
};

const TOUCH = '(hover: none), (pointer: coarse)';

describe('hover-only affordances have touch and focus equivalents', () => {
  it('keeps channel tree tag buttons visible and tap-sized on touch', () => {
    const rules = compiledRules('channels-page/channels-page.scss');
    const touch = rules.get(`${TOUCH}|.channel-tree-tag-btn`);
    expect(touch?.getPropertyValue('opacity')).toBe('1');
    expect(touch?.getPropertyValue('width')).toBe('2.75em');
    expect(touch?.getPropertyValue('height')).toBe('2.75em');
    expect(
      rules.get('|.channel-tree-tag-btn:focus-visible')?.getPropertyValue(
        'opacity'
      )
    ).toBe('1');
  });

  it('reveals tag actions on focus and always on touch', () => {
    const rules = compiledRules('tags-page/tags-page.module.scss');
    expect(
      rules.get('|.tag-item:focus-within .tag-actions')?.getPropertyValue(
        'opacity'
      )
    ).toBe('1');
    const touch = rules.get(`${TOUCH}|.tag-actions`);
    expect(touch?.getPropertyValue('opacity')).toBe('1');
    expect(touch?.getPropertyValue('pointer-events')).toBe('auto');
    expect(touch?.getPropertyValue('max-width')).toBe('none');
  });
});
