import { Machine, Timers, TimerEntry, WeekDay } from '../interfaces/machine';

/**
 * Manages device on/off timers.
 *
 * If the hardware `Machine` integration exposes `getTimers` / `setTimers`,
 * those are used directly. Otherwise a software fallback stores timers in
 * the device settings and performs periodic checks to turn the player on/off.
 *
 * The manager emits actions via callbacks rather than directly controlling the
 * player, keeping it decoupled from the Device class.
 */
export class TimerManager {
  private timerCheckInterval?: ReturnType<typeof setInterval>;

  constructor(
    private integration: Machine,
    private callbacks: {
      onTurnOff: () => Promise<void> | void;
      onTurnOn: () => Promise<void> | void;
    }
  ) {}

  // ── Public API ──────────────────────────────────────────────

  /**
   * Get timers. If the hardware supports getTimers, use that.
   * Otherwise, use the fallback implementation that stores timers in settings.
   */
  async getTimers(): Promise<Timers> {
    // Try hardware implementation first
    if (this.integration.getTimers) {
      try {
        return await this.integration.getTimers();
      } catch (error) {
        console.warn('Hardware getTimers failed, using fallback:', error);
      }
    }

    // Fallback: read from settings
    const timersJson = await this.integration.getSetting('TIMERS');
    if (timersJson) {
      try {
        const parsed = JSON.parse(timersJson);
        // Validate shape - ensure on/off arrays exist
        return {
          on: Array.isArray(parsed?.on) ? parsed.on : [],
          off: Array.isArray(parsed?.off) ? parsed.off : [],
        };
      } catch {
        return { on: [], off: [] };
      }
    }
    return { on: [], off: [] };
  }

  /**
   * Set timers. If the hardware supports setTimers, use that.
   * Otherwise, use the fallback implementation that stores timers in settings
   * and implements software-based on/off control.
   *
   * After persisting, the TIMER_OFF state is computed by looking at which
   * timer event (on or off) occurred most recently. If neither on nor off
   * timers exist the device is considered on.
   */
  async setTimers(timers: Timers): Promise<void> {
    // Try hardware implementation first
    if (this.integration.setTimers) {
      try {
        await this.integration.setTimers(timers);
        // Also save to settings as backup
        await this.integration.setSetting('TIMERS', JSON.stringify(timers));
        await this.computeTimerOffState(timers);
        return;
      } catch (error) {
        console.warn('Hardware setTimers failed, using fallback:', error);
      }
    }

    // Fallback: store in settings
    await this.integration.setSetting('TIMERS', JSON.stringify(timers));
    await this.computeTimerOffState(timers);

    // Schedule timer checks
    this.scheduleTimerChecks();
  }

  /**
   * Determine the correct TIMER_OFF state based on the most recent timer
   * event that would have fired before now.
   *
   * - If neither on nor off timers exist → device is on (TIMER_OFF = false).
   * - If the most recent event is an off-timer → TIMER_OFF = true.
   * - If the most recent event is an on-timer → TIMER_OFF = false.
   */
  async computeTimerOffState(
    timers: Timers,
    now: Date = new Date()
  ): Promise<void> {
    const hasOn = timers.on.length > 0;
    const hasOff = timers.off.length > 0;

    if (!hasOn && !hasOff) {
      await this.integration.setSetting('TIMER_OFF', 'false');
      return;
    }

    const lastOn = hasOn ? this.findPreviousTimer(timers.on, now) : null;
    const lastOff = hasOff ? this.findPreviousTimer(timers.off, now) : null;

    if (lastOff && (!lastOn || lastOff > lastOn)) {
      // Most recent event was an off-timer
      await this.integration.setSetting('TIMER_OFF', 'true');
    } else {
      // Most recent event was an on-timer, or no previous events exist
      await this.integration.setSetting('TIMER_OFF', 'false');
    }
  }

  /**
   * Start monitoring timers without starting the full player.
   * Used when the device is in timer-off state to detect ON timers.
   */
  startTimerMonitoring() {
    this.scheduleTimerChecks();
  }

  /**
   * Check if player is currently off due to timer
   */
  async isTimerOff(): Promise<boolean> {
    const timerOff = await this.integration.getSetting('TIMER_OFF');
    return timerOff === 'true';
  }

  /**
   * Get next scheduled on time
   */
  async getNextOnTime(): Promise<Date | null> {
    const timers = await this.getTimers();
    if (timers.on.length === 0) return null;
    return this.findNextTimer(timers.on, new Date());
  }

  /**
   * Get next scheduled off time based on configured off-timers
   */
  async getNextOffTime(): Promise<Date | null> {
    const timers = await this.getTimers();
    if (timers.off.length === 0) return null;
    return this.findNextTimer(timers.off, new Date());
  }

