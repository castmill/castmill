// Automation rules use the contract's `when`/`then` keys.
/* oxlint-disable unicorn/no-thenable */
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../components/auth', () => ({ authFetch: vi.fn() }));

import type {
  AutomationRule,
  ClockConfig,
  InterruptConfig,
} from '../../services/automations.service';
import {
  clockSummary,
  defaultClockConfig,
  defaultSchedule,
  formatLocalDate,
  formatWeekdays,
  isValidDate,
  isValidTime,
  isValidTimeZone,
  normalizeClock,
  scheduleSummary,
  todayIso,
  validateClock,
  weekdayName,
} from './sources/clock-logic';
import {
  defaultInterruptConfig,
  interruptSummary,
  normalizeInterrupt,
  validateInterrupt,
} from './actions/interrupt-logic';
import {
  availableActions,
  availableSources,
  newRule,
  normalizeRule,
  ruleSummary,
  thenSummary,
  validateRule,
  whenSummary,
} from './registry';
import { referencedPlaylistIds } from './playlist-names';
import { testSummaryContext } from './test-utils';

const ctx = testSummaryContext({ 12: 'Spring offer' });

const clock = (overrides: Partial<ClockConfig> = {}): ClockConfig => ({
  ...defaultClockConfig(),
  ...overrides,
});

const interrupt = (
  overrides: Partial<InterruptConfig> = {}
): InterruptConfig => ({
  ...defaultInterruptConfig(),
  playlist_id: 12,
  ...overrides,
});

describe('clock summaries', () => {
  it('summarizes every schedule type', () => {
    expect(scheduleSummary({ type: 'hourly', minute: 8 }, ctx)).toBe(
      'Every hour at :08'
    );
    expect(scheduleSummary({ type: 'interval', every_minutes: 15 }, ctx)).toBe(
      'Every 15 minutes'
    );
    expect(
      scheduleSummary({ type: 'times', times: ['08:00', '17:55'] }, ctx)
    ).toBe('Every day at 08:00, 17:55');
    expect(
      scheduleSummary({ type: 'once', date: '2026-12-24', time: '17:55' }, ctx)
    ).toBe('Once on Dec 24, 2026 at 17:55');
    expect(scheduleSummary({ type: 'nope' } as never, ctx)).toBe(
      'Unknown schedule'
    );
  });

  it('formats weekday ranges compactly', () => {
    expect(formatWeekdays([1, 2, 3, 4, 5], 'en-US')).toBe('Mon–Fri');
    expect(formatWeekdays([1, 3, 5], 'en-US')).toBe('Mon, Wed, Fri');
    expect(formatWeekdays([6, 7], 'en-US')).toBe('Sat, Sun');
    expect(formatWeekdays([1, 2, 3, 5, 6, 7], 'en-US')).toBe(
      'Mon–Wed, Fri–Sun'
    );
    expect(formatWeekdays([3, 1, 2, 2], 'en-US')).toBe('Mon–Wed');
    expect(formatWeekdays([1, 2, 3, 4, 5, 6, 7], 'en-US')).toBeNull();
    expect(formatWeekdays([], 'en-US')).toBeNull();
    expect(formatWeekdays(null, 'en-US')).toBeNull();
    expect(weekdayName(7, 'en-US')).toBe('Sun');
  });

  it('builds the full plain-language summary', () => {
    expect(
      clockSummary(
        clock({
          schedule: { type: 'hourly', minute: 8 },
          weekdays: [1, 2, 3, 4, 5],
          window: { start: '08:00', end: '18:00' },
        }),
        ctx
      )
    ).toBe('Every hour at :08 · Mon–Fri · 08:00–18:00');

    expect(
      clockSummary(
        clock({
          dates: { start: '2026-01-01', end: '2026-01-31' },
          timezone: 'Europe/Stockholm',
        }),
        ctx
      )
    ).toBe(
      'Every hour at :00 · from Jan 1, 2026 to Jan 31, 2026 · Europe/Stockholm'
    );
    expect(
      clockSummary(clock({ dates: { start: '2026-01-01', end: null } }), ctx)
    ).toContain('starting Jan 1, 2026');
    expect(
      clockSummary(clock({ dates: { start: null, end: '2026-01-31' } }), ctx)
    ).toContain('until Jan 31, 2026');
  });

  it('ignores weekdays, window and dates for once schedules', () => {
    expect(
      clockSummary(
        clock({
          schedule: { type: 'once', date: '2026-12-24', time: '17:55' },
          weekdays: [1],
          window: { start: '08:00', end: '09:00' },
        }),
        ctx
      )
    ).toBe('Once on Dec 24, 2026 at 17:55');
  });

  it('formats dates and leaves invalid ones untouched', () => {
    expect(formatLocalDate('2026-03-05', 'en-US')).toBe('Mar 5, 2026');
    expect(formatLocalDate('bad', 'en-US')).toBe('bad');
  });
});

