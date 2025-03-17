import { Button, Switch } from '@castmill/ui-common';
import { CalendarEntry } from './calendar-entry.interface';
import { createSignal, onMount } from 'solid-js';
import { BsCheckLg, BsX } from 'solid-icons/bs';

import styles from './channel-entry-view.module.scss';

export const ChanneEntrylView = (props: {
  entry: CalendarEntry;
  onSubmit: (entry: Partial<CalendarEntry>) => Promise<void>;
  onClose: () => void;
}) => {
  const [isWeekly, setIsWeekly] = createSignal<boolean>();
  const [initialIsWeekly, setInitialIsWeekly] = createSignal<boolean>();
  const [isFormModified, setIsFormModified] = createSignal(false);

  const title = `${props.entry.startHour.toString().padStart(2, '0')}:${props.entry.endHour.toString().padStart(2, '0')}`;

  onMount(() => {
    setInitialIsWeekly(props.entry.weekly || false);
    setIsWeekly(initialIsWeekly());
  });

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        props.onSubmit({ ...props.entry, weekly: isWeekly() });
      }}
    >
      <div class={styles['main']}>
        <span>Playlist: {props.entry.playlist.name}</span>

        <Switch
          name="Repeat Weekly?"
          key="weekly"
          isActive={isWeekly()!}
          disabled={false}
          onToggle={() => {
            setIsWeekly(!isWeekly());
            if (initialIsWeekly() === isWeekly()) {
              setIsFormModified(false);
            } else {
              setIsFormModified(true);
            }
          }}
        />
      </div>

      <div class={styles['actions']}>
        <Button
          label="Update"
          type="submit"
          disabled={!isFormModified()}
          icon={BsCheckLg}
          color="success"
        />
        <Button
          label="Close"
          onClick={() => {
            props.onClose();
          }}
          icon={BsX}
          color="danger"
        />
      </div>
    </form>
  );
};
