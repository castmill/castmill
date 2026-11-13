import { describe, expect, it } from 'vitest';
import { resolve } from 'node:path';
import { compile } from 'sass';

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Declarations of the first compiled rule matching `prefix` + selector. */
const declarations = (css: string, prefix: string, selector: string) => {
  const match = new RegExp(
    `${prefix}[^{}]*${escape(selector)}\\s*\\{([^}]*)\\}`
  ).exec(css);
  return match?.[1].replace(/\s+/g, ' ').trim();
};

describe('tree tag buttons on touch screens', () => {
  it.each([
    ['devices/components/devices.scss', '.device-tree-tag-btn'],
    ['medias/components/medias.scss', '.media-tree-tag-btn'],
    ['playlists/components/playlists.scss', '.playlist-tree-tag-btn'],
  ])('%s keeps %s visible, tap-sized and focusable', (file, button) => {
    const css = compile(resolve(__dirname, file)).css;

    expect(
      declarations(
        css,
        escape('@media (hover: none), (pointer: coarse) {'),
        button
      )
    ).toBe('opacity: 1; width: 2.75em; height: 2.75em;');
    expect(declarations(css, '', `${button}:focus-visible`)).toBe(
      'opacity: 1;'
    );
  });
});
