import { Component, createSignal } from 'solid-js';
import { Button, FormItem } from '@castmill/ui-common';

type TranslateFn = (key: string, params?: Record<string, any>) => string;

export const PlaylistAddForm: Component<{
  t: TranslateFn;
  onSubmit: (name: string, teamId?: number | null) => Promise<void>;
  teamId?: number | null;
}> = (props) => {
  const [name, setName] = createSignal('');
  const [errors, setErrors] = createSignal(new Map<string, string>());
  const [isFormModified, setIsFormModified] = createSignal(false);

  const validateField = (field: string, value: string) => {
    const errorsMap = new Map(errors());
    if (value.trim() === '') {
      errorsMap.set(field, props.t('validation.fieldRequired'));
    } else if (value.length < 3) {
      errorsMap.set(field, props.t('validation.minLength', { min: 3 }));
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
          await props.onSubmit(name(), props.teamId);
          setIsFormModified(false);
        }
      }}
    >
      <div class="add-playlist">
        <FormItem
          label={props.t('common.name')}
          id="name"
          value={name()!}
          placeholder={props.t('playlists.enterPlaylistName')}
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
          label={props.t('common.create')}
          type="submit"
          color="primary"
          disabled={!isFormValid()}
        />
      </div>
    </form>
  );
};
