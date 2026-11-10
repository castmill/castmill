import {
  Component,
  For,
  Show,
  createEffect,
  createSignal,
  on,
  onCleanup,
} from 'solid-js';
import { AiOutlineDelete, AiOutlinePlus } from 'solid-icons/ai';

import { useI18n } from '../../../i18n';
import {
  AutomationsService,
  ClockConfig,
  ClockScheduleType,
  IsoWeekday,
} from '../../../services/automations.service';
import { timeZones } from '../../channels-page/timezones';
import type { TypeEditorProps } from '../registry-types';
import {
  ALL_WEEKDAYS,
  MAX_TIMES,
  MIN_INTERVAL_MINUTES,
  browserTimeZone,
  defaultSchedule,
  todayIso,
  validateClock,
  weekdayName,
} from './clock-logic';

import styles from '../automations.module.scss';

export const PREVIEW_DEBOUNCE_MS = 300;
export const PREVIEW_COUNT = 10;

const SCHEDULE_TYPES: ClockScheduleType[] = [
  'hourly',
  'interval',
  'times',
  'once',
];

const toInt = (value: string) => (value === '' ? NaN : Number(value));

export const ClockEditor: Component<TypeEditorProps<ClockConfig>> = (props) => {
  const { t, locale } = useI18n();
  const id = `clock-${Math.random().toString(36).slice(2, 8)}`;

  const update = (patch: Partial<ClockConfig>) =>
    props.onChange({ ...props.config, ...patch });

  const schedule = () => props.config.schedule;
  const isOnce = () => schedule().type === 'once';

  const setScheduleType = (type: ClockScheduleType) => {
    if (type === schedule().type) return;
    update({ schedule: defaultSchedule(type) });
  };

  const onScheduleKeyDown = (event: KeyboardEvent) => {
    const index = SCHEDULE_TYPES.indexOf(schedule().type);
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[
      event.key
    ];
    if (!step) return;
    event.preventDefault();
    const next =
      SCHEDULE_TYPES[
        (index + step + SCHEDULE_TYPES.length) % SCHEDULE_TYPES.length
      ];
    setScheduleType(next);
    (
      (event.currentTarget as HTMLElement).parentElement?.querySelector(
        `[data-value="${next}"]`
      ) as HTMLElement | null
    )?.focus();
  };

  const selectedDays = () => props.config.weekdays ?? ALL_WEEKDAYS;

  const toggleDay = (day: IsoWeekday) => {
    const current = selectedDays();
    const next = current.includes(day)
      ? current.filter((d) => d !== day)
      : ([...current, day].sort((a, b) => a - b) as IsoWeekday[]);
    update({ weekdays: next.length === 7 ? null : next });
  };

  const times = () =>
    schedule().type === 'times'
      ? (schedule() as { times: string[] }).times
      : [];

  const setTimes = (next: string[]) =>
    update({ schedule: { type: 'times', times: next } });

  // ---- Live preview -------------------------------------------------------
  const [preview, setPreview] = createSignal<{
    timezone: string;
    occurrences: string[];
  } | null>(null);
  const [previewLoading, setPreviewLoading] = createSignal(false);
  const [previewError, setPreviewError] = createSignal(false);
  let previewTimer: ReturnType<typeof setTimeout> | undefined;
  let previewSequence = 0;

  const previewTimeZone = () => props.config.timezone || browserTimeZone();

  const loadPreview = async (config: ClockConfig, sequence: number) => {
    setPreviewLoading(true);
    try {
      const result = await AutomationsService.preview(props.organizationId, {
        when: { source: 'clock', condition: 'at', config },
        timezone: config.timezone || browserTimeZone(),
        count: PREVIEW_COUNT,
      });
      if (sequence !== previewSequence) return;
      setPreview(result);
      setPreviewError(false);
    } catch {
      if (sequence !== previewSequence) return;
      setPreview(null);
      setPreviewError(true);
    } finally {
      if (sequence === previewSequence) setPreviewLoading(false);
    }
  };

  createEffect(
    on(
      () => JSON.stringify(props.config),
      () => {
        clearTimeout(previewTimer);
        const sequence = ++previewSequence;
        const config = props.config;
        if (validateClock(config).length > 0) {
          setPreview(null);
          setPreviewLoading(false);
          return;
        }
        previewTimer = setTimeout(
          () => loadPreview(config, sequence),
          PREVIEW_DEBOUNCE_MS
        );
      }
    )
  );
  onCleanup(() => {
    clearTimeout(previewTimer);
    previewSequence++;
  });

  const formatOccurrence = (value: string, timeZone: string) => {
    try {
      return new Intl.DateTimeFormat(locale(), {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        timeZone,
      }).format(new Date(value));
    } catch {
      return new Date(value).toLocaleString(locale());
    }
  };

  return (
    <div class={styles.editor} data-testid="clock-editor">
      <div class={styles.field}>
        <span class={styles.fieldLabel} id={`${id}-schedule`}>
          {t('automations.clock.repeat')}
        </span>
        <div
          class={styles.segmented}
          role="radiogroup"
          aria-labelledby={`${id}-schedule`}
        >
          <For each={SCHEDULE_TYPES}>
            {(type) => (
              <button
                type="button"
                role="radio"
                data-value={type}
                aria-checked={schedule().type === type}
                tabIndex={schedule().type === type ? 0 : -1}
                classList={{ [styles.active]: schedule().type === type }}
                onClick={() => setScheduleType(type)}
                onKeyDown={onScheduleKeyDown}
              >
                {t(`automations.clock.types.${type}`)}
              </button>
            )}
          </For>
        </div>
      </div>

      <Show when={schedule().type === 'hourly'}>
        <label class={styles.field}>
          <span class={styles.fieldLabel}>{t('automations.clock.minute')}</span>
          <input
            type="number"
            min="0"
            max="59"
            value={(schedule() as { minute: number }).minute}
            onInput={(e) =>
              update({
                schedule: {
                  type: 'hourly',
                  minute: toInt(e.currentTarget.value),
                },
              })
            }
          />
        </label>
      </Show>

      <Show when={schedule().type === 'interval'}>
        <label class={styles.field}>
          <span class={styles.fieldLabel}>
            {t('automations.clock.everyMinutes')}
          </span>
          <input
            type="number"
            min={MIN_INTERVAL_MINUTES}
            value={(schedule() as { every_minutes: number }).every_minutes}
            onInput={(e) =>
              update({
                schedule: {
                  type: 'interval',
                  every_minutes: toInt(e.currentTarget.value),
                },
              })
            }
          />
          <span class={styles.hint}>
            {t('automations.clock.intervalHint', {
              min: MIN_INTERVAL_MINUTES,
            })}
          </span>
        </label>
      </Show>

      <Show when={schedule().type === 'times'}>
        <div class={styles.field}>
          <span class={styles.fieldLabel}>{t('automations.clock.times')}</span>
          <ul class={styles.timeList}>
            <For each={times()}>
              {(time, index) => (
                <li>
                  <input
                    type="time"
                    value={time}
                    aria-label={t('automations.clock.timeN', {
                      n: index() + 1,
                    })}
                    onInput={(e) => {
                      const next = [...times()];
                      next[index()] = e.currentTarget.value;
                      setTimes(next);
                    }}
                  />
                  <button
                    type="button"
                    class={styles.iconButton}
                    title={t('automations.clock.removeTime')}
                    aria-label={t('automations.clock.removeTimeN', {
                      time,
                    })}
                    disabled={times().length <= 1}
                    onClick={() =>
                      setTimes(times().filter((_, i) => i !== index()))
                    }
                  >
                    <AiOutlineDelete />
                  </button>
                </li>
              )}
            </For>
          </ul>
          <button
            type="button"
            class={styles.linkButton}
            disabled={times().length >= MAX_TIMES}
            onClick={() => {
              const last = times()[times().length - 1];
              const [h, m] = (last || '07:00').split(':').map(Number);
              const nextHour = Number.isFinite(h) ? Math.min(h + 1, 23) : 8;
              setTimes([
                ...times(),
                `${String(nextHour).padStart(2, '0')}:${String(
                  Number.isFinite(m) ? m : 0
                ).padStart(2, '0')}`,
              ]);
            }}
          >
            <AiOutlinePlus /> {t('automations.clock.addTime')}
          </button>
        </div>
      </Show>

      <Show when={schedule().type === 'once'}>
        <div class={styles.inline}>
          <label class={styles.field}>
            <span class={styles.fieldLabel}>{t('automations.clock.date')}</span>
            <input
              type="date"
              value={(schedule() as { date: string }).date}
              min={todayIso()}
              onInput={(e) =>
                update({
                  schedule: {
                    ...(schedule() as {
                      type: 'once';
                      date: string;
                      time: string;
                    }),
                    date: e.currentTarget.value,
                  },
                })
              }
            />
          </label>
          <label class={styles.field}>
            <span class={styles.fieldLabel}>{t('automations.clock.time')}</span>
            <input
              type="time"
              value={(schedule() as { time: string }).time}
              onInput={(e) =>
                update({
                  schedule: {
                    ...(schedule() as {
                      type: 'once';
                      date: string;
                      time: string;
                    }),
                    time: e.currentTarget.value,
                  },
                })
              }
            />
          </label>
        </div>
      </Show>

      <Show when={!isOnce()}>
        <div class={styles.field}>
          <span class={styles.fieldLabel} id={`${id}-days`}>
            {t('automations.clock.weekdays')}
          </span>
          <div class={styles.chips} role="group" aria-labelledby={`${id}-days`}>
            <For each={ALL_WEEKDAYS}>
              {(day) => (
                <button
                  type="button"
                  class={styles.chip}
                  classList={{ [styles.active]: selectedDays().includes(day) }}
                  aria-pressed={selectedDays().includes(day)}
                  onClick={() => toggleDay(day)}
                >
                  {weekdayName(day, locale())}
                </button>
              )}
            </For>
          </div>
        </div>

        <div class={styles.field}>
          <label class={styles.checkbox}>
            <input
              type="checkbox"
              checked={!!props.config.window}
              onChange={(e) =>
                update({
                  window: e.currentTarget.checked
                    ? { start: '08:00', end: '18:00' }
                    : null,
                })
              }
            />
            {t('automations.clock.window')}
          </label>
          <Show when={props.config.window}>
            {(window) => (
              <div class={styles.inline}>
                <label class={styles.field}>
                  <span class={styles.fieldLabel}>
                    {t('automations.clock.from')}
                  </span>
                  <input
                    type="time"
                    value={window().start}
                    onInput={(e) =>
                      update({
                        window: { ...window(), start: e.currentTarget.value },
                      })
                    }
                  />
                </label>
                <label class={styles.field}>
                  <span class={styles.fieldLabel}>
                    {t('automations.clock.to')}
                  </span>
                  <input
                    type="time"
                    value={window().end}
                    onInput={(e) =>
                      update({
                        window: { ...window(), end: e.currentTarget.value },
                      })
                    }
                  />
                </label>
              </div>
            )}
          </Show>
        </div>

        <div class={styles.field}>
          <label class={styles.checkbox}>
            <input
              type="checkbox"
              checked={!!props.config.dates}
              onChange={(e) =>
                update({
                  dates: e.currentTarget.checked
                    ? { start: todayIso(), end: null }
                    : null,
                })
              }
            />
            {t('automations.clock.dates')}
          </label>
          <Show when={props.config.dates}>
            {(dates) => (
              <div class={styles.inline}>
                <label class={styles.field}>
                  <span class={styles.fieldLabel}>
                    {t('automations.clock.startDate')}
                  </span>
                  <input
                    type="date"
                    value={dates().start || ''}
                    onInput={(e) =>
                      update({
                        dates: {
                          ...dates(),
                          start: e.currentTarget.value || null,
                        },
                      })
                    }
                  />
                </label>
                <label class={styles.field}>
                  <span class={styles.fieldLabel}>
                    {t('automations.clock.endDate')}
                  </span>
                  <input
                    type="date"
                    value={dates().end || ''}
                    onInput={(e) =>
                      update({
                        dates: {
                          ...dates(),
                          end: e.currentTarget.value || null,
                        },
                      })
                    }
                  />
                </label>
              </div>
            )}
          </Show>
        </div>
      </Show>

      <label class={styles.field}>
        <span class={styles.fieldLabel}>{t('automations.clock.timezone')}</span>
        <input
          type="text"
          list={`${id}-timezones`}
          value={props.config.timezone || ''}
          placeholder={t('automations.clock.timezonePlaceholder')}
          onInput={(e) =>
            update({ timezone: e.currentTarget.value.trim() || null })
          }
        />
        <datalist id={`${id}-timezones`}>
          <For each={timeZones}>{(zone) => <option value={zone} />}</For>
        </datalist>
        <span class={styles.hint}>{t('automations.clock.timezoneHint')}</span>
      </label>

      <Show when={props.errors.length > 0}>
        <ul class={styles.errors} role="alert">
          <For each={props.errors}>{(error) => <li>{t(error)}</li>}</For>
        </ul>
      </Show>

      <section
        class={styles.preview}
        aria-live="polite"
        aria-busy={previewLoading()}
        data-testid="clock-preview"
      >
        <h4>{t('automations.clock.previewTitle')}</h4>
        <p class={styles.hint}>
          {props.config.timezone
            ? t('automations.clock.previewTimezone', {
                timezone: props.config.timezone,
              })
            : t('automations.clock.previewDeviceTimezone', {
                timezone: previewTimeZone(),
              })}
        </p>
        <Show when={previewError()}>
          <p class={styles.hint}>{t('automations.clock.previewFailed')}</p>
        </Show>
        <Show when={preview()}>
          {(result) => (
            <Show
              when={result().occurrences.length > 0}
              fallback={
                <p class={styles.hint}>{t('automations.clock.previewEmpty')}</p>
              }
            >
              <ol class={styles.previewList}>
                <For each={result().occurrences}>
                  {(occurrence) => (
                    <li>
                      <time dateTime={occurrence}>
                        {formatOccurrence(
                          occurrence,
                          result().timezone || previewTimeZone()
                        )}
                      </time>
                    </li>
                  )}
                </For>
              </ol>
            </Show>
          )}
        </Show>
      </section>
    </div>
  );
};
