import { describe, expect, it } from 'vitest';
import { render, screen } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import { SaveBar } from './save-bar';

describe('SaveBar', () => {
  it('announces unsaved changes only while dirty', () => {
    const [dirty, setDirty] = createSignal(false);
    render(() => (
      <SaveBar dirty={dirty()} dirtyLabel="Unsaved changes" data-testid="bar">
        <button>Save</button>
      </SaveBar>
    ));

    const status = screen.getByTestId('bar').querySelector('[aria-live]')!;
    expect(status.textContent).toBe('');
    expect(screen.getByText('Save')).toBeInTheDocument();

    setDirty(true);
    expect(status.textContent).toBe('Unsaved changes');
  });
});
