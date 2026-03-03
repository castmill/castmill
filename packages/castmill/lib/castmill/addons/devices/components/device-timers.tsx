import { Component, createSignal, For, Show, onMount } from 'solid-js';
import { Device } from '../interfaces/device.interface';
import { Button, FormItem, useToast } from '@castmill/ui-common';
import { BsPlus, BsTrash } from 'solid-icons/bs';
import { DevicesService } from '../services/devices.service';

interface TimerEntry {
  hours: number;
  minutes: number;
  weekDays: WeekDay[];
}

type WeekDay = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN' | 'ALL';

interface Timers {
  on: TimerEntry[];
  off: TimerEntry[];
}

const MAX_TIMERS = 6;

const WEEKDAYS: WeekDay[] = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

export const DeviceTimers: Component<{
  baseUrl: string;
  device: Device;
  t?: (key: string, params?: Record<string, any>) => string;
}> = (props) => {
  const t = props.t || ((key: string) => key);
  const toast = useToast();

  const [loading, setLoading] = createSignal(false);
  const [onTimers, setOnTimers] = createSignal<TimerEntry[]>([]);
  const [offTimers, setOffTimers] = createSignal<TimerEntry[]>([]);
  const [isModified, setIsModified] = createSignal(false);

  // Load timers on mount
  onMount(async () => {
    await loadTimers();
  });

  const loadTimers = async () => {
    setLoading(true);
    try {
      const timers = await DevicesService.getDeviceTimers(
        props.baseUrl,
        props.device.id
      );
      setOnTimers(timers.on || []);
      setOffTimers(timers.off || []);
      setIsModified(false);
    } catch (err) {
      toast.error(t('deviceTimers.timersLoadError'));
      console.error('Error loading timers:', err);
    } finally {
      setLoading(false);
    }
  };

  const saveTimers = async () => {
    setLoading(true);
    try {
      const timers: Timers = {
        on: onTimers(),
        off: offTimers(),
      };
      await DevicesService.setDeviceTimers(
        props.baseUrl,
        props.device.id,
        timers
      );
      toast.success(t('deviceTimers.timersSaved'));
      setIsModified(false);
    } catch (err) {
      toast.error(t('deviceTimers.timersSaveError'));
      console.error('Error saving timers:', err);
    } finally {
      setLoading(false);
    }
  };

  const addOnTimer = () => {
    if (onTimers().length >= MAX_TIMERS) {
      toast.warning(t('deviceTimers.maxTimersReached'));
      return;
    }
    setOnTimers([
      ...onTimers(),
      { hours: 8, minutes: 0, weekDays: ['MON', 'TUE', 'WED', 'THU', 'FRI'] },
    ]);
    setIsModified(true);
  };

  const addOffTimer = () => {
    if (offTimers().length >= MAX_TIMERS) {
      toast.warning(t('deviceTimers.maxTimersReached'));
      return;
    }
    setOffTimers([
      ...offTimers(),
      { hours: 18, minutes: 0, weekDays: ['MON', 'TUE', 'WED', 'THU', 'FRI'] },
    ]);
    setIsModified(true);
  };

  const removeOnTimer = (index: number) => {
    setOnTimers(onTimers().filter((_, i) => i !== index));
    setIsModified(true);
  };

  const removeOffTimer = (index: number) => {
    setOffTimers(offTimers().filter((_, i) => i !== index));
    setIsModified(true);
  };

  const updateOnTimer = (
    index: number,
    field: keyof TimerEntry,
    value: any
  ) => {
    const timers = [...onTimers()];
    timers[index] = { ...timers[index], [field]: value };
    setOnTimers(timers);
    setIsModified(true);
  };

  const updateOffTimer = (
    index: number,
    field: keyof TimerEntry,
    value: any
  ) => {
    const timers = [...offTimers()];
    timers[index] = { ...timers[index], [field]: value };
    setOffTimers(timers);
    setIsModified(true);
  };

  const toggleWeekDay = (
    timers: TimerEntry[],
    index: number,
    day: WeekDay,
    isOn: boolean
  ) => {
    const timer = timers[index];
    let newWeekDays: WeekDay[];

    if (day === 'ALL') {
      newWeekDays = isOn ? WEEKDAYS : [];
    } else {
      newWeekDays = isOn
        ? [...timer.weekDays, day]
        : timer.weekDays.filter((d) => d !== day);
    }

    return newWeekDays;
  };

  const TimerRow: Component<{
    timer: TimerEntry;
    index: number;
    onUpdate: (index: number, field: keyof TimerEntry, value: any) => void;
    onRemove: (index: number) => void;
    type: 'on' | 'off';
  }> = (rowProps) => {
    const isWeekDaySelected = (day: WeekDay) => {
      if (day === 'ALL') {
        return WEEKDAYS.every((d) => rowProps.timer.weekDays.includes(d));
      }
      return rowProps.timer.weekDays.includes(day);
    };

    const handleWeekDayToggle = (day: WeekDay, checked: boolean) => {
      const timers =
        rowProps.type === 'on' ? onTimers() : offTimers();
      const newWeekDays = toggleWeekDay(timers, rowProps.index, day, checked);
      rowProps.onUpdate(rowProps.index, 'weekDays', newWeekDays);
    };

    return (
      <div style="display: flex; gap: 1em; align-items: center; margin-bottom: 1em; padding: 1em; border: 1px solid #e0e0e0; border-radius: 4px;">
        <div style="display: flex; gap: 0.5em; align-items: center;">
          <input
            type="number"
            min="0"
            max="23"
            value={rowProps.timer.hours}
            onInput={(e) =>
              rowProps.onUpdate(
                rowProps.index,
                'hours',
                parseInt(e.currentTarget.value) || 0
              )
            }
            style="width: 4em; padding: 0.5em;"
          />
          <span>:</span>
          <input
            type="number"
            min="0"
            max="59"
            value={rowProps.timer.minutes}
            onInput={(e) =>
              rowProps.onUpdate(
                rowProps.index,
                'minutes',
                parseInt(e.currentTarget.value) || 0
              )
            }
            style="width: 4em; padding: 0.5em;"
          />
        </div>

        <div style="display: flex; gap: 0.5em; flex-wrap: wrap;">
          <label style="display: flex; align-items: center; gap: 0.3em; cursor: pointer;">
            <input
              type="checkbox"
              checked={isWeekDaySelected('ALL')}
              onChange={(e) =>
                handleWeekDayToggle('ALL', e.currentTarget.checked)
              }
            />
            <span>{t('deviceTimers.allDays')}</span>
          </label>
          <For each={WEEKDAYS}>
            {(day) => (
              <label style="display: flex; align-items: center; gap: 0.3em; cursor: pointer;">
                <input
                  type="checkbox"
                  checked={isWeekDaySelected(day)}
                  onChange={(e) =>
                    handleWeekDayToggle(day, e.currentTarget.checked)
                  }
                  disabled={isWeekDaySelected('ALL')}
                />
                <span>{t(`deviceTimers.${day.toLowerCase()}`)}</span>
              </label>
            )}
          </For>
        </div>

        <Button
          icon={BsTrash}
          onClick={() => rowProps.onRemove(rowProps.index)}
          color="danger"
          label=""
          style={{ 'margin-left': 'auto' }}
        />
      </div>
    );
  };

  return (
    <div style="padding: 1em;">
      <h3>{t('deviceTimers.title')}</h3>
      <p style="color: #666; margin-bottom: 2em;">
        {t('deviceTimers.description')}
      </p>

      <div style="margin-bottom: 2em;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1em;">
          <h4>{t('deviceTimers.onTimers')}</h4>
          <Button
            icon={BsPlus}
            onClick={addOnTimer}
            color="primary"
            label={t('deviceTimers.addOnTimer')}
            disabled={onTimers().length >= MAX_TIMERS}
          />
        </div>
        <Show
          when={onTimers().length > 0}
          fallback={
            <div style="color: #999; font-style: italic;">
              {t('deviceTimers.noTimers')}
            </div>
          }
        >
          <For each={onTimers()}>
            {(timer, index) => (
              <TimerRow
                timer={timer}
                index={index()}
                onUpdate={updateOnTimer}
                onRemove={removeOnTimer}
                type="on"
              />
            )}
          </For>
        </Show>
      </div>

      <div style="margin-bottom: 2em;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1em;">
          <h4>{t('deviceTimers.offTimers')}</h4>
          <Button
            icon={BsPlus}
            onClick={addOffTimer}
            color="primary"
            label={t('deviceTimers.addOffTimer')}
            disabled={offTimers().length >= MAX_TIMERS}
          />
        </div>
        <Show
          when={offTimers().length > 0}
          fallback={
            <div style="color: #999; font-style: italic;">
              {t('deviceTimers.noTimers')}
            </div>
          }
        >
          <For each={offTimers()}>
            {(timer, index) => (
              <TimerRow
                timer={timer}
                index={index()}
                onUpdate={updateOffTimer}
                onRemove={removeOffTimer}
                type="off"
              />
            )}
          </For>
        </Show>
      </div>

      <div style="display: flex; gap: 1em;">
        <Button
          onClick={saveTimers}
          color="primary"
          label={t('deviceTimers.saveTimers')}
          disabled={!isModified() || loading()}
        />
        <Button
          onClick={loadTimers}
          label={t('common.reset')}
          disabled={!isModified() || loading()}
        />
      </div>

      <Show when={loading()}>
        <div style="margin-top: 1em; color: #666;">
          {t('common.loading')}
        </div>
      </Show>
    </div>
  );
};
