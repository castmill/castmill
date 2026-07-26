import { Component, For, Show, createSignal } from 'solid-js';
import {
  TemplateNode,
  ComponentType,
  canHaveChildren,
  componentTypeLabel,
  componentTypeIcon,
} from './template-model';

// ─── Props ──────────────────────────────────────────────────────────────────

export interface ComponentTreeProps {
  root: TemplateNode;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onMove: (nodeId: string, newParentId: string, index: number) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
}

// ─── Component ──────────────────────────────────────────────────────────────

export const ComponentTree: Component<ComponentTreeProps> = (props) => {
  return (
    <div class="ct">
      <TreeNode
        node={props.root}
        depth={0}
        selectedId={props.selectedId}
        onSelect={props.onSelect}
        onMove={props.onMove}
        onDelete={props.onDelete}
        onDuplicate={props.onDuplicate}
        isRoot={true}
      />
    </div>
  );
};

// ─── Tree node ──────────────────────────────────────────────────────────────

interface TreeNodeProps {
  node: TemplateNode;
  depth: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onMove: (nodeId: string, newParentId: string, index: number) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  isRoot?: boolean;
}

const TreeNode: Component<TreeNodeProps> = (props) => {
  const [expanded, setExpanded] = createSignal(props.depth < 3);
  const [dragOver, setDragOver] = createSignal(false);

  const isSelected = () => props.selectedId === props.node._id;
  const hasChildren = () =>
    (props.node.children && props.node.children.length > 0) ||
    !!props.node.item_template;
  const isContainer = () => canHaveChildren(props.node.type);

  const handleDragStart = (e: DragEvent) => {
    if (props.isRoot) {
      e.preventDefault();
      return;
    }
    e.dataTransfer!.setData('text/plain', props.node._id);
    e.dataTransfer!.effectAllowed = 'move';
  };

  const handleDragOver = (e: DragEvent) => {
    if (!isContainer()) return;
    e.preventDefault();
    e.dataTransfer!.dropEffect = 'move';
    setDragOver(true);
  };

  const handleDragLeave = () => setDragOver(false);

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const nodeId = e.dataTransfer!.getData('text/plain');
    if (nodeId && nodeId !== props.node._id) {
      props.onMove(nodeId, props.node._id, props.node.children?.length || 0);
    }
  };

  const handleContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    // Context menu could be added later; for now just select
    props.onSelect(props.node._id);
  };

  return (
    <div class="ct__node-wrapper">
      <div
        class={`ct__node ${isSelected() ? 'ct__node--selected' : ''} ${dragOver() ? 'ct__node--dragover' : ''}`}
        style={{ 'padding-left': `${props.depth * 1.2 + 0.4}em` }}
        draggable={!props.isRoot}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => props.onSelect(props.node._id)}
        onContextMenu={handleContextMenu}
      >
        {/* Expand/collapse toggle */}
        <Show when={hasChildren()}>
          <button
            class="ct__toggle"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded());
            }}
          >
            {expanded() ? '▾' : '▸'}
          </button>
        </Show>
        <Show when={!hasChildren()}>
          <span class="ct__toggle-placeholder" />
        </Show>

        {/* Icon + label */}
        <span class="ct__icon">{componentTypeIcon(props.node.type)}</span>
        <span class="ct__label" title={props.node.name}>
          {props.node.name || componentTypeLabel(props.node.type)}
        </span>

        {/* Type badge */}
        <span class="ct__type-badge">{props.node.type}</span>

        {/* Actions */}
        <Show when={!props.isRoot}>
          <div class="ct__actions">
            <button
              class="ct__action-btn"
              onClick={(e) => {
                e.stopPropagation();
                props.onDuplicate(props.node._id);
              }}
              title="Duplicate"
            >
              ⧉
            </button>
            <button
              class="ct__action-btn ct__action-btn--danger"
              onClick={(e) => {
                e.stopPropagation();
                props.onDelete(props.node._id);
              }}
              title="Delete"
            >
              ×
            </button>
          </div>
        </Show>
      </div>

      {/* Children */}
      <Show when={expanded() && hasChildren()}>
        <div class="ct__children">
          <Show when={props.node.children}>
            <For each={props.node.children}>
              {(child) => (
                <TreeNode
                  node={child}
                  depth={props.depth + 1}
                  selectedId={props.selectedId}
                  onSelect={props.onSelect}
                  onMove={props.onMove}
                  onDelete={props.onDelete}
                  onDuplicate={props.onDuplicate}
                />
              )}
            </For>
          </Show>
          <Show when={props.node.item_template}>
            <div
              class="ct__item-template-label"
              style={{ 'padding-left': `${(props.depth + 1) * 1.2 + 0.4}em` }}
            >
              <span class="ct__item-template-tag">item template</span>
            </div>
            <TreeNode
              node={props.node.item_template!}
              depth={props.depth + 2}
              selectedId={props.selectedId}
              onSelect={props.onSelect}
              onMove={props.onMove}
              onDelete={props.onDelete}
              onDuplicate={props.onDuplicate}
            />
          </Show>
        </div>
      </Show>
    </div>
  );
};
