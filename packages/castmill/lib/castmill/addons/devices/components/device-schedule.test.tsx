import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@solidjs/testing-library';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Device } from '../interfaces/device.interface';
import { DevicesService } from '../services/devices.service';
import { DeviceSchedule, getScheduleNow } from './device-schedule';

// jsdom's MouseEvent drops PointerEvent fields, so expose them for fireEvent.
if (!('pointerType' in MouseEvent.prototype)) {
  class TestPointerEvent extends MouseEvent {
    pointerId: number;
    pointerType: string;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 0;
      this.pointerType = init.pointerType ?? '';
    }
  }
  vi.stubGlobal('PointerEvent', TestPointerEvent);
}

vi.mock('@castmill/ui-common', () => ({
  Button: (props: {
    label: string;
    disabled?: boolean;
    onClick?: () => void;
  }) => (
    <button disabled={props.disabled} onClick={props.onClick}>
      {props.label}
    </button>
  ),
  useToast: () => ({ error: vi.fn(), success: vi.fn() }),
}));

vi.mock('../services/devices.service', () => ({
  DevicesService: {
    getDeviceSchedule: vi.fn(),
  },
}));

const device: Device = {
  id: 'device-1',
  name: 'Player',
  description: '',
  online: true,
  last_online: new Date(),
  location: '',
  city: '',
  country: '',
  last_ip: '',
  inserted_at: new Date(),
  updated_at: new Date(),
  log_level: 'info',
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('getScheduleNow', () => {
  it('uses the device time zone, including across midnight', () => {
    // Sunday 23:30 UTC is Monday 00:30 in Stockholm (CET, UTC+1)
    const date = new Date('2026-10-25T23:30:00Z');
    expect(getScheduleNow('UTC', date)).toEqual({ day: 6, minutes: 1410 });
    expect(getScheduleNow('Europe/Stockholm', date)).toEqual({
      day: 0,
      minutes: 30,
    });
  });

  it('falls back to the browser clock for missing or unknown zones', () => {
    const date = new Date(2026, 9, 14, 9, 5); // Wednesday, local time
    const local = { day: 2, minutes: 9 * 60 + 5 };
    expect(getScheduleNow(undefined, date)).toEqual(local);
    expect(getScheduleNow('Not/AZone', date)).toEqual(local);
  });
});

describe('DeviceSchedule current time', () => {
  it('highlights the current day and draws the current time line', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    vi.setSystemTime(new Date('2026-10-14T10:30:00Z')); // Wednesday
    const { container } = await renderSchedule([], { timezone: 'UTC' });

    const headers = container.querySelectorAll('.schedule-grid-day-header');
    expect(headers[2]).toHaveClass('today');
    expect(headers[2]).toHaveAttribute('aria-current', 'date');
    expect(
      container.querySelectorAll('.schedule-grid-day-header.today')
    ).toHaveLength(1);
    expect(
      container.querySelectorAll('.schedule-grid-cell.today')
    ).toHaveLength(24);

    const line = container.querySelector<HTMLElement>('.schedule-now-line')!;
    expect(line.style.top).toBe(`${10.5 * 20 + HEADER_HEIGHT}px`);
    const marker = line.querySelector<HTMLElement>('.schedule-now-marker')!;
    expect(parseFloat(marker.style.left)).toBeCloseTo(200 / 7, 3);

    // The line and highlight follow the clock past midnight
    vi.setSystemTime(new Date('2026-10-15T00:15:00Z'));
    vi.advanceTimersByTime(30_000);
    expect(headers[3]).toHaveClass('today');
    expect(headers[2]).not.toHaveClass('today');
    expect(line.style.top).toBe(`${0.25 * 20 + HEADER_HEIGHT}px`);
  });
});

const renderSchedule = async (
  entries: Array<{ startHour: number; endHour: number; days: number[] }> = [],
  deviceOverrides: Partial<Device> = {}
) => {
  vi.mocked(DevicesService.getDeviceSchedule).mockResolvedValue({ entries });
  const result = render(() => (
    <DeviceSchedule baseUrl="/api" device={{ ...device, ...deviceOverrides }} />
  ));
  await waitFor(() =>
    expect(result.container.querySelectorAll('.schedule-entry')).toHaveLength(
      entries.length
    )
  );
  return result;
};

