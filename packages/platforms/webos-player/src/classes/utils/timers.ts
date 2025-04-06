import { TimerEntry, Timers } from '@castmill/device';
import { time, power } from '../../native';

export const DEFAULT_INPUT_SOURCE = 'ext://hdmi:1';

interface WebosTimer {
  hour: number;
  minute: number;
  week: number;
  inputSource?: string;
}

export const toWebosWeekDays = (week: TimerEntry['weekDays']) => {
  return week.reduce((acc, day) => {
    switch (day) {
      case 'MON':
        return acc | 0b1;
      case 'TUE':
        return acc | 0b10;
      case 'WED':
        return acc | 0b100;
      case 'THU':
        return acc | 0b1000;
      case 'FRI':
        return acc | 0b10000;
      case 'SAT':
        return acc | 0b100000;
      case 'SUN':
        return acc | 0b1000000;
      default:
        return acc;
    }
  }, 0b0);
};

export const toTimerWeekDays = (week: number): TimerEntry['weekDays'] => {
  const days: TimerEntry['weekDays'] = [
    'MON',
    'TUE',
    'WED',
    'THU',
    'FRI',
    'SAT',
    'SUN',
  ];
  return days.filter((day, index) => week & (1 << index));
};

const toWebosTimer = (timer: TimerEntry): WebosTimer => {
  const week = toWebosWeekDays(timer.weekDays);

  return {
    hour: timer.hours,
    minute: timer.minutes,
    week,
  };
};

const addOnTimer = (timer: TimerEntry) => {
  const webosTimer = {
    ...toWebosTimer(timer),
    inputSource: DEFAULT_INPUT_SOURCE,
  };

  if (time.reserveOnOffTimer) {
    // webos >= 4, scap 1.7
    return time.reserveOnOffTimer({
      ...webosTimer,
      type: 'ONTIMER',
    });
  } else {
    // webos < 4, scap 1.5
    return power.addOnTimer?.(webosTimer);
  }
};

const addOffTimer = (timer: TimerEntry) => {
  const webosTimer = toWebosTimer(timer);

  if (time.reserveOnOffTimer) {
    // webos >= 4, scap 1.7
    return time.reserveOnOffTimer({
      ...webosTimer,
      type: 'OFFTIMER',
    });
  } else {
    // webos < 4, scap 1.5
    return power.addOffTimer?.(webosTimer);
  }
};

export const addOnTimers = async (list: TimerEntry[]): Promise<void> => {
  if (list.length === 0) {
    return;
  }

  const [first, ...rest] = list;

  await addOnTimer(first);
  return addOnTimers(rest);
};

export const addOffTimers = async (list: TimerEntry[]): Promise<void> => {
  if (list.length === 0) {
    return;
  }

  const [first, ...rest] = list;

  await addOffTimer(first);
  return addOffTimers(rest);
};

export const clearAllTimers = () => {
  if (time.clearAllOnOffTimers) {
    // webos >= 4, scap 1.7
    return time.clearAllOnOffTimers();
  } else {
    // webos < 4, scap 1.5
    return Promise.all([
      power.enableAllOnTimer?.({
        allOnTimer: true,
        clearOnTimer: true,
      }),
      power.enableAllOffTimer?.({
        allOffTimer: true,
        clearOffTimer: true,
      }),
    ]);
  }
};

const getOnTimers = async (): Promise<TimerEntry[]> => {
  try {
    const { timerList } = await power.getOnTimerList();

    return timerList.map((timer) => {
      return {
        hours: timer.hour,
        minutes: timer.minute,
        weekDays: toTimerWeekDays(timer.week),
      };
    });
  } catch {
    return [];
  }
};

const getOffTimers = async (): Promise<TimerEntry[]> => {
  try {
    const { timerList } = await power.getOffTimerList();

    return timerList.map((timer) => {
      return {
        hours: timer.hour,
        minutes: timer.minute,
        weekDays: toTimerWeekDays(timer.week),
      };
    });
  } catch {
    return [];
  }
};

export const getTimers = async (): Promise<Timers> => {
  return {
    on: await getOnTimers(),
    off: await getOffTimers(),
  };
};

export const setTimers = async (timers: Timers): Promise<void> => {
  await clearAllTimers();
  await addOnTimers(timers.on);
  await addOffTimers(timers.off);
};
