import { Component, createSignal } from 'solid-js';
import { Button, Dropdown, FormItem } from '@castmill/ui-common';

import styles from './channel-add-form.module.scss';
import { timeZones } from './timezones';

export const ChannelAddForm: Component<{
  onSubmit: (name: string, timezone: string) => Promise<void>;
  onClose: () => void;
}> = (props) => {
  const [name, setName] = createSignal('');
  const [errors, setErrors] = createSignal(new Map<string, string>());
  const [isFormModified, setIsFormModified] = createSignal(false);

  const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const [currentTimezone, setCurrentTimezone] = createSignal(browserTimezone);

  const validateField = (field: string, value: string) => {
    const errorsMap = new Map(errors());
    if (value.trim() === '') {
      errorsMap.set(field, 'This field is required');
    } else if (value.length < 3) {
      errorsMap.set(field, 'This field must be at least 3 characters long');
    } else {
      errorsMap.delete(field);
    }
    setErrors(errorsMap);
  };

  const isFormValid = () => {
    return ![...errors().values()].some((e) => e) && isFormModified();
  };

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (isFormValid()) {
          await props.onSubmit(name(), currentTimezone());
          setIsFormModified(false);
        }
      }}
    >
      <div class="add-channel">
        <FormItem
          label="Name"
          id="name"
          value={name()!}
          placeholder="Enter Channel name"
          onInput={(value: string | number | boolean) => {
            const strValue = value as string;
            setIsFormModified(true);
            setName(strValue);
            validateField('name', strValue);
          }}
        >
          <div class="error">{errors().get('name')}</div>
        </FormItem>
        <Dropdown
          label="Timezone"
          items={timeZones.map((tz) => ({ name: tz, value: tz }))}
          defaultValue={currentTimezone()}
          onSelectChange={(value) => {
            setCurrentTimezone(value);
          }}
        ></Dropdown>

        <div class={styles['actions']}>
          <Button
            label="Create"
            type="submit"
            color="primary"
            disabled={!isFormValid()}
          />
          <Button
            label="Cancel"
            color="danger"
            onClick={() => {
              setName('');
              setIsFormModified(false);
              props.onClose();
            }}
          />
        </div>
      </div>
    </form>
  );
};
