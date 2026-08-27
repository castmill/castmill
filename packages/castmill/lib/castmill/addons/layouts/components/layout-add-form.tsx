import { Component, createSignal, Show } from 'solid-js';
import { Button, FormItem, Dropdown } from '@castmill/ui-common';

type TranslateFn = (key: string, params?: Record<string, any>) => string;

const ASPECT_RATIO_OPTIONS = [
  { value: '16:9', label: 'aspectRatio.landscape' },
  { value: '9:16', label: 'aspectRatio.portrait' },
  { value: '4:3', label: 'aspectRatio.standard' },
  { value: '21:9', label: 'aspectRatio.ultrawide' },
  { value: '1:1', label: 'aspectRatio.square' },
  { value: 'custom', label: 'aspectRatio.custom' },
];

export interface AspectRatio {
  value: string;
}

export const LayoutAddForm: Component<{
  t: TranslateFn;
  onSubmit: (name: string, aspectRatio: AspectRatio) => Promise<boolean>;
  onCancel: () => void;
}> = (props) => {
  const [name, setName] = createSignal('');
  const [aspectRatioPreset, setAspectRatioPreset] =
    createSignal<string>('16:9');
  const [customRatio, setCustomRatio] = createSignal<string>('16:9');
  const [errors, setErrors] = createSignal(new Map<string, string>());
  const [isFormModified, setIsFormModified] = createSignal(false);
  const [isSubmitting, setIsSubmitting] = createSignal(false);

  const validateField = (field: string, value: string) => {
    const errorsMap = new Map(errors());

    if (field === 'name') {
      if (value.trim() === '') {
        errorsMap.set(field, props.t('validation.fieldRequired'));
      } else if (value.length < 3) {
        errorsMap.set(field, props.t('validation.minLength', { min: 3 }));
      } else {
        errorsMap.delete(field);
      }
    } else if (field === 'customRatio') {
      // Validate custom aspect ratio format (e.g., "16:9", "4:3")
      const ratioPattern = /^\d+:\d+$/;
      if (!ratioPattern.test(value)) {
        errorsMap.set(
          field,
          props.t('layouts.invalidAspectRatio') ||
            'Invalid format. Use width:height (e.g., 16:9)'
        );
      } else {
        const [width, height] = value.split(':').map(Number);
        if (width <= 0 || height <= 0) {
          errorsMap.set(
            field,
            props.t('layouts.invalidAspectRatio') ||
              'Width and height must be positive numbers'
          );
        } else if (width / height > 10 || height / width > 10) {
          errorsMap.set(
            field,
            props.t('layouts.extremeAspectRatio') ||
              'Aspect ratio is too extreme'
          );
        } else {
          errorsMap.delete(field);
        }
      }
    }

    setErrors(errorsMap);
  };

  const getCurrentAspectRatio = (): string => {
    if (aspectRatioPreset() === 'custom') {
      return customRatio();
    }
    return aspectRatioPreset();
  };

  const isFormValid = () => {
    const nameValue = name();
    const hasValidName = nameValue.trim() !== '' && nameValue.length >= 3;
    const hasNoErrors = errors().size === 0;

    // Check custom ratio validity
    let hasValidRatio = true;
    if (aspectRatioPreset() === 'custom') {
      const ratioPattern = /^\d+:\d+$/;
      if (!ratioPattern.test(customRatio())) {
        hasValidRatio = false;
      } else {
        const [width, height] = customRatio().split(':').map(Number);
        hasValidRatio =
          width > 0 &&
          height > 0 &&
          width / height <= 10 &&
          height / width <= 10;
      }
    }

    return hasValidName && hasValidRatio && hasNoErrors && isFormModified();
  };

  const handleSubmit = async (e: SubmitEvent) => {
    e.preventDefault();

    if (!isFormValid() || isSubmitting()) return;

    setIsSubmitting(true);
    try {
      const aspectRatio = getCurrentAspectRatio();
      const success = await props.onSubmit(name(), { value: aspectRatio });
      if (success) {
        // Reset form
        setName('');
        setAspectRatioPreset('16:9');
        setCustomRatio('16:9');
        setIsFormModified(false);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div class="add-layout">
        <FormItem
          label={props.t('common.name')}
          id="name"
          value={name()!}
          placeholder={
            props.t('layouts.enterLayoutName') || 'Enter layout name'
          }
          autofocus={true}
          onInput={(value: string | number | boolean) => {
            const strValue = value as string;
            setIsFormModified(true);
            setName(strValue);
            validateField('name', strValue);
          }}
        >
          <Show when={errors().get('name')}>
            <div class="error">{errors().get('name')}</div>
          </Show>
        </FormItem>

        <div class="form-item">
          <Dropdown
            label={props.t('layouts.aspectRatio') || 'Aspect Ratio'}
            items={ASPECT_RATIO_OPTIONS.map((preset) => ({
              value: preset.value,
              name:
                preset.value === 'custom'
                  ? props.t(preset.label) || 'Custom'
                  : preset.value,
            }))}
            value={aspectRatioPreset()}
            onSelectChange={(value) => {
              if (value) {
                setAspectRatioPreset(value);
                setIsFormModified(true);
              }
            }}
          />
        </div>

        <Show when={aspectRatioPreset() === 'custom'}>
          <FormItem
            label={
              props.t('layouts.customAspectRatio') || 'Custom Aspect Ratio'
            }
            id="customRatio"
            value={customRatio()}
            placeholder="16:9"
            onInput={(value: string | number | boolean) => {
              const strValue = String(value);
              setCustomRatio(strValue);
              setIsFormModified(true);
              validateField('customRatio', strValue);
            }}
          >
            <Show when={errors().get('customRatio')}>
              <div class="error">{errors().get('customRatio')}</div>
            </Show>
          </FormItem>
        </Show>

        <div class="form-actions">
          <Button
            label={props.t('common.cancel')}
            type="button"
            color="secondary"
            onClick={props.onCancel}
          />
          <Button
            label={
              isSubmitting()
                ? props.t('common.creating') || 'Creating...'
                : props.t('common.create')
            }
            type="submit"
            color="primary"
            disabled={!isFormValid() || isSubmitting()}
          />
        </div>
      </div>
    </form>
  );
};
