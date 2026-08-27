import { Component, createSignal, createEffect } from 'solid-js';
import { Button, FormItem, useToast } from '@castmill/ui-common';
import { BsSave } from 'solid-icons/bs';
import type { LayoutZone, LayoutOptionValue } from '@castmill/player';
import {
  LayoutsService,
  JsonLayout,
  JsonLayoutZone,
  LayoutUpdate,
} from '../services/layouts.service';
import { AddonStore } from '../../common/interfaces/addon-store';
import { LayoutEditor } from '../../common/components/layout-editor';
import './layout-view.scss';

/**
 * Converts JsonLayoutZone (backend format) to LayoutZone (editor format)
 */
const convertToLayoutZone = (
  zone: JsonLayoutZone,
  index: number
): LayoutZone => ({
  id: zone.id || `zone-${index}-${Date.now()}`,
  name: zone.name || `Zone ${index + 1}`,
  rect: {
    x: zone.rect.x,
    y: zone.rect.y,
    width: zone.rect.width,
    height: zone.rect.height,
  },
  zIndex: zone.zIndex ?? index + 1,
});

/**
 * Converts LayoutZone (editor format) to JsonLayoutZone (backend format)
 */
const convertToJsonLayoutZone = (zone: LayoutZone): JsonLayoutZone => ({
  id: zone.id,
  name: zone.name,
  rect: {
    x: zone.rect.x,
    y: zone.rect.y,
    width: zone.rect.width,
    height: zone.rect.height,
  },
  zIndex: zone.zIndex,
});

export const LayoutView: Component<{
  layout: JsonLayout;
  store: AddonStore;
  onUpdate: (layout: JsonLayout) => void;
  onClose: () => void;
}> = (props) => {
  const toast = useToast();
  const t = (key: string, params?: Record<string, unknown>) =>
    props.store.i18n?.t(key, params) || key;

  // Editable state for layout metadata
  const [name, setName] = createSignal(props.layout.name);
  const [description, setDescription] = createSignal(
    props.layout.description || ''
  );
  const [isSaving, setIsSaving] = createSignal(false);
  const [hasChanges, setHasChanges] = createSignal(false);

  // Layout value for the editor (zones + aspect ratio)
  const initialZones = (props.layout.zones?.zones || []).map(
    convertToLayoutZone
  );
  const [layoutValue, setLayoutValue] = createSignal<LayoutOptionValue>({
    aspectRatio: props.layout.aspect_ratio || '16:9',
    zones: initialZones,
  });

  // Store the initial state for comparison (normalized JSON)
  const initialState = {
    name: props.layout.name,
    description: props.layout.description || '',
    aspectRatio: props.layout.aspect_ratio || '16:9',
    zonesJson: JSON.stringify(initialZones.map(convertToJsonLayoutZone)),
  };

  // Track changes
  createEffect(() => {
    const currentName = name();
    const currentDesc = description();
    const currentValue = layoutValue();

    const currentZonesJson = JSON.stringify(
      currentValue.zones.map(convertToJsonLayoutZone)
    );

    setHasChanges(
      currentName !== initialState.name ||
        currentDesc !== initialState.description ||
        currentValue.aspectRatio !== initialState.aspectRatio ||
        currentZonesJson !== initialState.zonesJson
    );
  });

  // Handle layout value changes from the editor
  const handleLayoutChange = (newValue: LayoutOptionValue) => {
    setLayoutValue(newValue);
  };

  // Save handler
  const handleSave = async () => {
    if (isSaving()) return;

    setIsSaving(true);
    try {
      const currentValue = layoutValue();
      const updateData: LayoutUpdate = {
        name: name(),
        description: description(),
        aspect_ratio: currentValue.aspectRatio,
        zones: { zones: currentValue.zones.map(convertToJsonLayoutZone) },
      };

      const updatedLayout = await LayoutsService.updateLayout(
        props.store.env.baseUrl,
        props.store.organizations.selectedId,
        props.layout.id,
        updateData
      );

      props.onUpdate(updatedLayout);
      toast.success(t('layouts.saveSuccess') || 'Layout saved successfully');
      setHasChanges(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`${t('common.error')}: ${message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div class="layout-view">
      <div class="layout-view-header">
        <div class="layout-info">
          <FormItem
            label={t('common.name')}
            id="layout-name"
            value={name()}
            onInput={(v) => setName(String(v))}
          >
            <></>
          </FormItem>
          <FormItem
            label={t('common.description')}
            id="layout-description"
            value={description()}
            onInput={(v) => setDescription(String(v))}
          >
            <></>
          </FormItem>
        </div>
        <div class="layout-actions">
          <Button
            onClick={handleSave}
            disabled={!hasChanges() || isSaving()}
            color="primary"
            label={isSaving() ? t('common.saving') : t('common.save')}
            icon={BsSave}
          />
        </div>
      </div>

      <LayoutEditor value={layoutValue()} onChange={handleLayoutChange} />
    </div>
  );
};
