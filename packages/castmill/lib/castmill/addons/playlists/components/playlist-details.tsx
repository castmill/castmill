import { createSignal, createEffect, For, Show } from 'solid-js';

import { Button, FormItem, Timestamp, Dropdown } from '@castmill/ui-common';

import { BsCheckLg, BsX } from 'solid-icons/bs';
import { JsonPlaylist } from '@castmill/player';
import { PlaylistUpdate } from '../services/playlists.service';
import { AddonStore } from '../../common/interfaces/addon-store';

import './playlist-details.scss';

// Common aspect ratios for digital signage
const ASPECT_RATIO_PRESETS = [
  { value: '16:9', name: '16:9 (Landscape)', width: 16, height: 9 },
  { value: '9:16', name: '9:16 (Portrait)', width: 9, height: 16 },
  { value: '4:3', name: '4:3 (Classic)', width: 4, height: 3 },
  { value: '3:4', name: '3:4 (Portrait)', width: 3, height: 4 },
  { value: '21:9', name: '21:9 (Ultrawide)', width: 21, height: 9 },
  { value: '1:1', name: '1:1 (Square)', width: 1, height: 1 },
  { value: 'custom', name: 'Custom', width: 0, height: 0 },
];

export const PlaylistDetails = (props: {
  playlist: JsonPlaylist;
  store?: AddonStore;
  onSubmit: (playlistUpdate: Partial<PlaylistUpdate>) => Promise<boolean>;
}) => {
  // Get i18n functions from store
  const t = (key: string, params?: Record<string, any>) =>
    props.store?.i18n?.t(key, params) || key;

  const [name, setName] = createSignal(props.playlist.name);

  // Initialize aspect ratio from playlist settings
  const initialAspectRatio = props.playlist.settings?.aspect_ratio;
  const initialPreset = ASPECT_RATIO_PRESETS.find(
    (preset) =>
      preset.width === initialAspectRatio?.width &&
      preset.height === initialAspectRatio?.height
  );

  const [aspectRatioPreset, setAspectRatioPreset] = createSignal<string>(
    initialPreset?.value || (initialAspectRatio ? 'custom' : '16:9')
  );
  const [customWidth, setCustomWidth] = createSignal<string>(
    initialAspectRatio && !initialPreset
      ? String(initialAspectRatio.width)
      : '16'
  );
  const [customHeight, setCustomHeight] = createSignal<string>(
    initialAspectRatio && !initialPreset
      ? String(initialAspectRatio.height)
      : '9'
  );

  const [isFormModified, setIsFormModified] = createSignal(false);
  const [errors, setErrors] = createSignal(new Map());

  const validateField = (fieldId: string, value: string) => {
    let error = '';
    switch (fieldId) {
      case 'name':
        if (!value) {
          error = t('playlists.errors.nameRequired');
        } else if (value.length < 3) {
          error = t('playlists.errors.nameMinLength');
        }
        break;
      case 'customWidth':
      case 'customHeight':
        const num = parseInt(value, 10);
        if (!value || isNaN(num)) {
          error = t('playlists.errors.aspectRatioNumber');
        } else if (num <= 0) {
          error = t('playlists.errors.aspectRatioPositive');
        } else if (num > 100) {
          error = t('playlists.errors.aspectRatioMax');
        }
        break;
      default:
        error = '';
    }

    setErrors((prev) => new Map(prev).set(fieldId, error));
    return !error;
  };

  const validateAspectRatioExtreme = () => {
    if (aspectRatioPreset() === 'custom') {
      const width = parseInt(customWidth(), 10);
      const height = parseInt(customHeight(), 10);

      if (!isNaN(width) && !isNaN(height) && width > 0 && height > 0) {
        const ratio = width / height;
        if (ratio > 10 || ratio < 0.1) {
          setErrors(
            (prev) =>
              new Map(prev).set(
                'aspectRatio',
                t('playlists.errors.aspectRatioExtreme')
              )
          );
          return false;
        } else {
          setErrors((prev) => {
            const newErrors = new Map(prev);
            newErrors.delete('aspectRatio');
            return newErrors;
          });
        }
      }
    } else {
      setErrors((prev) => {
        const newErrors = new Map(prev);
        newErrors.delete('aspectRatio');
        return newErrors;
      });
    }
    return true;
  };

  createEffect(() => {
    const hasModifiedName = name() !== props.playlist.name;

    // Check if aspect ratio has changed
    const currentAspectRatio = getCurrentAspectRatio();
    const originalAspectRatio = props.playlist.settings?.aspect_ratio;

    const hasModifiedAspectRatio =
      currentAspectRatio.width !== (originalAspectRatio?.width || 16) ||
      currentAspectRatio.height !== (originalAspectRatio?.height || 9);

    setIsFormModified(hasModifiedName || hasModifiedAspectRatio);
  });

  const getCurrentAspectRatio = () => {
    if (aspectRatioPreset() === 'custom') {
      return {
        width: parseInt(customWidth(), 10) || 16,
        height: parseInt(customHeight(), 10) || 9,
      };
    } else {
      const preset = ASPECT_RATIO_PRESETS.find(
        (p) => p.value === aspectRatioPreset()
      );
      return {
        width: preset?.width || 16,
        height: preset?.height || 9,
      };
    }
  };

  const isFormValid = () => {
    validateAspectRatioExtreme();
    return ![...errors().values()].some((e) => e) && isFormModified();
  };

  return (
    <div class="playlist-details">
      <div class="info">
        {t('common.addedOn')}{' '}
        <Timestamp value={props.playlist.inserted_at} mode="relative" />.{' '}
        {t('common.lastUpdatedOn')}{' '}
        <Timestamp value={props.playlist.updated_at} mode="relative" />.
      </div>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (isFormValid()) {
            const aspectRatio = getCurrentAspectRatio();
            if (
              await props.onSubmit({
                name: name(),
                description: '',
                settings: {
                  aspect_ratio: aspectRatio,
                },
              })
            ) {
              setIsFormModified(false);
            }
          }
        }}
      >
        <div class="form-inputs">
          <FormItem
            label={t('common.name')}
            id="name"
            value={name()}
            placeholder={t('playlists.enterPlaylistName')}
            onInput={(value: string) => {
              setName(value);
              validateField('name', value);
            }}
          >
            <div class="error">{errors().get('name')}</div>
          </FormItem>

          <div class="form-item">
            <Dropdown
              label={t('playlists.aspectRatio')}
              items={ASPECT_RATIO_PRESETS.map((preset) => ({
                value: preset.value,
                name: preset.name,
              }))}
              value={aspectRatioPreset()}
              onSelectChange={(value) => {
                if (value) {
                  setAspectRatioPreset(value);
                  validateAspectRatioExtreme();
                }
              }}
            />
          </div>

          <Show when={aspectRatioPreset() === 'custom'}>
            <div class="custom-aspect-ratio">
              <FormItem
                label={t('playlists.aspectRatioWidth')}
                id="customWidth"
                value={customWidth()}
                placeholder="16"
                type="number"
                onInput={(value: string) => {
                  setCustomWidth(value);
                  validateField('customWidth', value);
                  validateAspectRatioExtreme();
                }}
              >
                <div class="error">{errors().get('customWidth')}</div>
              </FormItem>
              <span class="separator">:</span>
              <FormItem
                label={t('playlists.aspectRatioHeight')}
                id="customHeight"
                value={customHeight()}
                placeholder="9"
                type="number"
                onInput={(value: string) => {
                  setCustomHeight(value);
                  validateField('customHeight', value);
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
        </div>

        <div class="actions">
          <Button
            label={t('common.update')}
            type="submit"
            disabled={!isFormValid()}
            icon={BsCheckLg}
            color="success"
          />
          <Button
            label={t('common.reset')}
            onClick={() => {
              setName(props.playlist.name);
              const initialAspectRatio = props.playlist.settings?.aspect_ratio;
              const initialPreset = ASPECT_RATIO_PRESETS.find(
                (preset) =>
                  preset.width === initialAspectRatio?.width &&
                  preset.height === initialAspectRatio?.height
              );
              setAspectRatioPreset(
                initialPreset?.value || (initialAspectRatio ? 'custom' : '16:9')
              );
              if (!initialPreset && initialAspectRatio) {
                setCustomWidth(String(initialAspectRatio.width));
                setCustomHeight(String(initialAspectRatio.height));
              }
              setIsFormModified(false);
              setErrors(new Map());
            }}
            icon={BsX}
            color="danger"
          />
        </div>
      </form>
    </div>
  );
};