const GRID_LEFT = 10;
const GRID_TOP = 10;
const TIME_LABEL_WIDTH = 56;
const HEADER_HEIGHT = 20;

/** jsdom has no layout, so give the grid deterministic measurements */
const mockGeometry = (container: HTMLElement, width: number) => {
  const wrapper = container.querySelector<HTMLElement>(
    '.schedule-grid-wrapper'
  )!;
  Object.defineProperties(wrapper, {
    clientWidth: { value: width },
    clientLeft: { value: 1 },
    clientTop: { value: 1 },
  });
  Object.defineProperty(
    container.querySelector('.schedule-grid-time-label'),
    'offsetWidth',
    { value: TIME_LABEL_WIDTH }
  );
  Object.defineProperty(
    container.querySelector('.schedule-grid-day-header'),
    'offsetHeight',
    { value: HEADER_HEIGHT }
  );
  vi.spyOn(wrapper, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(GRID_LEFT, GRID_TOP, width + 2, 402)
  );
  const dayWidth = (width - TIME_LABEL_WIDTH) / 7;
  return {
    wrapper,
    dayWidth,
    cellX: (day: number) =>
      GRID_LEFT + 1 + TIME_LABEL_WIDTH + (day + 0.5) * dayWidth,
  };
};

const cellY = (hour: number) => GRID_TOP + 1 + HEADER_HEIGHT + hour * 20 + 1;

const mouse = {
  down: (target: Element, clientX: number, clientY: number) =>
    fireEvent.pointerDown(target, {
      pointerType: 'mouse',
      pointerId: 1,
      button: 0,
      clientX,
      clientY,
    }),
  move: (clientX: number, clientY: number) =>
    fireEvent.pointerMove(document, {
      pointerType: 'mouse',
      pointerId: 1,
      clientX,
      clientY,
    }),
  up: () =>
    fireEvent.pointerUp(document, { pointerType: 'mouse', pointerId: 1 }),
};

const touch = {
  tap: (target: Element, clientX: number, clientY: number) => {
    const init = { pointerType: 'touch', pointerId: 7, clientX, clientY };
    fireEvent.pointerDown(target, init);
    fireEvent.pointerUp(document, init);
  },
};

const editorPanel = () => document.querySelector('.schedule-editor');
const editorTitle = () => document.querySelector('.schedule-editor-title');
const field = (label: string) =>
  screen.getByLabelText(label) as HTMLInputElement | HTMLSelectElement;

describe('DeviceSchedule responsive positioning', () => {
  it('positions loaded slots relative to the day area instead of a measured pixel width', async () => {
    vi.mocked(DevicesService.getDeviceSchedule).mockResolvedValue({
      entries: [
        {
          startHour: 8,
          startMinute: 30,
          endHour: 10,
          endMinute: 0,
          days: [0, 1, 2, 3, 4, 5, 6],
        },
        {
          startHour: 12,
          startMinute: 0,
          endHour: 13,
          endMinute: 0,
          days: [6],
        },
      ],
    });

    const { container } = render(() => (
      <DeviceSchedule baseUrl="/api" device={device} />
    ));
    await waitFor(() =>
      expect(container.querySelectorAll('.schedule-entry')).toHaveLength(2)
    );

    const entries = container.querySelectorAll<HTMLElement>('.schedule-entry');
    expect(entries[0].style.left).toBe('calc(0% + 1px)');
    expect(entries[0].style.width).toBe('calc(100% - 2px)');
    expect(entries[0].style.top).toBe('170px');
    expect(entries[0].style.height).toBe('29px');
    expect(entries[1].style.left).toMatch(/^calc\([\d.]+% \+ 1px\)$/);
    expect(parseFloat(entries[1].style.left.slice(5))).toBeCloseTo(600 / 7, 3);
    expect(entries[1].style.width).toMatch(/^calc\([\d.]+% - 2px\)$/);
    expect(parseFloat(entries[1].style.width.slice(5))).toBeCloseTo(100 / 7, 3);
  });

  it.each([280, 720])(
    'aligns creation hit testing and preview with the inner grid at %spx',
    async (width) => {
      const { container } = await renderSchedule();
      const grid = mockGeometry(container, width);
      const clientY = cellY(8);
      // Just inside Tuesday's left edge, accounting for the wrapper border.
      mouse.down(
        grid.wrapper,
        grid.cellX(1) - grid.dayWidth / 2 + 0.1,
        clientY
      );
      mouse.move(grid.cellX(6) + grid.dayWidth / 2 - 0.1, clientY);

      const preview = container.querySelector<HTMLElement>(
        '.schedule-drag-preview'
      )!;
      expect(preview.style.left).toMatch(/^calc\([\d.]+% \+ 1px\)$/);
      expect(parseFloat(preview.style.left.slice(5))).toBeCloseTo(100 / 7, 3);
      expect(preview.style.width).toMatch(/^calc\([\d.]+% - 2px\)$/);
      expect(parseFloat(preview.style.width.slice(5))).toBeCloseTo(600 / 7, 3);
      expect(preview.style.top).toBe('180px');

      mouse.up();
      const entry = container.querySelector<HTMLElement>('.schedule-entry')!;
      expect(entry.style.left).toBe(preview.style.left);
      expect(entry.style.width).toBe(preview.style.width);
      expect(entry.style.top).toBe(preview.style.top);
      // Wide screens keep drag-to-resize, so creation does not open the editor
      expect(editorPanel()).not.toBeInTheDocument();
    }
  );
});

