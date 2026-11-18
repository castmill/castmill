import { afterEach, describe, expect, it } from 'vitest';
import { elementEm, widthInEm } from './element-em';

describe('elementEm', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('returns the computed font size', () => {
    const el = document.createElement('div');
    el.style.fontSize = '20px';
    document.body.appendChild(el);
    expect(elementEm(el)).toBe(20);
  });

  it('falls back to 16px without a font size', () => {
    const el = document.createElement('div');
    expect(elementEm(el)).toBe(16);
  });

  it('converts a width to em', () => {
    const el = document.createElement('div');
    el.style.fontSize = '10px';
    document.body.appendChild(el);
    expect(widthInEm(el, 250)).toBe(25);
  });
});
