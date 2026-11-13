import { JsonPlaylist } from '@castmill/player';
import { Button, ComboBox, Modal } from '@castmill/ui-common';
import { BsCheckLg, BsX } from 'solid-icons/bs';
import { Component, createMemo, createSignal, For, onCleanup } from 'solid-js';
import { useI18n } from '../../i18n';
import { ChannelsService } from '../../services/channels.service';

import styles from './calendar-add-entry.module.scss';

export interface CalendarSlot {
  /** 0 = Monday of the visible week. */
  dayIndex: number;
  hour: number;
  minute: number;
}

/** Durations offered when adding an entry by tapping a slot (minutes). */
export const ADD_ENTRY_DURATIONS = [30, 60, 120, 240, 480];
export const DEFAULT_ADD_ENTRY_DURATION = 60;

/**
 * Duration options for a slot: the standard durations that fit before
 * midnight plus "until end of day".
 */
export const durationOptions = (slot: CalendarSlot): number[] => {
  const remaining = 24 * 60 - (slot.hour * 60 + slot.minute);
  const options = ADD_ENTRY_DURATIONS.filter((d) => d < remaining);
  return [...options, remaining];
};

export const formatSlotTime = (hour: number, minute: number) =>
  `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;

/**
 * Tap-to-add dialog: picks a duration and a playlist (from the ComboBox,
 * which becomes a bottom sheet on phones and touch tablets) for a slot.
 */
export const CalendarAddEntry: Component<{
  slot: CalendarSlot;
  /** Localized date of the slot's day. */
  dateLabel: string;
  channelsService: ChannelsService;
  /** Resolves to true when the entry was added (closes the dialog). */
  onAdd: (playlist: JsonPlaylist, durationMinutes: number) => Promise<boolean>;
  onClose: () => void;
}> = (props) => {
  const { t, locale } = useI18n();
  let disposed = false;
  onCleanup(() => {
    disposed = true;
  });

  const [playlist, setPlaylist] = createSignal<JsonPlaylist>();
  const options = createMemo(() => durationOptions(props.slot));
  const [duration, setDuration] = createSignal(
    options().includes(DEFAULT_ADD_ENTRY_DURATION)
      ? DEFAULT_ADD_ENTRY_DURATION
      : options()[options().length - 1]
  );
  const [saving, setSaving] = createSignal(false);

  const remaining = () => options()[options().length - 1];

  const durationLabel = (minutes: number) => {
    if (minutes === remaining()) {
      return t('channels.calendar.untilEndOfDay');
    }
    const hours = minutes >= 60 && minutes % 60 === 0;
    return new Intl.NumberFormat(locale(), {
      style: 'unit',
      unit: hours ? 'hour' : 'minute',
      unitDisplay: 'long',
    }).format(hours ? minutes / 60 : minutes);
  };

  const submit = async () => {
    const selected = playlist();
    if (!selected || saving()) return;
    setSaving(true);
    try {
      if (await props.onAdd(selected, duration())) {
        if (!disposed) props.onClose();
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={t('channels.calendar.addEntry')}
      description={t('channels.calendar.startsAt', {
        date: props.dateLabel,
        time: formatSlotTime(props.slot.hour, props.slot.minute),
      })}
      closeLabel={t('common.close')}
      onClose={props.onClose}
    >
      <form
        class={styles.form}
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <label class={styles.field}>
          <span class={styles.label}>{t('channels.calendar.duration')}</span>
          <select
            class={styles.select}
            value={duration()}
            onChange={(e) => setDuration(Number(e.currentTarget.value))}
          >
            <For each={options()}>
              {(minutes) => (
                <option value={minutes}>{durationLabel(minutes)}</option>
              )}
            </For>
          </select>
        </label>

        <ComboBox<JsonPlaylist>
          id="calendar-add-entry-playlist"
          closeLabel={t('common.close')}
          label={t('common.playlist')}
          placeholder={t('channels.selectPlaylist')}
          value={playlist()}
          renderItem={(item: JsonPlaylist) => <div>{item.name}</div>}
          fetchItems={(page: number, pageSize: number, search: string) =>
            props.channelsService.fetchPlaylists({
              page: { num: page, size: pageSize },
              sortOptions: { key: 'name', direction: 'ascending' },
              search,
            })
          }
          onSelect={(item: JsonPlaylist) => setPlaylist(item)}
        />

        <div class={styles.actions}>
          <Button
            label={t('common.cancel')}
            onClick={props.onClose}
            icon={BsX}
            color="secondary"
          />
          <Button
            label={t('channels.calendar.addEntry')}
            type="submit"
            disabled={!playlist() || saving()}
            loading={saving()}
            icon={BsCheckLg}
            color="primary"
          />
        </div>
      </form>
    </Modal>
  );
};
