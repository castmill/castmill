import { TimerEntry } from '@castmill/device';
import { vi, describe, it, beforeEach, expect } from 'vitest';
import {
  DEFAULT_INPUT_SOURCE,
  toWebosWeekDays,
  clearAllTimers,
  addOnTimers,
  addOffTimers,
  getTimers,
} from './timers';

import { time, power } from '../../native';
vi.mock('../../native', () => ({
  time: {
    clearAllOnOffTimers: undefined,
    reserveOnOffTimer: undefined,
  },
  power: {
    enableAllOnTimer: undefined,
    enableAllOffTimer: undefined,
    addOnTimer: undefined,
    addOffTimer: undefined,
    getOnTimerList: undefined,
    getOffTimerList: undefined,
  },
}));
describe('timers', () => {
  describe('toWebosWeekDays', () => {
    it('should convert TimerEntry weekdays to webos', () => {
      expect(toWebosWeekDays(['MON'])).toBe(0b1);
      expect(toWebosWeekDays(['TUE'])).toBe(0b10);
      expect(toWebosWeekDays(['WED'])).toBe(0b100);
      expect(toWebosWeekDays(['THU'])).toBe(0b1000);
      expect(toWebosWeekDays(['FRI'])).toBe(0b10000);
      expect(toWebosWeekDays(['SAT'])).toBe(0b100000);
      expect(toWebosWeekDays(['SUN'])).toBe(0b1000000);
    });

    it('should combine TimerEntry weekdays to webos', () => {
      expect(toWebosWeekDays(['MON', 'TUE'])).toBe(0b11);
      expect(toWebosWeekDays(['WED', 'THU'])).toBe(0b1100);
      expect(toWebosWeekDays(['FRI', 'SAT'])).toBe(0b110000);
      expect(
        toWebosWeekDays(['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'])
      ).toBe(0b1111111);
    });
  });

  describe('clearAllTimers', () => {
    describe('when webos < 4', () => {
      it('should use the power API', async () => {
        time.clearAllOnOffTimers = undefined;
        vi.spyOn(power, 'enableAllOnTimer').mockResolvedValue(undefined);
        vi.spyOn(power, 'enableAllOffTimer').mockResolvedValue(undefined);
        await clearAllTimers();
        expect(power.enableAllOnTimer).toHaveBeenCalledWith({
          allOnTimer: true,
          clearOnTimer: true,
        });
        expect(power.enableAllOffTimer).toHaveBeenCalledWith({
          allOffTimer: true,
          clearOffTimer: true,
        });
      });
    });

    describe('when webos >= 4', () => {
      it('should use the time API', async () => {
        power.enableAllOnTimer = undefined;
        power.enableAllOffTimer = undefined;
        vi.spyOn(time, 'clearAllOnOffTimers').mockResolvedValue(undefined);
        await clearAllTimers();
        expect(time.clearAllOnOffTimers).toHaveBeenCalled();
      });
    });
  });

  describe('addOnTimers', () => {
    const timers: TimerEntry[] = [
      { hours: 12, minutes: 0, weekDays: ['MON'] },
      { hours: 13, minutes: 1, weekDays: ['MON', 'TUE'] },
    ];

    describe('when webos < 4', () => {
      it('should use the power API', async () => {
        time.reserveOnOffTimer = undefined;
        vi.spyOn(power, 'addOnTimer').mockResolvedValue(undefined);

        await addOnTimers(timers);

        expect(power.addOnTimer).toHaveBeenCalledWith({
          hour: 12,
          minute: 0,
          week: 0b1,
          inputSource: DEFAULT_INPUT_SOURCE,
        });

        expect(power.addOnTimer).toHaveBeenCalledWith({
          hour: 13,
          minute: 1,
          week: 0b11,
          inputSource: DEFAULT_INPUT_SOURCE,
        });
      });
    });

    describe('when webos >= 4', () => {
      it('should use the time API', async () => {
        power.addOnTimer = undefined;
        vi.spyOn(time, 'reserveOnOffTimer').mockResolvedValue(undefined);

        await addOnTimers(timers);

        expect(time.reserveOnOffTimer).toHaveBeenCalledWith({
          hour: 12,
          minute: 0,
          week: 0b1,
          inputSource: DEFAULT_INPUT_SOURCE,
          type: 'ONTIMER',
        });

        expect(time.reserveOnOffTimer).toHaveBeenCalledWith({
          hour: 13,
          minute: 1,
          week: 0b11,
          inputSource: DEFAULT_INPUT_SOURCE,
          type: 'ONTIMER',
        });
      });
    });
  });

  describe('addOffTimers', () => {
    const timers: TimerEntry[] = [
      { hours: 12, minutes: 0, weekDays: ['MON'] },
      { hours: 13, minutes: 1, weekDays: ['MON', 'TUE'] },
    ];

    describe('when webos < 4', () => {
      it('should use the power API', async () => {
        time.reserveOnOffTimer = undefined;
        vi.spyOn(power, 'addOffTimer').mockResolvedValue(undefined);

        await addOffTimers(timers);

        expect(power.addOffTimer).toHaveBeenCalledWith({
          hour: 12,
          minute: 0,
          week: 0b1,
        });

        expect(power.addOffTimer).toHaveBeenCalledWith({
          hour: 13,
          minute: 1,
          week: 0b11,
        });
      });
    });

    describe('when webos >= 4', () => {
      it('should use the time API', async () => {
        power.addOffTimer = undefined;
        vi.spyOn(time, 'reserveOnOffTimer').mockResolvedValue(undefined);

        await addOffTimers(timers);

        expect(time.reserveOnOffTimer).toHaveBeenCalledWith({
          hour: 12,
          minute: 0,
          week: 0b1,
          type: 'OFFTIMER',
        });

        expect(time.reserveOnOffTimer).toHaveBeenCalledWith({
          hour: 13,
          minute: 1,
          week: 0b11,
          type: 'OFFTIMER',
        });
      });
    });
  });

  describe('getTimers', () => {
    it('should return the list of timers', async () => {
      vi.spyOn(power, 'getOnTimerList').mockResolvedValue({
        timerList: [{ hour: 12, minute: 0, week: 0b1 }],
      });
      vi.spyOn(power, 'getOffTimerList').mockResolvedValue({
        timerList: [
          { hour: 13, minute: 1, week: 0b11 },
          { hour: 14, minute: 2, week: 0b1101 },
        ],
      });

      const timers = await getTimers();

      expect(power.getOnTimerList).toHaveBeenCalled();
      expect(power.getOffTimerList).toHaveBeenCalled();
      expect(timers).toEqual({
        on: [{ hours: 12, minutes: 0, weekDays: ['MON'] }],
        off: [
          { hours: 13, minutes: 1, weekDays: ['MON', 'TUE'] },
          { hours: 14, minutes: 2, weekDays: ['MON', 'WED', 'THU'] },
        ],
      });
    });

    it('should return empty lists if api throws', async () => {
      vi.spyOn(power, 'getOnTimerList').mockRejectedValue(new Error(''));
      vi.spyOn(power, 'getOffTimerList').mockRejectedValue(new Error(''));

      const timers = await getTimers();

      expect(power.getOnTimerList).toHaveBeenCalled();
      expect(power.getOffTimerList).toHaveBeenCalled();
      expect(timers).toEqual({ on: [], off: [] });
    });
  });
});