  /**
   * Stop the timer check interval. Should be called when the device is shutting down.
   */
  dispose() {
    if (this.timerCheckInterval) {
      clearInterval(this.timerCheckInterval);
      this.timerCheckInterval = undefined;
    }
  }

  // ── Internal helpers (exposed for testing via static) ───────

  /**
   * Schedule periodic checks for software timer implementation
   */
  scheduleTimerChecks() {
    // Check timers every minute
    if (this.timerCheckInterval) {
      clearInterval(this.timerCheckInterval);
    }

    this.timerCheckInterval = setInterval(() => {
      this.checkTimers();
    }, 60000); // Check every minute

    // Also check immediately
    this.checkTimers();
  }

  /**
   * Check if any timer should trigger now (software fallback implementation)
   */
  async checkTimers(now: Date = new Date()) {
    // Only use software timers if hardware doesn't support them
    if (this.integration.setTimers) {
      return;
    }

    const timers = await this.getTimers();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentDay = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][
      now.getDay()
    ] as WeekDay;

    const isTimerActive = (timer: TimerEntry) => {
      if (timer.hours !== currentHour || timer.minutes !== currentMinute) {
        return false;
      }
      return (
        timer.weekDays.includes(currentDay) || timer.weekDays.includes('ALL')
      );
    };

    // Check off timers
    const shouldTurnOff = timers.off.some(isTimerActive);
    if (shouldTurnOff) {
      console.log(
        `[Timer] Stopping player at ${now.toISOString()} due to off-timer`
      );
      await this.integration.setSetting('TIMER_OFF', 'true');
      await this.callbacks.onTurnOff();
      return;
    }

    // Check on timers
    const shouldTurnOn = timers.on.some(isTimerActive);
    if (shouldTurnOn) {
      const wasOff = await this.integration.getSetting('TIMER_OFF');
      if (wasOff === 'true') {
        console.log(
          `[Timer] Starting player at ${now.toISOString()} due to on-timer`
        );
        await this.integration.setSetting('TIMER_OFF', 'false');
        await this.callbacks.onTurnOn();
      }
    }
  }

  /**
   * Find the most recent timer occurrence before the given time.
   * Returns null if no previous occurrence exists within the past 7 days.
   */
  findPreviousTimer(timers: TimerEntry[], before: Date): Date | null {
    if (timers.length === 0) return null;

    const dayMap: Record<string, number> = {
      SUN: 0,
      MON: 1,
      TUE: 2,
      WED: 3,
      THU: 4,
      FRI: 5,
      SAT: 6,
    };

    let closestTime: Date | null = null;
    let minDiff = Infinity;

    for (const timer of timers) {
      const days = timer.weekDays.includes('ALL')
        ? [0, 1, 2, 3, 4, 5, 6]
        : timer.weekDays.map((d) => dayMap[d]);

      for (const day of days) {
        const timerDate = new Date(before);
        timerDate.setHours(timer.hours, timer.minutes, 0, 0);

        // Adjust to the correct day of week, going backwards
        const currentDay = before.getDay();
        let daysToSubtract = currentDay - day;
        if (
          daysToSubtract < 0 ||
          (daysToSubtract === 0 && timerDate >= before)
        ) {
          daysToSubtract += 7;
        }
        timerDate.setDate(timerDate.getDate() - daysToSubtract);

        const diff = before.getTime() - timerDate.getTime();
        if (diff > 0 && diff < minDiff) {
          minDiff = diff;
          closestTime = timerDate;
        }
      }
    }

    return closestTime;
  }

  /**
   * Find the next timer occurrence after the given time
   */
  findNextTimer(timers: TimerEntry[], after: Date): Date | null {
    if (timers.length === 0) return null;

    const dayMap: Record<string, number> = {
      SUN: 0,
      MON: 1,
      TUE: 2,
      WED: 3,
      THU: 4,
      FRI: 5,
      SAT: 6,
    };

    let closestTime: Date | null = null;
    let minDiff = Infinity;

    for (const timer of timers) {
      const days = timer.weekDays.includes('ALL')
        ? [0, 1, 2, 3, 4, 5, 6]
        : timer.weekDays.map((d) => dayMap[d]);

      for (const day of days) {
        const timerDate = new Date(after);
        timerDate.setHours(timer.hours, timer.minutes, 0, 0);

        // Adjust to correct day of week
        const currentDay = after.getDay();
        let daysToAdd = day - currentDay;
        if (daysToAdd < 0 || (daysToAdd === 0 && timerDate <= after)) {
          daysToAdd += 7;
        }
        timerDate.setDate(timerDate.getDate() + daysToAdd);

        const diff = timerDate.getTime() - after.getTime();
        if (diff > 0 && diff < minDiff) {
          minDiff = diff;
          closestTime = timerDate;
        }
      }
    }

    return closestTime;
  }
}
