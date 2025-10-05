import { Component, createSignal } from 'solid-js';
import { Button, FormItem } from '@castmill/ui-common';

export const PlaylistAddForm: Component<{
  onSubmit: (name: string) => Promise<void>;
}> = (props) => {
  const [name, setName] = createSignal('');
  const [errors, setErrors] = createSignal(new Map<string, string>());
  const [isFormModified, setIsFormModified] = createSignal(false);

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
          await props.onSubmit(name());
          setIsFormModified(false);
        }
      }}
    >
      <div class="add-playlist">
        <FormItem
          label="Name"
          id="name"
          value={name()!}
          placeholder="Enter Playlist name"
          autofocus={true}
          onInput={(value: string | number | boolean) => {
            const strValue = value as string;
            setIsFormModified(true);
            setName(strValue);
            validateField('name', strValue);
          }}
        >
          <div class="error">{errors().get('name')}</div>
        </FormItem>
        <Button
          label="Create"
          type="submit"
          color="primary"
          disabled={!isFormValid()}
        />
      </div>
    </form>
  );
};
