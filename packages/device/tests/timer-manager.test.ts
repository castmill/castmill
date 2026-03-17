import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TimerManager } from '../src/classes/timer-manager';
import { Machine, Timers, TimerEntry } from '../src/interfaces/machine';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockIntegration(overrides: Partial<Machine> = {}): Machine {
  const settings: Record<string, string> = {};
  return {
    getSetting: vi.fn(async (key: string) => settings[key] ?? null),
    setSetting: vi.fn(async (key: string, value: string) => {
      settings[key] = value;
    }),
    getMachineGUID: vi.fn(async () => 'test-guid'),
    storeCredentials: vi.fn(async () => {}),
    getCredentials: vi.fn(async () => null),
    removeCredentials: vi.fn(async () => {}),
    getDeviceInfo: vi.fn(async () => ({
      appType: 'test',
      appVersion: '0.0.1',
      os: 'test',
      hardware: 'test',
      userAgent: 'test',
    })),
    ...overrides,
  };
}

function createTimerManager(
  integration?: Machine,
  callbacks?: {
    onTurnOff?: () => Promise<void> | void;
    onTurnOn?: () => Promise<void> | void;
  }
) {
  const mockIntegration = integration ?? createMockIntegration();
  const mockCallbacks = {
    onTurnOff: callbacks?.onTurnOff ?? vi.fn(),
    onTurnOn: callbacks?.onTurnOn ?? vi.fn(),
  };
  return {
    manager: new TimerManager(mockIntegration, mockCallbacks),
    integration: mockIntegration,
    callbacks: mockCallbacks,
  };
}

