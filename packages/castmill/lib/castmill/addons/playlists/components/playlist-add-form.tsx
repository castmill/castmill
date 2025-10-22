import { Component, createSignal, Show } from 'solid-js';
import { Button, FormItem, Dropdown } from '@castmill/ui-common';
import { ASPECT_RATIO_OPTIONS } from '../constants';
import {
  validateCustomRatioField,
  validateAspectRatioExtreme as validateAspectRatioExtremeUtil,
  isValidAspectRatio,
} from '../utils/aspect-ratio-validation';

type TranslateFn = (key: string, params?: Record<string, any>) => string;

export interface AspectRatio {
  width: number;
  height: number;
}

export const PlaylistAddForm: Component<{
  t: TranslateFn;
  onSubmit: (
    name: string,
    aspectRatio: AspectRatio,
    teamId?: number | null
  ) => Promise<void>;
  teamId?: number | null;
}> = (props) => {
  const [name, setName] = createSignal('');
  const [aspectRatioPreset, setAspectRatioPreset] =
    createSignal<string>('16:9');
  const [customWidth, setCustomWidth] = createSignal<string>('16');
  const [customHeight, setCustomHeight] = createSignal<string>('9');
  const [errors, setErrors] = createSignal(new Map<string, string>());
  const [isFormModified, setIsFormModified] = createSignal(false);

  const validateField = (field: string, value: string) => {
    if (field === 'name') {
      const errorsMap = new Map(errors());
      if (value.trim() === '') {
        errorsMap.set(field, props.t('validation.fieldRequired'));
      } else if (value.length < 3) {
        errorsMap.set(field, props.t('validation.minLength', { min: 3 }));
      } else {
        errorsMap.delete(field);
      }
      setErrors(errorsMap);
    } else if (field === 'customWidth' || field === 'customHeight') {
      const errorsMap = validateCustomRatioField(
        field,
        value,
        props.t,
        errors()
      );
      setErrors(errorsMap);
    }
  };

  const validateAspectRatioExtreme = () => {
    if (aspectRatioPreset() === 'custom') {
      const result = validateAspectRatioExtremeUtil(
        customWidth(),
        customHeight(),
        props.t,
        errors()
      );
      setErrors(result.errors);
      return result.isValid;
    } else {
      const errorsMap = new Map(errors());
      errorsMap.delete('aspectRatio');
      setErrors(errorsMap);
    }
    return true;
  };

  const getCurrentAspectRatio = (): AspectRatio => {
    if (aspectRatioPreset() === 'custom') {
      return {
        width: parseInt(customWidth(), 10) || 16,
        height: parseInt(customHeight(), 10) || 9,
      };
    } else {
      const preset = ASPECT_RATIO_OPTIONS.find(
        (p) => p.value === aspectRatioPreset()
      );
      return {
        width: preset?.width || 16,
        height: preset?.height || 9,
      };
    }
  };

  // Computed signal for form validity - doesn't trigger validation, just checks current state
  const isFormValid = () => {
    // Check if name is valid
    const nameValue = name();
    const hasValidName = nameValue.trim() !== '' && nameValue.length >= 3;

    // Check if aspect ratio is valid (only for custom)
    let hasValidAspectRatio = true;
    if (aspectRatioPreset() === 'custom') {
      hasValidAspectRatio = isValidAspectRatio(customWidth(), customHeight());
    }

    // Check there are no current errors and form has been modified
    const hasNoErrors = ![...errors().values()].some((e) => e);

    return (
      hasValidName && hasValidAspectRatio && hasNoErrors && isFormModified()
    );
  };

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        // Validate before submission
        validateField('name', name());
        validateAspectRatioExtreme();

        if (isFormValid()) {
          const aspectRatio = getCurrentAspectRatio();
          await props.onSubmit(name(), aspectRatio, props.teamId);
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

        <div class="form-item">
          <Dropdown
            label={props.t('playlists.aspectRatio')}
            items={ASPECT_RATIO_OPTIONS.map((preset) => ({
              value: preset.value,
              name: props.t(preset.label),
            }))}
            value={aspectRatioPreset()}
            onSelectChange={(value) => {
              if (value) {
                setAspectRatioPreset(value);
                setIsFormModified(true);
                validateAspectRatioExtreme();
              }
            }}
          />
        </div>

        <Show when={aspectRatioPreset() === 'custom'}>
          <div class="custom-aspect-ratio">
            <FormItem
              label={props.t('playlists.aspectRatioWidth')}
              id="customWidth"
              value={customWidth()}
              placeholder="16"
              type="number"
              onInput={(value: string | number | boolean) => {
                const strValue = String(value);
                setCustomWidth(strValue);
                setIsFormModified(true);
                validateField('customWidth', strValue);
                validateAspectRatioExtreme();
              }}
            >
              <div class="error">{errors().get('customWidth')}</div>
            </FormItem>
            <span class="separator">:</span>
            <FormItem
              label={props.t('playlists.aspectRatioHeight')}
              id="customHeight"
              value={customHeight()}
              placeholder="9"
              type="number"
              onInput={(value: string | number | boolean) => {
                const strValue = String(value);
                setCustomHeight(strValue);
                setIsFormModified(true);
                validateField('customHeight', strValue);
                validateAspectRatioExtreme();
              }}
            >
              <div class="error">{errors().get('customHeight')}</div>
            </FormItem>
          </div>
          <Show when={errors().get('aspectRatio')}>
            <div class="error aspect-ratio-error">
              {errors().get('aspectRatio')}
            </div>
          </Show>
        </Show>

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
