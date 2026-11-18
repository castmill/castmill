import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@solidjs/testing-library';
import { I18nProvider } from '../../i18n';
import { CalendarEntryBox } from './calendar-entry-box';
import type { CalendarEntry } from './calendar-entry.interface';

const CELL_WIDTH = 100;
const TIME_COLUMN = 50;

/** Builds a fake 7-day grid laid out left-to-right or right-to-left. */
const buildGrid = (dir: 'ltr' | 'rtl') => {
  const grid = new Map<string, HTMLTableCellElement>();
  for (let day = 0; day < 7; day++) {
    const column = dir === 'ltr' ? day : 6 - day;
    for (let slot = 0; slot < 48; slot++) {
      const cell = document.createElement('td');
      Object.defineProperties(cell, {
        offsetLeft: { value: TIME_COLUMN + column * CELL_WIDTH },
        offsetWidth: { value: CELL_WIDTH },
        offsetTop: { value: slot * 10 },
        offsetHeight: { value: 10 },
      });
      grid.set(`day-${day}-slot-${slot}`, cell);
    }
  }
  return grid;
};

const entry: CalendarEntry = {
  id: 1,
  title: 'Morning',
  playlist: { id: 2, name: 'Morning' },
  startHour: 8,
  startMinute: 0,
  endHour: 10,
  endMinute: 0,
  dayIndex: 1,
  numDays: 3,
  weekly: true,
};

const renderBox = (dir: 'ltr' | 'rtl') => {
  const { container } = render(() => (
    <I18nProvider>
      <div dir={dir}>
        <CalendarEntryBox
          entry={entry}
          cellGrid={buildGrid(dir)}
          onResizeComplete={() => {}}
          onDelete={() => {}}
          onInfo={() => {}}
        />
      </div>
    </I18nProvider>
  ));
  return container.querySelector<HTMLElement>('[style*="position"]')!;
};

describe('CalendarEntryBox positioning', () => {
  afterEach(cleanup);

  it('spans the first to the last day left-to-right', () => {
    const box = renderBox('ltr');
    expect(box.style.left).toBe(`${TIME_COLUMN + CELL_WIDTH}px`);
    expect(box.style.width).toBe(`${3 * CELL_WIDTH}px`);
    expect(box.style.top).toBe('160px');
    expect(box.style.height).toBe('40px');
  });

  it('spans the same days when they run right-to-left', () => {
    const box = renderBox('rtl');
    // Days 1-3 occupy columns 5..3 in RTL.
    expect(box.style.left).toBe(`${TIME_COLUMN + 3 * CELL_WIDTH}px`);
    expect(box.style.width).toBe(`${3 * CELL_WIDTH}px`);
  });
});