describe('DeviceSchedule slot editor', () => {
  it('creates a slot with a touch tap and opens the editor directly', async () => {
    const { container } = await renderSchedule();
    const grid = mockGeometry(container, 320);

    touch.tap(grid.wrapper, grid.cellX(2), cellY(9));

    expect(editorTitle()).toHaveTextContent('deviceSchedule.editor.newTitle');
    expect(field('deviceSchedule.editor.startDay')).toHaveValue('2');
    expect(field('deviceSchedule.editor.endDay')).toHaveValue('2');
    expect(field('deviceSchedule.editor.startTime')).toHaveValue('09:00');
    expect(field('deviceSchedule.editor.endTime')).toHaveValue('10:00');
    expect(container.querySelectorAll('.schedule-entry')).toHaveLength(1);

    fireEvent.change(field('deviceSchedule.editor.endDay'), {
      target: { value: '4' },
    });
    fireEvent.input(field('deviceSchedule.editor.startTime'), {
      target: { value: '07:30' },
    });
    fireEvent.input(field('deviceSchedule.editor.endTime'), {
      target: { value: '00:00' },
    });
    fireEvent.click(screen.getByText('deviceSchedule.editor.done'));

    expect(editorPanel()).not.toBeInTheDocument();
    expect(screen.getByText(/deviceSchedule\.onLabel/)).toHaveTextContent(
      'deviceSchedule.onLabel: deviceSchedule.wed–deviceSchedule.fri 07:30–24:00'
    );
  });

  it('discards an unconfirmed tapped slot on cancel and ignores scroll gestures', async () => {
    const { container } = await renderSchedule();
    const grid = mockGeometry(container, 320);

    touch.tap(grid.wrapper, grid.cellX(0), cellY(3));
    fireEvent.click(screen.getByText('common.cancel'));
    expect(editorPanel()).not.toBeInTheDocument();
    expect(container.querySelector('.schedule-entry')).not.toBeInTheDocument();

    fireEvent.pointerDown(grid.wrapper, {
      pointerType: 'touch',
      pointerId: 2,
      clientX: grid.cellX(0),
      clientY: cellY(3),
    });
    fireEvent.pointerMove(document, {
      pointerType: 'touch',
      pointerId: 2,
      clientX: grid.cellX(0),
      clientY: cellY(5),
    });
    fireEvent.pointerUp(document, {
      pointerType: 'touch',
      pointerId: 2,
      clientX: grid.cellX(0),
      clientY: cellY(5),
    });
    fireEvent.pointerDown(grid.wrapper, {
      pointerType: 'touch',
      pointerId: 3,
      clientX: grid.cellX(0),
      clientY: cellY(3),
    });
    fireEvent.pointerCancel(document, { pointerType: 'touch', pointerId: 3 });
    fireEvent.pointerUp(document, {
      pointerType: 'touch',
      pointerId: 3,
      clientX: grid.cellX(0),
      clientY: cellY(3),
    });
    expect(container.querySelector('.schedule-entry')).not.toBeInTheDocument();
    expect(editorPanel()).not.toBeInTheDocument();
  });

  it('opens the editor when a slot is clicked without dragging and validates changes', async () => {
    const { container } = await renderSchedule([
      { startHour: 8, endHour: 10, days: [0, 1] },
      { startHour: 12, endHour: 14, days: [0] },
    ]);
    const grid = mockGeometry(container, 720);
    const slot = container.querySelector<HTMLElement>('.schedule-entry')!;

    mouse.down(slot, grid.cellX(0), cellY(8));
    mouse.up();

    expect(editorTitle()).toHaveTextContent('deviceSchedule.editor.title');
    expect(slot).toHaveAttribute('aria-pressed', 'true');
    expect(field('deviceSchedule.editor.endDay')).toHaveValue('1');

    fireEvent.input(field('deviceSchedule.editor.endTime'), {
      target: { value: '' },
    });
    fireEvent.click(screen.getByText('deviceSchedule.editor.done'));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'deviceSchedule.editor.invalidTime'
    );

    fireEvent.input(field('deviceSchedule.editor.endTime'), {
      target: { value: '13:00' },
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('deviceSchedule.editor.done'));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'deviceSchedule.editor.overlap'
    );

    // Cancelling an existing slot keeps it unchanged
    fireEvent.click(screen.getByText('common.cancel'));
    expect(container.querySelectorAll('.schedule-entry')).toHaveLength(2);
    expect(container.querySelector('.schedule-entry')!.textContent).toContain(
      '08:00–10:00'
    );
  });

  it('keeps start and end days ordered and deletes from the editor', async () => {
    const { container } = await renderSchedule([
      { startHour: 8, endHour: 10, days: [1, 2] },
    ]);
    const slot = container.querySelector<HTMLElement>('.schedule-entry')!;
    fireEvent.keyDown(slot, { key: 'Enter' });

    const endDay = field('deviceSchedule.editor.endDay');
    expect(endDay.querySelector('option[value="0"]')).toBeDisabled();
    fireEvent.change(field('deviceSchedule.editor.startDay'), {
      target: { value: '5' },
    });
    expect(endDay).toHaveValue('5');

    fireEvent.click(screen.getByText('deviceSchedule.delete'));
    expect(editorPanel()).not.toBeInTheDocument();
    expect(container.querySelector('.schedule-entry')).not.toBeInTheDocument();
  });

  it('starts dragging instead of editing when a slot is moved with a mouse', async () => {
    const { container } = await renderSchedule([
      { startHour: 8, endHour: 10, days: [0] },
    ]);
    const grid = mockGeometry(container, 720);
    const slot = container.querySelector<HTMLElement>('.schedule-entry')!;

    mouse.down(slot, grid.cellX(0), cellY(8));
    mouse.move(grid.cellX(1), cellY(8));
    mouse.up();

    expect(editorPanel()).not.toBeInTheDocument();
    const moved = container.querySelector<HTMLElement>('.schedule-entry')!;
    expect(moved.textContent).toContain('08:00–10:00');
    expect(parseFloat(moved.style.left.slice(5))).toBeCloseTo(100 / 7, 3);
  });

  it('previews editor changes in the schedule until they are applied or cancelled', async () => {
    const { container } = await renderSchedule([
      { startHour: 8, endHour: 10, days: [0] },
      { startHour: 12, endHour: 14, days: [0] },
    ]);
    mockGeometry(container, 720);
    const firstSlot = () =>
      container.querySelectorAll<HTMLElement>('.schedule-entry')[0];
    fireEvent.keyDown(firstSlot(), { key: 'Enter' });

    fireEvent.change(field('deviceSchedule.editor.endDay'), {
      target: { value: '2' },
    });
    fireEvent.input(field('deviceSchedule.editor.startTime'), {
      target: { value: '09:00' },
    });
    expect(firstSlot()).toHaveClass('previewing');
    expect(firstSlot()).not.toHaveClass('conflict');
    expect(firstSlot().textContent).toContain('09:00–10:00');
    expect(firstSlot().style.top).toBe(`${9 * 20 + HEADER_HEIGHT}px`);
    expect(parseFloat(firstSlot().style.width.slice(5))).toBeCloseTo(
      300 / 7,
      3
    );

    fireEvent.input(field('deviceSchedule.editor.endTime'), {
      target: { value: '13:00' },
    });
    expect(firstSlot()).toHaveClass('conflict');

    // Incomplete drafts fall back to the stored slot
    fireEvent.input(field('deviceSchedule.editor.endTime'), {
      target: { value: '' },
    });
    expect(firstSlot()).not.toHaveClass('previewing');
    expect(firstSlot().textContent).toContain('08:00–10:00');

    fireEvent.click(screen.getByText('common.cancel'));
    expect(firstSlot()).not.toHaveClass('previewing');
    expect(firstSlot().textContent).toContain('08:00–10:00');
    expect(firstSlot().style.top).toBe(`${8 * 20 + HEADER_HEIGHT}px`);
    expect(screen.getByText('common.save')).toBeDisabled();
  });

  it('drags the previewed slot and restores the original on cancel', async () => {
    const { container } = await renderSchedule([
      { startHour: 8, endHour: 10, days: [0] },
    ]);
    const grid = mockGeometry(container, 720);
    const slot = () => container.querySelector<HTMLElement>('.schedule-entry')!;
    fireEvent.keyDown(slot(), { key: 'Enter' });
    fireEvent.input(field('deviceSchedule.editor.startTime'), {
      target: { value: '09:00' },
    });

    mouse.down(slot(), grid.cellX(0), cellY(9));
    mouse.move(grid.cellX(1), cellY(9));
    mouse.up();

    expect(slot().textContent).toContain('09:00–10:00');
    expect(parseFloat(slot().style.left.slice(5))).toBeCloseTo(100 / 7, 3);
    expect(field('deviceSchedule.editor.startDay')).toHaveValue('1');
    expect(field('deviceSchedule.editor.startTime')).toHaveValue('09:00');

    fireEvent.click(screen.getByText('common.cancel'));
    expect(slot().textContent).toContain('08:00–10:00');
    expect(parseFloat(slot().style.left.slice(5))).toBeCloseTo(0, 3);
  });

  it('never lets the start time pass the end time', async () => {
    const { container } = await renderSchedule([
      { startHour: 8, endHour: 10, days: [0] },
    ]);
    fireEvent.keyDown(container.querySelector('.schedule-entry')!, {
      key: 'Enter',
    });
    const start = field('deviceSchedule.editor.startTime');
    const end = field('deviceSchedule.editor.endTime');

    // Moving the start before the end leaves the end alone
    fireEvent.input(start, { target: { value: '09:00' } });
    expect(end).toHaveValue('10:00');

    // Moving the start past the end pushes the end, keeping the duration
    fireEvent.input(start, { target: { value: '12:30' } });
    expect(end).toHaveValue('13:30');

    // ...capped at midnight
    fireEvent.input(start, { target: { value: '23:45' } });
    expect(end).toHaveValue('00:00');

    // Moving the end before the start pulls the start back
    fireEvent.input(start, { target: { value: '12:00' } });
    fireEvent.input(end, { target: { value: '13:00' } });
    fireEvent.input(end, { target: { value: '11:00' } });
    expect(start).toHaveValue('10:00');

    fireEvent.input(end, { target: { value: '00:30' } });
    expect(start).toHaveValue('00:00');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('deviceSchedule.editor.done'));
    expect(container.querySelector('.schedule-entry')!.textContent).toContain(
      '00:00–00:30'
    );
  });

  it('opens the editor after drag-creating a slot on a compact screen', async () => {
    vi.spyOn(window, 'matchMedia').mockImplementation(
      (query: string) => ({ matches: true, media: query }) as MediaQueryList
    );
    const { container } = await renderSchedule();
    const grid = mockGeometry(container, 360);

    mouse.down(grid.wrapper, grid.cellX(3), cellY(14));
    mouse.move(grid.cellX(3), cellY(16));
    mouse.up();

    expect(editorTitle()).toHaveTextContent('deviceSchedule.editor.newTitle');
    expect(field('deviceSchedule.editor.startTime')).toHaveValue('14:00');
    expect(field('deviceSchedule.editor.endTime')).toHaveValue('17:00');
  });
});
