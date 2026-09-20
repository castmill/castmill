import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = dirname(fileURLToPath(import.meta.url));
const readStyle = (relativePath: string) =>
  readFileSync(resolve(currentDir, relativePath), 'utf8');

describe('channel detail responsive styles', () => {
  it('stacks channel scheduling controls above the calendar on phone-width screens', () => {
    const styles = readStyle('calendar-view.module.scss');

    expect(styles).toContain('@media (max-width: 48em)');
    expect(styles).toContain('flex-direction: column');
    expect(styles).toContain('overflow-x: auto');
    expect(styles).toContain('min-width: 42em');
  });

  it('wraps channel detail form actions on phone-width screens', () => {
    const styles = readStyle('channel-entry-view.module.scss');

    expect(styles).toContain('@media (max-width: 48em)');
    expect(styles).toContain('flex-wrap: wrap');
  });
});
