import { describe, expect, it } from 'vitest';
import { compile } from 'sass';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = dirname(fileURLToPath(import.meta.url));
const mobileStyles = (relativePath: string) => {
  const element = document.createElement('style');
  element.textContent = compile(resolve(currentDir, relativePath)).css;
  document.head.appendChild(element);
  const rules = Array.from(element.sheet!.cssRules);
  element.remove();

  const media = rules.find(
    (rule) =>
      rule.type === CSSRule.MEDIA_RULE &&
      (rule as CSSMediaRule).conditionText === '(max-width: 48em)'
  ) as CSSMediaRule;
  expect(media).toBeDefined();

  return (selector: string) => {
    const rule = Array.from(media.cssRules).find((rule) =>
      (rule as CSSStyleRule).selectorText
        ?.split(',')
        .some((value) => value.trim() === selector)
    ) as CSSStyleRule;
    expect(rule, `Missing mobile selector: ${selector}`).toBeDefined();
    return rule.style;
  };
};

describe('playlist detail responsive styles', () => {
  it('stacks the playlist editor panes on phone-width screens', () => {
    const styles = mobileStyles('playlist-view.scss');

    expect(styles('.playlist-view').getPropertyValue('flex-direction')).toBe(
      'column'
    );
    const items = styles('.playlist-view .playlist-items');
    expect(items.getPropertyValue('max-height')).toBe('20em');
    expect(items.getPropertyValue('-webkit-overflow-scrolling')).toBe('touch');
  });

  it('stretches the details form and wraps its mobile controls', () => {
    const styles = mobileStyles('playlist-details.scss');

    expect(
      styles('.playlist-details form').getPropertyValue('align-items')
    ).toBe('stretch');
    for (const selector of ['.custom-aspect-ratio', '.actions']) {
      expect(
        styles(`.playlist-details form ${selector}`).getPropertyValue(
          'flex-wrap'
        )
      ).toBe('wrap');
    }
  });

  it('compacts playlist items and their sibling duration and action controls', () => {
    const styles = mobileStyles('playlist-item.module.scss');
    const item = '.playlist-item-wrapper .playlist-item';

    expect(styles(item).getPropertyValue('width')).toBe('auto');
    expect(styles(item).getPropertyValue('min-width')).toBe('0');
    expect(
      styles(`${item} .playlist-item-duration`).getPropertyValue('width')
    ).toBe('4.5em');
    expect(
      styles(`${item} .playlist-item-duration`).getPropertyValue('margin-right')
    ).toBe('0');
    expect(
      styles(`${item} .playlist-item-actions`).getPropertyValue('gap')
    ).toBe('0.25em');
  });

  it('uses a vertical widget configuration dialog on phone-width screens', () => {
    const styles = mobileStyles('widget-config.scss');
    const dialog = '.widget-config-dialog';

    expect(styles(dialog).getPropertyValue('height')).toBe('80dvh');
    expect(styles(dialog).getPropertyValue('flex-direction')).toBe('column');
    expect(
      styles(`${dialog} .widget-config`).getPropertyValue('min-height')
    ).toBe('24em');
    expect(
      styles(`${dialog} .widget-config form .form-actions`).getPropertyValue(
        'flex-wrap'
      )
    ).toBe('wrap');
    expect(styles(`${dialog} .preview`).getPropertyValue('width')).toBe('100%');
    expect(styles(`${dialog} .preview`).getPropertyValue('height')).toBe(
      'auto'
    );
  });
});