describe('clock validation', () => {
  it('accepts valid configs', () => {
    expect(validateClock(defaultClockConfig())).toEqual([]);
    for (const type of ['hourly', 'interval', 'times', 'once'] as const) {
      expect(validateClock(clock({ schedule: defaultSchedule(type) }))).toEqual(
        []
      );
    }
  });

  it('rejects invalid schedules', () => {
    expect(
      validateClock(clock({ schedule: { type: 'hourly', minute: 60 } }))
    ).toEqual(['automations.validation.minute']);
    expect(
      validateClock(clock({ schedule: { type: 'interval', every_minutes: 4 } }))
    ).toEqual(['automations.validation.interval']);
    expect(
      validateClock(clock({ schedule: { type: 'times', times: [] } }))
    ).toEqual(['automations.validation.timesCount']);
    expect(
      validateClock(
        clock({
          schedule: {
            type: 'times',
            times: Array.from({ length: 49 }, () => '08:00'),
          },
        })
      )
    ).toContain('automations.validation.timesCount');
    expect(
      validateClock(clock({ schedule: { type: 'times', times: ['8:00'] } }))
    ).toEqual(['automations.validation.time']);
    expect(
      validateClock(
        clock({ schedule: { type: 'times', times: ['08:00', '08:00'] } })
      )
    ).toEqual(['automations.validation.timesDuplicate']);
    expect(
      validateClock(
        clock({ schedule: { type: 'once', date: '2026-02-30', time: '25:00' } })
      )
    ).toEqual(['automations.validation.date', 'automations.validation.time']);
    expect(validateClock(clock({ schedule: { type: 'x' } as never }))).toEqual([
      'automations.validation.schedule',
    ]);
  });

  it('rejects invalid weekdays, windows, dates and time zones', () => {
    expect(validateClock(clock({ weekdays: [] }))).toEqual([
      'automations.validation.weekdays',
    ]);
    expect(validateClock(clock({ weekdays: [8 as never] }))).toEqual([
      'automations.validation.weekdays',
    ]);
    expect(
      validateClock(clock({ window: { start: '18:00', end: '08:00' } }))
    ).toEqual(['automations.validation.window']);
    expect(
      validateClock(clock({ window: { start: '08:00', end: '08:00' } }))
    ).toEqual(['automations.validation.window']);
    expect(
      validateClock(
        clock({ dates: { start: '2026-02-01', end: '2026-01-01' } })
      )
    ).toEqual(['automations.validation.dates']);
    expect(validateClock(clock({ dates: { start: null, end: null } }))).toEqual(
      ['automations.validation.dates']
    );
    expect(validateClock(clock({ timezone: 'Mars/Olympus' }))).toEqual([
      'automations.validation.timezone',
    ]);
    expect(validateClock(clock({ timezone: 'Europe/Stockholm' }))).toEqual([]);
  });

  it('validates primitives', () => {
    expect(isValidTime('23:59')).toBe(true);
    expect(isValidTime('24:00')).toBe(false);
    expect(isValidDate('2024-02-29')).toBe(true);
    expect(isValidDate('2023-02-29')).toBe(false);
    expect(isValidDate(5)).toBe(false);
    expect(isValidTimeZone('UTC')).toBe(true);
    expect(todayIso(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('normalizes configs', () => {
    expect(
      normalizeClock(
        clock({
          schedule: { type: 'once', date: '2026-12-24', time: '17:55' },
          weekdays: [1],
          window: { start: '08:00', end: '09:00' },
          timezone: 'UTC',
        })
      )
    ).toEqual({
      schedule: { type: 'once', date: '2026-12-24', time: '17:55' },
      timezone: 'UTC',
    });
    expect(
      normalizeClock(
        clock({
          weekdays: [5, 1],
          window: { start: '08:00', end: '09:00' },
          dates: { start: '2026-01-01', end: '' as never },
        })
      )
    ).toEqual({
      schedule: { type: 'hourly', minute: 0 },
      weekdays: [1, 5],
      window: { start: '08:00', end: '09:00' },
      dates: { start: '2026-01-01', end: null },
    });
    expect(
      normalizeClock(clock({ weekdays: [1, 2, 3, 4, 5, 6, 7] })).weekdays
    ).toBeNull();
  });
});

describe('interrupt logic', () => {
  it('summarizes interrupts in plain language', () => {
    expect(interruptSummary(interrupt(), ctx)).toBe(
      'Interrupt with "Spring offer" after the current item'
    );
    expect(
      interruptSummary(
        interrupt({ start: 'immediately', plays: 3, priority: 'high' }),
        ctx
      )
    ).toBe(
      'Interrupt with "Spring offer" immediately · play 3 times · high priority'
    );
    expect(interruptSummary(interrupt({ playlist_id: 99 }), ctx)).toBe(
      'Interrupt with "playlist #99" after the current item'
    );
    expect(interruptSummary(interrupt({ playlist_id: null }), ctx)).toBe(
      'No playlist selected'
    );
  });

  it('validates interrupts', () => {
    expect(validateInterrupt(interrupt())).toEqual([]);
    expect(
      validateInterrupt({
        playlist_id: null,
        start: 'later' as never,
        plays: 0,
        priority: 'urgent' as never,
      })
    ).toEqual([
      'automations.validation.playlist',
      'automations.validation.start',
      'automations.validation.plays',
      'automations.validation.priority',
    ]);
    expect(validateInterrupt(interrupt({ max_wait_seconds: 3601 }))).toEqual([
      'automations.validation.maxWait',
    ]);
    expect(
      validateInterrupt(
        interrupt({ start: 'immediately', max_wait_seconds: -1 })
      )
    ).toEqual([]);
  });

  it('drops max wait for immediate interrupts', () => {
    expect(
      normalizeInterrupt(interrupt({ start: 'immediately' }))
    ).not.toHaveProperty('max_wait_seconds');
    expect(
      normalizeInterrupt(interrupt({ max_wait_seconds: undefined }))
        .max_wait_seconds
    ).toBe(120);
  });
});

describe('registry helpers', () => {
  const rule = (): AutomationRule => ({
    id: 'r1',
    when: {
      source: 'clock',
      condition: 'at',
      config: clock({
        schedule: { type: 'hourly', minute: 8 },
        weekdays: [1, 2, 3, 4, 5],
        window: { start: '08:00', end: '18:00' },
      }),
    },
    then: { action: 'interrupt', config: interrupt() },
    cooldown_seconds: 0,
  });

  it('builds the "when → then" summary', () => {
    expect(ruleSummary(rule(), ctx)).toBe(
      'Every hour at :08 · Mon–Fri · 08:00–18:00 → Interrupt with "Spring offer" after the current item'
    );
  });

  it('describes unknown types', () => {
    const unknown = {
      ...rule(),
      when: { source: 'motion', condition: 'x', config: {} },
      then: { action: 'mute', config: {} },
    };
    expect(whenSummary(unknown, ctx)).toBe('Unsupported type "motion"');
    expect(thenSummary(unknown, ctx)).toBe('Unsupported type "mute"');
    expect(validateRule(unknown)).toEqual([
      'automations.validation.source',
      'automations.validation.action',
    ]);
    expect(normalizeRule(unknown)).toEqual(unknown);
  });

  it('validates the cooldown', () => {
    expect(validateRule(rule())).toEqual([]);
    expect(validateRule({ ...rule(), cooldown_seconds: -1 })).toEqual([
      'automations.validation.cooldown',
    ]);
    expect(validateRule({ ...rule(), cooldown_seconds: 1.5 })).toEqual([
      'automations.validation.cooldown',
    ]);
  });

  it('normalizes with the registered normalizers', () => {
    const normalized = normalizeRule({
      ...rule(),
      then: {
        action: 'interrupt',
        config: interrupt({ start: 'immediately' }),
      },
    });
    expect(normalized.then.config).not.toHaveProperty('max_wait_seconds');
    expect(normalized.when.config).not.toHaveProperty('dates');
  });

  it('creates new rules from the registered defaults', () => {
    const created = newRule();
    expect(created.when).toEqual({
      source: 'clock',
      condition: 'at',
      config: defaultClockConfig(),
    });
    expect(created.then.action).toBe('interrupt');
    expect(created.cooldown_seconds).toBe(0);
    expect(newRule('missing', 'missing')).toEqual({
      when: { source: 'missing', condition: '', config: {} },
      then: { action: 'missing', config: {} },
      cooldown_seconds: 0,
    });
  });

  it('filters types by the server registry', () => {
    expect(availableSources(null).map((s) => s.type)).toContain('clock');
    expect(availableSources([])).toEqual([]);
    expect(availableActions(['interrupt']).map((a) => a.type)).toEqual([
      'interrupt',
    ]);
  });

  it('collects referenced playlists', () => {
    expect(
      referencedPlaylistIds([
        rule(),
        { then: { config: { playlist_id: null } } },
        { then: { config: { playlist_id: 7 } } },
      ])
    ).toEqual([12, 7]);
  });
});
