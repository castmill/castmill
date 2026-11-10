import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import { I18nProvider } from '../../i18n';
import {
  AutomationsService,
  ClockConfig,
} from '../../services/automations.service';
import {
  ClockEditor,
  PREVIEW_COUNT,
  PREVIEW_DEBOUNCE_MS,
} from './sources/clock-editor';
import {
  browserTimeZone,
  defaultClockConfig,
  validateClock,
} from './sources/clock-logic';

vi.mock('../../services/automations.service', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../services/automations.service')>();
  return { ...actual, AutomationsService: { preview: vi.fn() } };
});
vi.mock('../../components/auth', () => ({ authFetch: vi.fn() }));

let current: () => ClockConfig;

const renderEditor = (initial: ClockConfig = defaultClockConfig()) => {
  const [config, setConfig] = createSignal<ClockConfig>(initial);
  current = config;
  render(() => (
    <I18nProvider>
      <ClockEditor
        config={config()}
        onChange={setConfig}
        organizationId="org-1"
        errors={validateClock(config())}
      />
    </I18nProvider>
  ));
};

const flushPreview = async () => {
  await vi.advanceTimersByTimeAsync(PREVIEW_DEBOUNCE_MS);
};

const radio = (name: string) => screen.getByRole('radio', { name });

describe('ClockEditor', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(AutomationsService.preview).mockResolvedValue({
      timezone: 'UTC',
      occurrences: ['2026-01-05T08:08:00Z', '2026-01-05T09:08:00Z'],
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('debounces the live preview and lists the next firings', async () => {
    renderEditor();
    await vi.advanceTimersByTimeAsync(PREVIEW_DEBOUNCE_MS - 1);
    expect(AutomationsService.preview).not.toHaveBeenCalled();

    const minute = screen.getByLabelText('Minute past the hour');
    fireEvent.input(minute, { target: { value: '7' } });
    fireEvent.input(minute, { target: { value: '8' } });
    await vi.advanceTimersByTimeAsync(PREVIEW_DEBOUNCE_MS - 1);
    expect(AutomationsService.preview).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);

    expect(AutomationsService.preview).toHaveBeenCalledTimes(1);
    expect(AutomationsService.preview).toHaveBeenCalledWith('org-1', {
      when: {
        source: 'clock',
        condition: 'at',
        config: {
          ...defaultClockConfig(),
          schedule: { type: 'hourly', minute: 8 },
        },
      },
      timezone: browserTimeZone(),
      count: PREVIEW_COUNT,
    });

    const preview = screen.getByTestId('clock-preview');
    expect(preview.querySelectorAll('li')).toHaveLength(2);
    expect(preview).toHaveTextContent(
      `Each display uses its own time zone; shown here in ${browserTimeZone()}.`
    );
  });

  it('switches between schedule types', async () => {
    renderEditor();
    expect(radio('Hourly')).toHaveAttribute('aria-checked', 'true');

    fireEvent.click(radio('Every N minutes'));
    expect(current().schedule).toEqual({ type: 'interval', every_minutes: 15 });
    const every = screen.getByLabelText(/Every \(minutes\)/);
    fireEvent.input(every, { target: { value: '4' } });
    expect(
      screen.getByText(
        'The interval must be a whole number of minutes between 5 and 1440.'
      )
    ).toBeInTheDocument();
    fireEvent.input(every, { target: { value: '' } });
    expect(current().schedule).toEqual({
      type: 'interval',
      every_minutes: NaN,
    });

    fireEvent.click(radio('At times'));
    expect(current().schedule).toEqual({ type: 'times', times: ['08:00'] });
    expect(
      screen.getByRole('button', { name: 'Remove time 08:00' })
    ).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /Add time/ }));
    expect(current().schedule).toEqual({
      type: 'times',
      times: ['08:00', '09:00'],
    });
    fireEvent.input(screen.getByLabelText('Time 2'), {
      target: { value: '17:55' },
    });
    expect(current().schedule).toEqual({
      type: 'times',
      times: ['08:00', '17:55'],
    });
    fireEvent.click(screen.getByRole('button', { name: 'Remove time 08:00' }));
    expect(current().schedule).toEqual({ type: 'times', times: ['17:55'] });

    fireEvent.click(radio('Once'));
    expect(current().schedule.type).toBe('once');
    expect(screen.queryByText('Days of the week')).not.toBeInTheDocument();
    fireEvent.input(screen.getByLabelText('Date'), {
      target: { value: '2030-12-24' },
    });
    fireEvent.input(screen.getByLabelText('Time'), {
      target: { value: '17:55' },
    });
    expect(current().schedule).toEqual({
      type: 'once',
      date: '2030-12-24',
      time: '17:55',
    });

    // Re-selecting the active type keeps the config.
    fireEvent.click(radio('Once'));
    expect(current().schedule).toEqual({
      type: 'once',
      date: '2030-12-24',
      time: '17:55',
    });
  });

  it('supports arrow keys in the schedule selector', () => {
    renderEditor();
    fireEvent.keyDown(radio('Hourly'), { key: 'ArrowRight' });
    expect(current().schedule.type).toBe('interval');
    expect(radio('Every N minutes')).toHaveFocus();
    fireEvent.keyDown(radio('Every N minutes'), { key: 'ArrowLeft' });
    fireEvent.keyDown(radio('Hourly'), { key: 'ArrowUp' });
    expect(current().schedule.type).toBe('once');
    fireEvent.keyDown(radio('Once'), { key: 'Enter' });
    expect(current().schedule.type).toBe('once');
  });

  it('edits weekdays, window, dates and time zone', async () => {
    renderEditor();
    const monday = screen.getByRole('button', { name: 'Mon' });
    expect(monday).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(monday);
    expect(current().weekdays).toEqual([2, 3, 4, 5, 6, 7]);
    expect(monday).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(monday);
    expect(current().weekdays).toBeNull();

    fireEvent.click(screen.getByLabelText('Only during a daily time window'));
    expect(current().window).toEqual({ start: '08:00', end: '18:00' });
    fireEvent.input(screen.getByLabelText('From'), {
      target: { value: '19:00' },
    });
    expect(
      screen.getByText('The daily window must start before it ends.')
    ).toBeInTheDocument();
    fireEvent.input(screen.getByLabelText('To'), {
      target: { value: '20:00' },
    });
    expect(current().window).toEqual({ start: '19:00', end: '20:00' });
    fireEvent.click(screen.getByLabelText('Only during a daily time window'));
    expect(current().window).toBeNull();

    fireEvent.click(screen.getByLabelText('Only within a date range'));
    expect(current().dates?.start).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    fireEvent.input(screen.getByLabelText('Start date'), {
      target: { value: '2030-01-01' },
    });
    fireEvent.input(screen.getByLabelText('End date'), {
      target: { value: '2030-01-31' },
    });
    expect(current().dates).toEqual({ start: '2030-01-01', end: '2030-01-31' });
    fireEvent.input(screen.getByLabelText('End date'), {
      target: { value: '' },
    });
    expect(current().dates).toEqual({ start: '2030-01-01', end: null });
    fireEvent.input(screen.getByLabelText('Start date'), {
      target: { value: '' },
    });
    fireEvent.click(screen.getByLabelText('Only within a date range'));
    expect(current().dates).toBeNull();

    fireEvent.input(screen.getByLabelText(/^Time zone/), {
      target: { value: ' Europe/Stockholm ' },
    });
    expect(current().timezone).toBe('Europe/Stockholm');
    await flushPreview();
    expect(AutomationsService.preview).toHaveBeenLastCalledWith(
      'org-1',
      expect.objectContaining({ timezone: 'Europe/Stockholm' })
    );
    expect(screen.getByText('Shown in Europe/Stockholm.')).toBeInTheDocument();

    fireEvent.input(screen.getByLabelText(/^Time zone/), {
      target: { value: '' },
    });
    expect(current().timezone).toBeNull();
  });

  it('does not preview invalid configs', async () => {
    renderEditor({ ...defaultClockConfig(), weekdays: [] });
    await flushPreview();
    expect(AutomationsService.preview).not.toHaveBeenCalled();
    expect(
      screen.getByText('Select at least one weekday.')
    ).toBeInTheDocument();
  });

  it('shows empty and failed previews', async () => {
    vi.mocked(AutomationsService.preview).mockResolvedValueOnce({
      timezone: 'UTC',
      occurrences: [],
    });
    renderEditor();
    await flushPreview();
    expect(
      screen.getByText('This schedule never fires in the coming days.')
    ).toBeInTheDocument();

    vi.mocked(AutomationsService.preview).mockRejectedValueOnce(
      new Error('boom')
    );
    fireEvent.input(screen.getByLabelText('Minute past the hour'), {
      target: { value: '5' },
    });
    await flushPreview();
    expect(
      screen.getByText('Could not calculate the next firings.')
    ).toBeInTheDocument();
  });

  it('ignores stale preview responses', async () => {
    let resolveFirst!: (value: {
      timezone: string;
      occurrences: string[];
    }) => void;
    vi.mocked(AutomationsService.preview)
      .mockImplementationOnce(
        () => new Promise((resolve) => (resolveFirst = resolve))
      )
      .mockResolvedValueOnce({
        timezone: 'UTC',
        occurrences: ['2026-01-05T08:05:00Z'],
      });
    renderEditor();
    await flushPreview();
    fireEvent.input(screen.getByLabelText('Minute past the hour'), {
      target: { value: '5' },
    });
    await flushPreview();
    resolveFirst({
      timezone: 'UTC',
      occurrences: ['a', 'b', 'c'].map(() => '2026-01-05T08:00:00Z'),
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(
      screen.getByTestId('clock-preview').querySelectorAll('li')
    ).toHaveLength(1);
  });
});
