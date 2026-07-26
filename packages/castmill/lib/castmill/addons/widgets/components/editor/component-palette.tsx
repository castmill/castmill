import { Component, For } from 'solid-js';
import {
  ComponentType,
  ALL_COMPONENT_TYPES,
  componentTypeLabel,
  componentTypeIcon,
  createDefaultNode,
  TemplateNode,
} from './template-model';

// ─── Props ──────────────────────────────────────────────────────────────────

export interface ComponentPaletteProps {
  onAdd: (node: TemplateNode) => void;
  t: (key: string) => string;
}

// ─── Component ──────────────────────────────────────────────────────────────

export const ComponentPalette: Component<ComponentPaletteProps> = (props) => {
  const handleDragStart = (type: ComponentType, e: DragEvent) => {
    e.dataTransfer!.setData('application/x-component-type', type);
    e.dataTransfer!.effectAllowed = 'copy';
  };

  return (
    <div class="cp">
      <div class="cp__title">{props.t('widgets.editor.components')}</div>
      <div class="cp__grid">
        <For each={ALL_COMPONENT_TYPES}>
          {(type) => (
            <button
              class="cp__item"
              draggable={true}
              onDragStart={(e) => handleDragStart(type, e)}
              onClick={() => props.onAdd(createDefaultNode(type))}
              title={componentTypeLabel(type)}
            >
              <span class="cp__icon">{componentTypeIcon(type)}</span>
              <span class="cp__label">{componentTypeLabel(type)}</span>
            </button>
          )}
        </For>
      </div>
    </div>
  );
};