// Helper to build a date for a specific weekday, hour and minute.
// dayIndex: 0=SUN … 6=SAT
function dateForDay(dayIndex: number, hours: number, minutes: number): Date {
  // Start from a known Sunday: 2026-03-01 is a Sunday
  const base = new Date(2026, 2, 1, hours, minutes, 0, 0); // March 1 2026 = Sunday
  base.setDate(base.getDate() + dayIndex);
  return base;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TimerManager', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── getTimers ──────────────────────────────────────────────

  describe('getTimers', () => {
    it('should use hardware getTimers when available', async () => {
      const hwTimers: Timers = {
        on: [{ hours: 8, minutes: 0, weekDays: ['MON'] }],
        off: [{ hours: 22, minutes: 0, weekDays: ['MON'] }],
      };
      const { manager } = createTimerManager(
        createMockIntegration({ getTimers: vi.fn(async () => hwTimers) })
      );

      const result = await manager.getTimers();
      expect(result).toEqual(hwTimers);
    });

    it('should fall back to settings when hardware getTimers throws', async () => {
      const settingsTimers: Timers = {
        on: [{ hours: 9, minutes: 30, weekDays: ['TUE'] }],
        off: [],
      };
      const integration = createMockIntegration({
        getTimers: vi.fn(async () => {
          throw new Error('hardware failure');
        }),
      });
      // Pre-populate settings
      await integration.setSetting('TIMERS', JSON.stringify(settingsTimers));

      const { manager } = createTimerManager(integration);
      const result = await manager.getTimers();
      expect(result).toEqual(settingsTimers);
    });

    it('should fall back to settings when hardware getTimers is not defined', async () => {
      const settingsTimers: Timers = {
        on: [],
        off: [{ hours: 18, minutes: 0, weekDays: ['FRI'] }],
      };
      const integration = createMockIntegration();
      await integration.setSetting('TIMERS', JSON.stringify(settingsTimers));

      const { manager } = createTimerManager(integration);
      const result = await manager.getTimers();
      expect(result).toEqual(settingsTimers);
    });

    it('should return empty timers when no settings exist', async () => {
      const { manager } = createTimerManager();
      const result = await manager.getTimers();
      expect(result).toEqual({ on: [], off: [] });
    });

    it('should return empty timers when settings contain invalid JSON', async () => {
      const integration = createMockIntegration();
      await integration.setSetting('TIMERS', 'not valid json');

      const { manager } = createTimerManager(integration);
      const result = await manager.getTimers();
      expect(result).toEqual({ on: [], off: [] });
    });
  });

  // ── setTimers ──────────────────────────────────────────────

  describe('setTimers', () => {
    it('should use hardware setTimers and also save to settings', async () => {
      const hwSetTimers = vi.fn(async () => {});
      const integration = createMockIntegration({ setTimers: hwSetTimers });
      const { manager } = createTimerManager(integration);

      const timers: Timers = {
        on: [{ hours: 7, minutes: 0, weekDays: ['ALL'] }],
        off: [{ hours: 23, minutes: 0, weekDays: ['ALL'] }],
      };

      await manager.setTimers(timers);

      expect(hwSetTimers).toHaveBeenCalledWith(timers);
      expect(integration.setSetting).toHaveBeenCalledWith(
        'TIMERS',
        JSON.stringify(timers)
      );
    });

    it('should fall back to settings when hardware setTimers throws', async () => {
      const integration = createMockIntegration({
        setTimers: vi.fn(async () => {
          throw new Error('hw error');
        }),
      });
      const { manager } = createTimerManager(integration);

      const timers: Timers = {
        on: [{ hours: 6, minutes: 30, weekDays: ['MON', 'WED', 'FRI'] }],
        off: [],
      };

      await manager.setTimers(timers);

      // Should still persist in settings
      expect(integration.setSetting).toHaveBeenCalledWith(
        'TIMERS',
        JSON.stringify(timers)
      );
    });

    it('should store timers in settings when no hardware support', async () => {
      const integration = createMockIntegration();
      const { manager } = createTimerManager(integration);

      const timers: Timers = {
        on: [],
        off: [{ hours: 20, minutes: 0, weekDays: ['SAT', 'SUN'] }],
      };

      await manager.setTimers(timers);

      expect(integration.setSetting).toHaveBeenCalledWith(
        'TIMERS',
        JSON.stringify(timers)
      );
    });
  });

  // ── isTimerOff ─────────────────────────────────────────────

  describe('isTimerOff', () => {
    it('should return true when TIMER_OFF setting is "true"', async () => {
      const integration = createMockIntegration();
      await integration.setSetting('TIMER_OFF', 'true');
      const { manager } = createTimerManager(integration);

      expect(await manager.isTimerOff()).toBe(true);
    });

    it('should return false when TIMER_OFF setting is "false"', async () => {
      const integration = createMockIntegration();
      await integration.setSetting('TIMER_OFF', 'false');
      const { manager } = createTimerManager(integration);

      expect(await manager.isTimerOff()).toBe(false);
    });

    it('should return false when TIMER_OFF setting is not set', async () => {
      const { manager } = createTimerManager();
      expect(await manager.isTimerOff()).toBe(false);
    });
  });

  // ── findNextTimer ──────────────────────────────────────────

  describe('findNextTimer', () => {
    it('should return null for empty timers array', () => {
      const { manager } = createTimerManager();
      expect(manager.findNextTimer([], new Date())).toBeNull();
    });

    it('should find the next timer on the same day', () => {
      // Wednesday 10:00
      const now = dateForDay(3, 10, 0); // WED
      const timer: TimerEntry = { hours: 14, minutes: 30, weekDays: ['WED'] };

      const { manager } = createTimerManager();
      const next = manager.findNextTimer([timer], now);

      expect(next).not.toBeNull();
      expect(next!.getHours()).toBe(14);
      expect(next!.getMinutes()).toBe(30);
      expect(next!.getDay()).toBe(3); // Wednesday
    });

    it('should wrap to next week if time already passed today', () => {
      // Wednesday 16:00 — timer is at 14:30 WED → should go to next Wednesday
      const now = dateForDay(3, 16, 0);
      const timer: TimerEntry = { hours: 14, minutes: 30, weekDays: ['WED'] };

      const { manager } = createTimerManager();
      const next = manager.findNextTimer([timer], now);

      expect(next).not.toBeNull();
      expect(next!.getDay()).toBe(3);
      // Should be 7 days later
      const diffDays =
        (next!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      expect(diffDays).toBeCloseTo(6 + 22.5 / 24, 1); // ~6.9375 days
    });

    it('should find the closest timer across multiple entries', () => {
      // Monday 08:00
      const now = dateForDay(1, 8, 0);
      const timers: TimerEntry[] = [
        { hours: 9, minutes: 0, weekDays: ['FRI'] }, // 4 days away
        { hours: 12, minutes: 0, weekDays: ['MON'] }, // today, 4h away
        { hours: 10, minutes: 0, weekDays: ['WED'] }, // 2 days away
      ];

      const { manager } = createTimerManager();
      const next = manager.findNextTimer(timers, now);

      expect(next).not.toBeNull();
      expect(next!.getHours()).toBe(12);
      expect(next!.getDay()).toBe(1); // Monday
    });

    it('should handle ALL weekdays', () => {
      // Tuesday 22:00
      const now = dateForDay(2, 22, 0);
      const timer: TimerEntry = { hours: 8, minutes: 0, weekDays: ['ALL'] };

      const { manager } = createTimerManager();
      const next = manager.findNextTimer([timer], now);

      expect(next).not.toBeNull();
      // Next occurrence should be tomorrow (Wednesday) at 08:00
      expect(next!.getDay()).toBe(3);
      expect(next!.getHours()).toBe(8);
    });

    it('should pick the closer of multiple weekdays in one timer', () => {
      // Sunday 12:00
      const now = dateForDay(0, 12, 0);
      const timer: TimerEntry = {
        hours: 9,
        minutes: 0,
        weekDays: ['MON', 'THU'],
      };

      const { manager } = createTimerManager();
      const next = manager.findNextTimer([timer], now);

      expect(next).not.toBeNull();
      expect(next!.getDay()).toBe(1); // Monday is closer than Thursday
    });

    it('should handle exact current time by moving to next week', () => {
      // Monday 09:00 exactly
      const now = dateForDay(1, 9, 0);
      const timer: TimerEntry = { hours: 9, minutes: 0, weekDays: ['MON'] };

      const { manager } = createTimerManager();
      const next = manager.findNextTimer([timer], now);

      expect(next).not.toBeNull();
      // Should be next Monday since current time matches exactly (timerDate <= after)
      const diffDays =
        (next!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      expect(diffDays).toBe(7);
    });
  });

  // ── checkTimers ────────────────────────────────────────────

  describe('checkTimers', () => {
    it('should not run when hardware setTimers is available', async () => {
      const onTurnOff = vi.fn();
      const integration = createMockIntegration({
        setTimers: vi.fn(async () => {}),
      });
      await integration.setSetting(
        'TIMERS',
        JSON.stringify({
          on: [],
          off: [{ hours: 10, minutes: 0, weekDays: ['ALL'] }],
        })
      );

      const { manager } = createTimerManager(integration, { onTurnOff });
      // Wednesday 10:00
      await manager.checkTimers(dateForDay(3, 10, 0));

      expect(onTurnOff).not.toHaveBeenCalled();
    });

    it('should call onTurnOff when matching off-timer fires', async () => {
      const onTurnOff = vi.fn();
      const integration = createMockIntegration();
      await integration.setSetting(
        'TIMERS',
        JSON.stringify({
          on: [],
          off: [{ hours: 22, minutes: 0, weekDays: ['ALL'] }],
        })
      );

      const { manager } = createTimerManager(integration, { onTurnOff });

      // Tuesday 22:00
      await manager.checkTimers(dateForDay(2, 22, 0));

      expect(onTurnOff).toHaveBeenCalledTimes(1);
      expect(integration.setSetting).toHaveBeenCalledWith('TIMER_OFF', 'true');
    });

    it('should NOT call onTurnOff when time does not match', async () => {
      const onTurnOff = vi.fn();
      const integration = createMockIntegration();
      await integration.setSetting(
        'TIMERS',
        JSON.stringify({
          on: [],
          off: [{ hours: 22, minutes: 0, weekDays: ['ALL'] }],
        })
      );

      const { manager } = createTimerManager(integration, { onTurnOff });

      // 21:59 — one minute too early
      await manager.checkTimers(dateForDay(2, 21, 59));
      expect(onTurnOff).not.toHaveBeenCalled();
    });

    it('should NOT call onTurnOff when weekday does not match', async () => {
      const onTurnOff = vi.fn();
      const integration = createMockIntegration();
      await integration.setSetting(
        'TIMERS',
        JSON.stringify({
          on: [],
          off: [{ hours: 22, minutes: 0, weekDays: ['MON'] }],
        })
      );

      const { manager } = createTimerManager(integration, { onTurnOff });

      // Tuesday 22:00 — right time, wrong day
      await manager.checkTimers(dateForDay(2, 22, 0));
      expect(onTurnOff).not.toHaveBeenCalled();
    });

    it('should call onTurnOn when matching on-timer fires and device was off', async () => {
      const onTurnOn = vi.fn();
      const integration = createMockIntegration();
      await integration.setSetting(
        'TIMERS',
        JSON.stringify({
          on: [{ hours: 8, minutes: 0, weekDays: ['ALL'] }],
          off: [],
        })
      );
      await integration.setSetting('TIMER_OFF', 'true');

      const { manager } = createTimerManager(integration, { onTurnOn });

      // Thursday 08:00
      await manager.checkTimers(dateForDay(4, 8, 0));

      expect(onTurnOn).toHaveBeenCalledTimes(1);
      expect(integration.setSetting).toHaveBeenCalledWith('TIMER_OFF', 'false');
    });

    it('should NOT call onTurnOn when device is already on', async () => {
      const onTurnOn = vi.fn();
      const integration = createMockIntegration();
      await integration.setSetting(
        'TIMERS',
        JSON.stringify({
          on: [{ hours: 8, minutes: 0, weekDays: ['ALL'] }],
          off: [],
        })
      );
      // TIMER_OFF is not set (device is on)

      const { manager } = createTimerManager(integration, { onTurnOn });
      await manager.checkTimers(dateForDay(4, 8, 0));

      expect(onTurnOn).not.toHaveBeenCalled();
    });

    it('should prioritize off-timer over on-timer at the same time', async () => {
      const onTurnOff = vi.fn();
      const onTurnOn = vi.fn();
      const integration = createMockIntegration();
      await integration.setSetting(
        'TIMERS',
        JSON.stringify({
          on: [{ hours: 10, minutes: 0, weekDays: ['ALL'] }],
          off: [{ hours: 10, minutes: 0, weekDays: ['ALL'] }],
        })
      );
      await integration.setSetting('TIMER_OFF', 'true');

      const { manager } = createTimerManager(integration, {
        onTurnOff,
        onTurnOn,
      });

      await manager.checkTimers(dateForDay(3, 10, 0));

      // Off takes priority (checked first, returns early)
      expect(onTurnOff).toHaveBeenCalledTimes(1);
      expect(onTurnOn).not.toHaveBeenCalled();
    });

    it('should handle ALL weekday value correctly', async () => {
      const onTurnOff = vi.fn();
      const integration = createMockIntegration();
      await integration.setSetting(
        'TIMERS',
        JSON.stringify({
          on: [],
          off: [{ hours: 18, minutes: 0, weekDays: ['ALL'] }],
        })
      );

      const { manager } = createTimerManager(integration, { onTurnOff });

      // Test for every day of the week
      for (let day = 0; day <= 6; day++) {
        onTurnOff.mockClear();
        await manager.checkTimers(dateForDay(day, 18, 0));
        expect(onTurnOff).toHaveBeenCalledTimes(1);
      }
    });

    it('should handle specific weekday values correctly', async () => {
      const onTurnOff = vi.fn();
      const integration = createMockIntegration();
      await integration.setSetting(
        'TIMERS',
        JSON.stringify({
          on: [],
          off: [{ hours: 17, minutes: 0, weekDays: ['MON', 'WED', 'FRI'] }],
        })
      );

      const { manager } = createTimerManager(integration, { onTurnOff });

      // MON=1, TUE=2, WED=3, THU=4, FRI=5, SAT=6, SUN=0
      const activeDays = [1, 3, 5];
      const inactiveDays = [0, 2, 4, 6];

      for (const day of activeDays) {
        onTurnOff.mockClear();
        await manager.checkTimers(dateForDay(day, 17, 0));
        expect(onTurnOff).toHaveBeenCalledTimes(1);
      }

      for (const day of inactiveDays) {
        onTurnOff.mockClear();
        await manager.checkTimers(dateForDay(day, 17, 0));
        expect(onTurnOff).not.toHaveBeenCalled();
      }
    });
  });

  // ── scheduleTimerChecks ────────────────────────────────────

  describe('scheduleTimerChecks', () => {
    it('should check timers immediately and then every 60 seconds', async () => {
      const integration = createMockIntegration();
      const { manager } = createTimerManager(integration);

      const checkSpy = vi.spyOn(manager, 'checkTimers');

      manager.scheduleTimerChecks();

      // Called immediately
      expect(checkSpy).toHaveBeenCalledTimes(1);

      // Advance 60s
      vi.advanceTimersByTime(60_000);
      expect(checkSpy).toHaveBeenCalledTimes(2);

      // Advance another 60s
      vi.advanceTimersByTime(60_000);
      expect(checkSpy).toHaveBeenCalledTimes(3);

      manager.dispose();
    });

    it('should clear previous interval when called again', () => {
      const { manager } = createTimerManager();

      const clearSpy = vi.spyOn(globalThis, 'clearInterval');

      manager.scheduleTimerChecks();
      manager.scheduleTimerChecks();

      // Second call should have cleared the interval from the first call
      expect(clearSpy).toHaveBeenCalled();

      manager.dispose();
      clearSpy.mockRestore();
    });
  });

  // ── startTimerMonitoring ───────────────────────────────────

  describe('startTimerMonitoring', () => {
    it('should schedule timer checks', () => {
      const { manager } = createTimerManager();
      const scheduleSpy = vi.spyOn(manager, 'scheduleTimerChecks');

      manager.startTimerMonitoring();

      expect(scheduleSpy).toHaveBeenCalledTimes(1);
      manager.dispose();
    });
  });

  // ── dispose ────────────────────────────────────────────────

  describe('dispose', () => {
    it('should clear the timer check interval', () => {
      const { manager } = createTimerManager();
      const clearSpy = vi.spyOn(globalThis, 'clearInterval');

      manager.scheduleTimerChecks();
      manager.dispose();

      expect(clearSpy).toHaveBeenCalled();
      clearSpy.mockRestore();
    });

    it('should be safe to call multiple times', () => {
      const { manager } = createTimerManager();
      manager.scheduleTimerChecks();
      manager.dispose();
      manager.dispose(); // no error
    });
  });

  // ── getNextOnTime / getNextOffTime ─────────────────────────

  describe('getNextOnTime', () => {
    it('should return null when no on timers are configured', async () => {
      const integration = createMockIntegration();
      await integration.setSetting(
        'TIMERS',
        JSON.stringify({ on: [], off: [] })
      );
      const { manager } = createTimerManager(integration);

      expect(await manager.getNextOnTime()).toBeNull();
    });

    it('should return the next on time', async () => {
      const integration = createMockIntegration();
      // Use a timer for every day so there's always a next occurrence
      await integration.setSetting(
        'TIMERS',
        JSON.stringify({
          on: [{ hours: 8, minutes: 0, weekDays: ['ALL'] }],
          off: [],
        })
      );
      const { manager } = createTimerManager(integration);

      const next = await manager.getNextOnTime();
      expect(next).not.toBeNull();
      expect(next!.getHours()).toBe(8);
      expect(next!.getMinutes()).toBe(0);
    });
  });

  describe('getNextOffTime', () => {
    it('should return null when no off timers are configured', async () => {
      const integration = createMockIntegration();
      await integration.setSetting(
        'TIMERS',
        JSON.stringify({ on: [], off: [] })
      );
      const { manager } = createTimerManager(integration);

      expect(await manager.getNextOffTime()).toBeNull();
    });

    it('should return the next off time', async () => {
      const integration = createMockIntegration();
      await integration.setSetting(
        'TIMERS',
        JSON.stringify({
          on: [],
          off: [{ hours: 22, minutes: 30, weekDays: ['ALL'] }],
        })
      );
      const { manager } = createTimerManager(integration);

      const next = await manager.getNextOffTime();
      expect(next).not.toBeNull();
      expect(next!.getHours()).toBe(22);
      expect(next!.getMinutes()).toBe(30);
    });
  });

  // ── Edge cases ─────────────────────────────────────────────

  describe('edge cases', () => {
    it('should handle midnight timer (00:00)', async () => {
      const onTurnOff = vi.fn();
      const integration = createMockIntegration();
      await integration.setSetting(
        'TIMERS',
        JSON.stringify({
          on: [],
          off: [{ hours: 0, minutes: 0, weekDays: ['ALL'] }],
        })
      );

      const { manager } = createTimerManager(integration, { onTurnOff });
      await manager.checkTimers(dateForDay(3, 0, 0));

      expect(onTurnOff).toHaveBeenCalledTimes(1);
    });

    it('should handle end-of-day timer (23:59)', async () => {
      const onTurnOff = vi.fn();
      const integration = createMockIntegration();
      await integration.setSetting(
        'TIMERS',
        JSON.stringify({
          on: [],
          off: [{ hours: 23, minutes: 59, weekDays: ['ALL'] }],
        })
      );

      const { manager } = createTimerManager(integration, { onTurnOff });
      await manager.checkTimers(dateForDay(5, 23, 59));

      expect(onTurnOff).toHaveBeenCalledTimes(1);
    });

    it('should handle multiple on timers on different days', async () => {
      const { manager } = createTimerManager();
      const timers: TimerEntry[] = [
        { hours: 8, minutes: 0, weekDays: ['MON'] },
        { hours: 9, minutes: 0, weekDays: ['WED'] },
        { hours: 7, minutes: 30, weekDays: ['FRI'] },
      ];

      // From Sunday 12:00 → next is Monday 08:00
      const next = manager.findNextTimer(timers, dateForDay(0, 12, 0));
      expect(next).not.toBeNull();
      expect(next!.getDay()).toBe(1); // MON
      expect(next!.getHours()).toBe(8);
    });

    it('should handle SUN timer from SAT correctly', () => {
      const { manager } = createTimerManager();
      const timer: TimerEntry = { hours: 10, minutes: 0, weekDays: ['SUN'] };

      // Saturday 20:00 → next SUN 10:00 is tomorrow
      const next = manager.findNextTimer([timer], dateForDay(6, 20, 0));
      expect(next).not.toBeNull();
      expect(next!.getDay()).toBe(0); // SUN
      const diffHours =
        (next!.getTime() - dateForDay(6, 20, 0).getTime()) / (1000 * 60 * 60);
      expect(diffHours).toBe(14); // 14 hours from SAT 20:00 to SUN 10:00
    });

    it('should handle empty weekDays array (no active days)', () => {
      const { manager } = createTimerManager();
      const timer: TimerEntry = { hours: 10, minutes: 0, weekDays: [] };

      const next = manager.findNextTimer([timer], dateForDay(3, 12, 0));
      // No valid days, so should return null
      expect(next).toBeNull();
    });
  });

  // ── findPreviousTimer ──────────────────────────────────────

  describe('findPreviousTimer', () => {
    it('should return null for empty timers array', () => {
      const { manager } = createTimerManager();
      expect(manager.findPreviousTimer([], new Date())).toBeNull();
    });

    it('should find the most recent timer earlier today', () => {
      const { manager } = createTimerManager();
      // Wednesday 14:00, timer at 08:00 on WED
      const now = dateForDay(3, 14, 0);
      const timer: TimerEntry = { hours: 8, minutes: 0, weekDays: ['WED'] };

      const prev = manager.findPreviousTimer([timer], now);
      expect(prev).not.toBeNull();
      expect(prev!.getDay()).toBe(3);
      expect(prev!.getHours()).toBe(8);
      expect(prev!.getMinutes()).toBe(0);
    });

    it('should go to previous week if time has not occurred yet today', () => {
      // Wednesday 06:00, timer at 08:00 WED → should go back to last Wednesday 08:00
      const now = dateForDay(3, 6, 0);
      const timer: TimerEntry = { hours: 8, minutes: 0, weekDays: ['WED'] };

      const { manager } = createTimerManager();
      const prev = manager.findPreviousTimer([timer], now);

      expect(prev).not.toBeNull();
      expect(prev!.getDay()).toBe(3); // Wednesday
      const diffDays =
        (now.getTime() - prev!.getTime()) / (1000 * 60 * 60 * 24);
      // Should be about 6.something days ago (last Wednesday)
      expect(diffDays).toBeCloseTo(7 - 2 / 24, 1);
    });

    it('should find the closest previous timer across multiple entries', () => {
      // Thursday 12:00
      const now = dateForDay(4, 12, 0);
      const timers: TimerEntry[] = [
        { hours: 8, minutes: 0, weekDays: ['MON'] }, // 3 days ago
        { hours: 10, minutes: 0, weekDays: ['THU'] }, // 2 hours ago (closest)
        { hours: 9, minutes: 0, weekDays: ['TUE'] }, // 2 days ago
      ];

      const { manager } = createTimerManager();
      const prev = manager.findPreviousTimer(timers, now);

      expect(prev).not.toBeNull();
      expect(prev!.getDay()).toBe(4); // THU
      expect(prev!.getHours()).toBe(10);
    });

    it('should handle ALL weekdays', () => {
      // Tuesday 15:00, timer at 08:00 every day → should be today at 08:00
      const now = dateForDay(2, 15, 0);
      const timer: TimerEntry = { hours: 8, minutes: 0, weekDays: ['ALL'] };

      const { manager } = createTimerManager();
      const prev = manager.findPreviousTimer([timer], now);

      expect(prev).not.toBeNull();
      expect(prev!.getDay()).toBe(2); // Same day (Tuesday)
      expect(prev!.getHours()).toBe(8);
    });

    it('should handle SUN timer from MON correctly', () => {
      const { manager } = createTimerManager();
      const timer: TimerEntry = { hours: 22, minutes: 0, weekDays: ['SUN'] };

      // Monday 08:00 → most recent SUN 22:00 was yesterday
      const now = dateForDay(1, 8, 0);
      const prev = manager.findPreviousTimer([timer], now);

      expect(prev).not.toBeNull();
      expect(prev!.getDay()).toBe(0); // SUN
      const diffHours = (now.getTime() - prev!.getTime()) / (1000 * 60 * 60);
      expect(diffHours).toBe(10); // 10 hours from SUN 22:00 to MON 08:00
    });

    it('should handle exact current time by going to previous week', () => {
      // Monday 09:00 exactly, timer is MON 09:00
      const now = dateForDay(1, 9, 0);
      const timer: TimerEntry = { hours: 9, minutes: 0, weekDays: ['MON'] };

      const { manager } = createTimerManager();
      const prev = manager.findPreviousTimer([timer], now);

      expect(prev).not.toBeNull();
      // Should be last Monday since current time matches exactly
      const diffDays =
        (now.getTime() - prev!.getTime()) / (1000 * 60 * 60 * 24);
      expect(diffDays).toBe(7);
    });

    it('should handle empty weekDays array', () => {
      const { manager } = createTimerManager();
      const timer: TimerEntry = { hours: 10, minutes: 0, weekDays: [] };

      const prev = manager.findPreviousTimer([timer], dateForDay(3, 12, 0));
      expect(prev).toBeNull();
    });
  });

  // ── computeTimerOffState ───────────────────────────────────

  describe('computeTimerOffState', () => {
    it('should set TIMER_OFF to false when no timers exist', async () => {
      const integration = createMockIntegration();
      const { manager } = createTimerManager(integration);

      await manager.computeTimerOffState({ on: [], off: [] });

      expect(integration.setSetting).toHaveBeenCalledWith('TIMER_OFF', 'false');
    });

    it('should set TIMER_OFF to true when last event was off-timer', async () => {
      const integration = createMockIntegration();
      const { manager } = createTimerManager(integration);

      // On at 08:00, off at 22:00, current time is 23:00 → last event was off
      const now = dateForDay(3, 23, 0); // WED 23:00
      const timers: Timers = {
        on: [{ hours: 8, minutes: 0, weekDays: ['ALL'] }],
        off: [{ hours: 22, minutes: 0, weekDays: ['ALL'] }],
      };

      await manager.computeTimerOffState(timers, now);

      expect(integration.setSetting).toHaveBeenCalledWith('TIMER_OFF', 'true');
    });

    it('should set TIMER_OFF to false when last event was on-timer', async () => {
      const integration = createMockIntegration();
      const { manager } = createTimerManager(integration);

      // On at 08:00, off at 22:00, current time is 12:00 → last event was on
      const now = dateForDay(3, 12, 0); // WED 12:00
      const timers: Timers = {
        on: [{ hours: 8, minutes: 0, weekDays: ['ALL'] }],
        off: [{ hours: 22, minutes: 0, weekDays: ['ALL'] }],
      };

      await manager.computeTimerOffState(timers, now);

      expect(integration.setSetting).toHaveBeenCalledWith('TIMER_OFF', 'false');
    });

    it('should set TIMER_OFF to false when only on timers exist', async () => {
      const integration = createMockIntegration();
      const { manager } = createTimerManager(integration);

      const timers: Timers = {
        on: [{ hours: 8, minutes: 0, weekDays: ['ALL'] }],
        off: [],
      };

      await manager.computeTimerOffState(timers, dateForDay(3, 12, 0));

      expect(integration.setSetting).toHaveBeenCalledWith('TIMER_OFF', 'false');
    });

    it('should set TIMER_OFF to true when only off timers exist', async () => {
      const integration = createMockIntegration();
      const { manager } = createTimerManager(integration);

      const timers: Timers = {
        on: [],
        off: [{ hours: 22, minutes: 0, weekDays: ['ALL'] }],
      };

      await manager.computeTimerOffState(timers, dateForDay(3, 23, 0));

      expect(integration.setSetting).toHaveBeenCalledWith('TIMER_OFF', 'true');
    });

    it('should handle off at midnight, on in the morning', async () => {
      const integration = createMockIntegration();
      const { manager } = createTimerManager(integration);

      // Off at 00:00, on at 06:00, current time is 03:00 → last event was off
      const now = dateForDay(4, 3, 0);
      const timers: Timers = {
        on: [{ hours: 6, minutes: 0, weekDays: ['ALL'] }],
        off: [{ hours: 0, minutes: 0, weekDays: ['ALL'] }],
      };

      await manager.computeTimerOffState(timers, now);

      expect(integration.setSetting).toHaveBeenCalledWith('TIMER_OFF', 'true');
    });

    it('should be called by setTimers', async () => {
      const integration = createMockIntegration();
      const { manager } = createTimerManager(integration);

      const spy = vi.spyOn(manager, 'computeTimerOffState');

      const timers: Timers = {
        on: [{ hours: 8, minutes: 0, weekDays: ['ALL'] }],
        off: [{ hours: 22, minutes: 0, weekDays: ['ALL'] }],
      };

      await manager.setTimers(timers);

      expect(spy).toHaveBeenCalledWith(timers);
    });
  });
});
