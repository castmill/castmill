import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@solidjs/testing-library';
import type { TableCardLabels } from '@castmill/ui-common';
import { I18nProvider, useI18n } from '../i18n';
import { useTableCardLabels } from './useTableCardLabels';

const resolve = (label: TableCardLabels[keyof TableCardLabels]) =>
  typeof label === 'function' ? label() : label;

function TestComponent() {
  const labels = useTableCardLabels();
  const { setLocale } = useI18n();
  return (
    <div>
      <span data-testid="labels">
        {[
          resolve(labels.sortBy),
          resolve(labels.sortAscending),
          resolve(labels.sortDescending),
          resolve(labels.selectAll),
        ].join('|')}
      </span>
      <button data-testid="es" onClick={() => setLocale('es')} />
    </div>
  );
}

describe('useTableCardLabels', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => cleanup());

  it('returns reactive, localized card layout labels', async () => {
    render(() => (
      <I18nProvider>
        <TestComponent />
      </I18nProvider>
    ));

    expect(screen.getByTestId('labels').textContent).toBe(
      'Sort by|Ascending|Descending|Select all'
    );

    screen.getByTestId('es').click();

    await waitFor(() =>
      expect(screen.getByTestId('labels').textContent).toBe(
        'Ordenar por|Ascendente|Descendente|Seleccionar todo'
      )
    );
  });
});
