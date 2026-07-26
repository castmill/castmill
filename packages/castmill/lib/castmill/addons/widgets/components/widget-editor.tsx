import {
  Component,
  createSignal,
  createMemo,
  createEffect,
  Show,
  For,
  batch,
  onCleanup,
} from 'solid-js';
import { Button, useToast } from '@castmill/ui-common';
import {
  BsX,
  BsUpload,
  BsExclamationTriangle,
  BsCode,
  BsEye,
  BsArrowCounterclockwise,
  BsArrowClockwise,
} from 'solid-icons/bs';
import { AiOutlineSave } from 'solid-icons/ai';
import { JsonWidget, JsonWidgetConfig, OptionsDict } from '@castmill/player';
import { WidgetView } from '../../playlists/components/widget-view';
import {
  WidgetsService,
  WidgetCreateFromJson,
  WidgetFullUpdate,
} from '../services/widgets.service';
import { AddonStore } from '../../common/interfaces/addon-store';

import {
  TemplateNode,
  fromJson,
  toJson,
  createDefaultNode,
  findNode,
  replaceNode,
  removeNode,
  insertChild,
  moveNode,
  cloneNode,
  canHaveChildren,
} from './editor/template-model';
import { ComponentTree } from './editor/component-tree';
import { PropertyInspector } from './editor/property-inspector';
import { ComponentPalette } from './editor/component-palette';
import { SchemaEditor } from './editor/schema-editor';

import './widget-editor.scss';

// ─── Fixture management (localStorage) ─────────────────────────────────────

const FIXTURES_STORAGE_KEY = 'castmill_widget_fixtures';

export interface WidgetFixture {
  data: Record<string, any>;
  options: Record<string, any>;
}

function loadFixtureLibrary(): Record<string, WidgetFixture> {
  try {
    const raw = localStorage.getItem(FIXTURES_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveFixtureLibrary(lib: Record<string, WidgetFixture>): void {
  try {
    localStorage.setItem(FIXTURES_STORAGE_KEY, JSON.stringify(lib));
  } catch {
    // Ignore storage errors
  }
}

// ─── Types ──────────────────────────────────────────────────────────────────

type WidgetWithId = JsonWidget & { id: number; slug: string };

type EditorMode = 'visual' | 'code';
type LeftTab = 'tree' | 'schemas' | 'fixture' | 'settings';
type SchemaTab = 'options_schema' | 'data_schema';

export interface WidgetEditorProps {
  store: AddonStore;
  /** Existing widget to edit. Pass undefined to create a new widget. */
  widget?: WidgetWithId;
  onSave: (widget: JsonWidget) => void;
  onCancel: () => void;
}

// ─── Aspect ratio choices ───────────────────────────────────────────────────

const ASPECT_RATIOS = ['16:9', '9:16', '4:3', '1:1', 'liquid'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function tryParseJson(text: string): [true, any] | [false, string] {
  if (!text.trim()) return [true, undefined];
  try {
    return [true, JSON.parse(text)];
  } catch (e: any) {
    return [false, e.message];
  }
}

function prettyJson(value: any): string {
  if (value === undefined || value === null) return '';
  return JSON.stringify(value, null, 2);
}

const DEFAULT_TEMPLATE: Record<string, any> = {
  type: 'group',
  name: 'root',
  opts: {
    style: {
      width: '100%',
      height: '100%',
      'background-color': '#1a1a2e',
      display: 'flex',
      'flex-direction': 'column',
      'align-items': 'center',
      'justify-content': 'center',
    },
  },
  children: [
    {
      type: 'text',
      name: 'headline',
      opts: {
        text: { type: 'opt', key: 'headline' },
        style: {
          color: '#ffffff',
          'font-size': '2em',
          'font-weight': 'bold',
          width: 'auto',
          height: 'auto',
        },
      },
    },
  ],
};

const DEFAULT_OPTIONS_SCHEMA = {
  headline: {
    type: 'string',
    default: 'Hello World',
    description: 'Main headline text',
  },
};

const DEFAULT_DATA_SCHEMA = {};

const DEFAULT_FIXTURE_OBJ = {
  options: { headline: 'Hello World' },
  data: {},
};

// ─── Undo/Redo stack ────────────────────────────────────────────────────────

const MAX_UNDO = 50;

function createUndoStack<T>(initial: T) {
  const [stack, setStack] = createSignal<T[]>([initial]);
  const [index, setIndex] = createSignal(0);

  const current = () => stack()[index()];
  const canUndo = () => index() > 0;
  const canRedo = () => index() < stack().length - 1;

  const push = (val: T) => {
    const newStack = stack().slice(0, index() + 1);
    newStack.push(val);
    if (newStack.length > MAX_UNDO) newStack.shift();
    setStack(newStack);
    setIndex(newStack.length - 1);
  };

  const undo = () => {
    if (canUndo()) setIndex(index() - 1);
  };

  const redo = () => {
    if (canRedo()) setIndex(index() + 1);
  };

  return { current, push, undo, redo, canUndo, canRedo };
}

// ─── Component ───────────────────────────────────────────────────────────────

export const WidgetEditor: Component<WidgetEditorProps> = (props) => {
  const toast = useToast();
  const t = (key: string, params?: Record<string, any>) =>
    props.store.i18n?.t(key, params) || key;

  const isEditing = () => props.widget !== undefined;

  // ── Metadata fields ─────────────────────────────────────────────────────
  const [name, setName] = createSignal(props.widget?.name || '');
  const [description, setDescription] = createSignal(
    props.widget?.description || ''
  );
  const [aspectRatio, setAspectRatio] = createSignal(
    props.widget?.aspect_ratio || '16:9'
  );
  const [updateInterval, setUpdateInterval] = createSignal(
    String(props.widget?.update_interval_seconds || 60)
  );

  // ── Template tree (visual mode) ────────────────────────────────────────
  const initialTemplate = props.widget?.template
    ? fromJson(props.widget.template as any)
    : fromJson(DEFAULT_TEMPLATE);

  const undoStack = createUndoStack<TemplateNode>(initialTemplate);
  const templateTree = () => undoStack.current();

  const updateTree = (newRoot: TemplateNode) => {
    undoStack.push(newRoot);
  };

  // ── Template JSON (code mode) ──────────────────────────────────────────
  const [codeJson, setCodeJson] = createSignal(
    prettyJson(toJson(initialTemplate))
  );
  const [codeError, setCodeError] = createSignal<string | null>(null);

  // ── Schemas ─────────────────────────────────────────────────────────────
  const [optionsSchema, setOptionsSchema] = createSignal<Record<string, any>>(
    props.widget?.options_schema || DEFAULT_OPTIONS_SCHEMA
  );
  const [dataSchema, setDataSchema] = createSignal<Record<string, any>>(
    props.widget?.data_schema || DEFAULT_DATA_SCHEMA
  );

  // ── Fixture ─────────────────────────────────────────────────────────────
  const [fixtureJson, setFixtureJson] = createSignal(
    prettyJson(DEFAULT_FIXTURE_OBJ)
  );
  const [fixtureName, setFixtureName] = createSignal('');
  const [fixtureLibrary, setFixtureLibrary] =
    createSignal<Record<string, WidgetFixture>>(loadFixtureLibrary());

  // ── UI state ────────────────────────────────────────────────────────────
  const [editorMode, setEditorMode] = createSignal<EditorMode>('visual');
  const [leftTab, setLeftTab] = createSignal<LeftTab>('tree');
  const [schemaTab, setSchemaTab] = createSignal<SchemaTab>('options_schema');
  const [selectedNodeId, setSelectedNodeId] = createSignal<string | null>(
    initialTemplate._id
  );
  const [isSaving, setIsSaving] = createSignal(false);
  const [showPreview, setShowPreview] = createSignal(true);

  const refreshPreview = () => {
    setShowPreview(false);
    setTimeout(() => setShowPreview(true), 50);
  };

  // Sync code editor when switching modes
  createEffect(() => {
    if (editorMode() === 'code') {
      setCodeJson(prettyJson(toJson(templateTree())));
      setCodeError(null);
    }
  });

  const applyCodeToTree = () => {
    const [ok, val] = tryParseJson(codeJson());
    if (!ok) {
      setCodeError(val as string);
      return false;
    }
    if (val) {
      const newTree = fromJson(val);
      updateTree(newTree);
      setSelectedNodeId(newTree._id);
      setCodeError(null);
    }
    return true;
  };

  const switchToVisual = () => {
    if (editorMode() === 'code') {
      if (applyCodeToTree()) {
        setEditorMode('visual');
      }
    }
  };

  // ── Selected node ─────────────────────────────────────────────────────
  const selectedNode = createMemo(() => {
    const id = selectedNodeId();
    if (!id) return null;
    return findNode(templateTree(), id);
  });

  // ── Tree operations ───────────────────────────────────────────────────
  const handleNodeChange = (updated: TemplateNode) => {
    updateTree(replaceNode(templateTree(), updated._id, updated));
  };

  const handleDeleteNode = (id: string) => {
    if (id === templateTree()._id) return; // Can't delete root
    const newRoot = removeNode(templateTree(), id);
    if (newRoot) {
      updateTree(newRoot);
      if (selectedNodeId() === id) setSelectedNodeId(templateTree()._id);
    }
  };

  const handleDuplicateNode = (id: string) => {
    if (id === templateTree()._id) return;
    const node = findNode(templateTree(), id);
    if (!node) return;
    const clone = cloneNode(node);
    clone.name = `${node.name}-copy`;
    // Find parent and insert after
    const findParentOf = (
      root: TemplateNode,
      targetId: string
    ): [TemplateNode, number] | null => {
      if (root.children) {
        for (let i = 0; i < root.children.length; i++) {
          if (root.children[i]._id === targetId) return [root, i];
          const found = findParentOf(root.children[i], targetId);
          if (found) return found;
        }
      }
      return null;
    };
    const result = findParentOf(templateTree(), id);
    if (result) {
      const [parent, idx] = result;
      updateTree(insertChild(templateTree(), parent._id, clone, idx + 1));
      setSelectedNodeId(clone._id);
    }
  };

  const handleMoveNode = (
    nodeId: string,
    newParentId: string,
    index: number
  ) => {
    // Prevent moving a node into itself or its descendants
    const node = findNode(templateTree(), nodeId);
    if (!node) return;
    if (findNode(node, newParentId)) return; // Would create cycle
    updateTree(moveNode(templateTree(), nodeId, newParentId, index));
  };

  const handleAddComponent = (newNode: TemplateNode) => {
    // Add to selected node if it's a container, otherwise to root
    const sel = selectedNode();
    const targetId =
      sel && canHaveChildren(sel.type) ? sel._id : templateTree()._id;
    updateTree(
      insertChild(
        templateTree(),
        targetId,
        newNode,
        findNode(templateTree(), targetId)?.children?.length || 0
      )
    );
    setSelectedNodeId(newNode._id);
  };

  // ── Derived: schemas (direct from signals) ────────────────────────────
  const optionsSchemaParsed = () => optionsSchema();
  const dataSchemaParsed = () => dataSchema();
  const fixtureParsed = createMemo(() => {
    const [ok, val] = tryParseJson(fixtureJson());
    if (!ok || !val) return { data: {}, options: {} };
    return { data: val.data || {}, options: val.options || {} };
  });
  const fixtureError = createMemo(() => {
    const [ok, err] = tryParseJson(fixtureJson());
    return ok ? null : String(err);
  });

  const hasErrors = createMemo(() => !name().trim());

  // ── Preview widget ────────────────────────────────────────────────────
  const previewWidget = createMemo<JsonWidget | null>(() => {
    const template = toJson(templateTree());
    return {
      id: props.widget?.id,
      name: name() || 'Preview',
      description: description(),
      slug: props.widget?.slug || 'preview',
      template: template as any,
      options_schema: optionsSchemaParsed(),
      data_schema: dataSchemaParsed(),
      update_interval_seconds: Number(updateInterval()) || 60,
      aspect_ratio: aspectRatio() || undefined,
      fonts: props.widget?.fonts || [],
      assets: props.widget?.assets || {},
    };
  });

  const previewConfig = createMemo<JsonWidgetConfig>(() => {
    const fixture = fixtureParsed();
    return {
      widget_id: props.widget?.id ?? 0,
      data: fixture.data as OptionsDict,
      options: fixture.options as OptionsDict,
    };
  });

  const previewOptions = createMemo<OptionsDict>(
    () => fixtureParsed().options as OptionsDict
  );

  // ── Fixture helpers ──────────────────────────────────────────────────────
  const saveFixture = () => {
    const n = fixtureName().trim();
    if (!n) {
      toast.show({
        message: t('widgets.editor.fixtureNameRequired'),
        type: 'error',
        duration: 3000,
      });
      return;
    }
    const [ok, val] = tryParseJson(fixtureJson());
    if (!ok) {
      toast.show({
        message: t('widgets.editor.invalidJson'),
        type: 'error',
        duration: 3000,
      });
      return;
    }
    const lib = {
      ...fixtureLibrary(),
      [n]: { data: val?.data || {}, options: val?.options || {} },
    };
    setFixtureLibrary(lib);
    saveFixtureLibrary(lib);
    toast.show({
      message: t('widgets.editor.fixtureSaved'),
      type: 'success',
      duration: 2000,
    });
  };

  const loadFixture = (fname: string) => {
    const fixture = fixtureLibrary()[fname];
    if (fixture) {
      setFixtureJson(
        prettyJson({ data: fixture.data, options: fixture.options })
      );
      refreshPreview();
    }
  };

  const deleteFixture = (fname: string) => {
    const lib = { ...fixtureLibrary() };
    delete lib[fname];
    setFixtureLibrary(lib);
    saveFixtureLibrary(lib);
  };

  // ── Save ─────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (hasErrors()) return;

    // If in code mode, apply code first
    if (editorMode() === 'code' && !applyCodeToTree()) return;

    setIsSaving(true);
    try {
      const widgetData = {
        name: name().trim(),
        description: description().trim(),
        template: toJson(templateTree()),
        options_schema: optionsSchemaParsed() || {},
        data_schema: dataSchemaParsed() || {},
        aspect_ratio: aspectRatio() || undefined,
        update_interval_seconds: Number(updateInterval()) || 60,
      };

      let savedWidget: JsonWidget;
      if (isEditing() && props.widget?.id) {
        savedWidget = await WidgetsService.fullUpdateWidget(
          props.store.env.baseUrl,
          props.store.organizations.selectedId,
          String(props.widget!.id),
          widgetData as WidgetFullUpdate
        );
      } else {
        savedWidget = await WidgetsService.createFromJson(
          props.store.env.baseUrl,
          props.store.organizations.selectedId,
          widgetData as WidgetCreateFromJson
        );
      }

      toast.show({
        message: isEditing()
          ? t('widgets.editor.savedSuccess')
          : t('widgets.editor.createdSuccess'),
        type: 'success',
        duration: 3000,
      });
      props.onSave(savedWidget);
    } catch (err: any) {
      toast.show({
        message: t('widgets.editor.saveError', {
          error: err.message || String(err),
        }),
        type: 'error',
        duration: 5000,
      });
    } finally {
      setIsSaving(false);
    }
  };

  // ── Keyboard shortcuts ───────────────────────────────────────────────────
  const handleKeyDown = (e: KeyboardEvent) => {
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      undoStack.undo();
    }
    if (mod && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
      e.preventDefault();
      undoStack.redo();
    }
    if (mod && e.key === 's') {
      e.preventDefault();
      handleSave();
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      const sel = selectedNodeId();
      if (
        sel &&
        sel !== templateTree()._id &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA' &&
        document.activeElement?.tagName !== 'SELECT'
      ) {
        e.preventDefault();
        handleDeleteNode(sel);
      }
    }
  };

  // Attach / detach keyboard listener
  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', handleKeyDown);
    onCleanup(() => window.removeEventListener('keydown', handleKeyDown));
  }

  // ── Left tab items ────────────────────────────────────────────────────
  const leftTabs: { key: LeftTab; label: string }[] = [
    { key: 'tree', label: t('widgets.editor.componentTree') },
    { key: 'schemas', label: t('widgets.editor.schemas') },
    { key: 'fixture', label: t('widgets.editor.fixture') },
    { key: 'settings', label: t('widgets.editor.settings') },
  ];

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div class="we">
      {/* ═══ Toolbar ═══ */}
      <div class="we__toolbar">
        <div class="we__toolbar-left">
          <button
            class="we__close-btn"
            onClick={props.onCancel}
            title={t('common.cancel')}
          >
            <BsX size={20} />
          </button>
          <input
            class={`we__name-input ${!name().trim() ? 'we__name-input--error' : ''}`}
            type="text"
            placeholder={t('widgets.editor.namePlaceholder')}
            value={name()}
            onInput={(e) => setName(e.currentTarget.value)}
          />
          <Show when={!name().trim()}>
            <span class="we__inline-error">
              {t('widgets.editor.nameRequired')}
            </span>
          </Show>

          {/* Aspect ratio selector */}
          <select
            class="we__aspect-select"
            value={aspectRatio()}
            onChange={(e) => setAspectRatio(e.currentTarget.value)}
          >
            <For each={ASPECT_RATIOS}>
              {(ratio) => <option value={ratio}>{ratio}</option>}
            </For>
          </select>
        </div>

        <div class="we__toolbar-center">
          {/* Mode toggle */}
          <div class="we__mode-toggle">
            <button
              class={`we__mode-btn ${editorMode() === 'visual' ? 'we__mode-btn--active' : ''}`}
              onClick={() => switchToVisual()}
              title={t('widgets.editor.visualMode')}
            >
              <BsEye size={14} />
              <span>{t('widgets.editor.visual')}</span>
            </button>
            <button
              class={`we__mode-btn ${editorMode() === 'code' ? 'we__mode-btn--active' : ''}`}
              onClick={() => setEditorMode('code')}
              title={t('widgets.editor.codeMode')}
            >
              <BsCode size={14} />
              <span>{t('widgets.editor.code')}</span>
            </button>
          </div>

          {/* Undo / Redo */}
          <button
            class="we__icon-btn"
            onClick={() => undoStack.undo()}
            disabled={!undoStack.canUndo()}
            title={t('widgets.editor.undo')}
          >
            <BsArrowCounterclockwise size={16} />
          </button>
          <button
            class="we__icon-btn"
            onClick={() => undoStack.redo()}
            disabled={!undoStack.canRedo()}
            title={t('widgets.editor.redo')}
          >
            <BsArrowClockwise size={16} />
          </button>
        </div>

        <div class="we__toolbar-right">
          <Button
            label={t('common.cancel')}
            onClick={props.onCancel}
            color="secondary"
            disabled={isSaving()}
          />
          <Button
            label={
              isSaving()
                ? t('common.saving')
                : isEditing()
                  ? t('common.save')
                  : t('widgets.editor.createWidget')
            }
            onClick={handleSave}
            icon={AiOutlineSave}
            color="primary"
            disabled={isSaving() || hasErrors()}
          />
        </div>
      </div>

      {/* ═══ Body ═══ */}
      <div class="we__body">
        {/* ─── Left panel ─── */}
        <div class="we__left-panel">
          <div class="we__left-tabs">
            <For each={leftTabs}>
              {(tab) => (
                <button
                  class={`we__left-tab ${leftTab() === tab.key ? 'we__left-tab--active' : ''}`}
                  onClick={() => setLeftTab(tab.key)}
                >
                  {tab.label}
                </button>
              )}
            </For>
          </div>

          <div class="we__left-content">
            {/* Component tree */}
            <Show when={leftTab() === 'tree'}>
              <div class="we__tree-section">
                <ComponentTree
                  root={templateTree()}
                  selectedId={selectedNodeId()}
                  onSelect={setSelectedNodeId}
                  onMove={handleMoveNode}
                  onDelete={handleDeleteNode}
                  onDuplicate={handleDuplicateNode}
                />
                <ComponentPalette onAdd={handleAddComponent} t={t} />
              </div>
            </Show>

            {/* Schemas */}
            <Show when={leftTab() === 'schemas'}>
              <div class="we__schemas-section">
                <div class="we__schema-tabs">
                  <button
                    class={`we__schema-tab ${schemaTab() === 'options_schema' ? 'we__schema-tab--active' : ''}`}
                    onClick={() => setSchemaTab('options_schema')}
                  >
                    {t('widgets.optionsSchema')}
                  </button>
                  <button
                    class={`we__schema-tab ${schemaTab() === 'data_schema' ? 'we__schema-tab--active' : ''}`}
                    onClick={() => setSchemaTab('data_schema')}
                  >
                    {t('widgets.dataSchema')}
                  </button>
                </div>
                <Show when={schemaTab() === 'options_schema'}>
                  <SchemaEditor
                    schema={optionsSchema()}
                    onChange={setOptionsSchema}
                    t={t}
                    title={t('widgets.optionsSchema')}
                  />
                </Show>
                <Show when={schemaTab() === 'data_schema'}>
                  <SchemaEditor
                    schema={dataSchema()}
                    onChange={setDataSchema}
                    t={t}
                    title={t('widgets.dataSchema')}
                  />
                </Show>
              </div>
            </Show>

            {/* Fixture */}
            <Show when={leftTab() === 'fixture'}>
              <div class="we__fixture-section">
                <p class="we__fixture-hint">
                  {t('widgets.editor.fixtureHint')}
                </p>
                <JsonEditorPane
                  value={fixtureJson()}
                  onChange={(v) => {
                    setFixtureJson(v);
                    refreshPreview();
                  }}
                  error={fixtureError()}
                  placeholder={t('widgets.editor.fixturePlaceholder')}
                />
                <div class="we__fixture-save">
                  <input
                    class="we__fixture-name-input"
                    type="text"
                    placeholder={t('widgets.editor.fixtureNamePlaceholder')}
                    value={fixtureName()}
                    onInput={(e) => setFixtureName(e.currentTarget.value)}
                  />
                  <Button
                    label={t('widgets.editor.saveFixture')}
                    onClick={saveFixture}
                    icon={AiOutlineSave}
                    color="secondary"
                    disabled={!fixtureName().trim()}
                  />
                </div>
                <Show when={Object.keys(fixtureLibrary()).length > 0}>
                  <div class="we__fixture-library">
                    <h4 class="we__fixture-library-title">
                      {t('widgets.editor.savedFixtures')}
                    </h4>
                    <For each={Object.entries(fixtureLibrary())}>
                      {([fname]) => (
                        <div class="we__fixture-item">
                          <span class="we__fixture-item-name">{fname}</span>
                          <div class="we__fixture-item-actions">
                            <button
                              class="we__fixture-action"
                              onClick={() => loadFixture(fname)}
                              title={t('widgets.editor.loadFixture')}
                            >
                              <BsUpload size={12} />
                            </button>
                            <button
                              class="we__fixture-action we__fixture-action--danger"
                              onClick={() => deleteFixture(fname)}
                              title={t('common.delete')}
                            >
                              <BsX size={12} />
                            </button>
                          </div>
                        </div>
                      )}
                    </For>
                  </div>
                </Show>
              </div>
            </Show>

            {/* Settings */}
            <Show when={leftTab() === 'settings'}>
              <div class="we__settings-section">
                <div class="we__field">
                  <label class="we__label">{t('common.description')}</label>
                  <textarea
                    class="we__textarea"
                    value={description()}
                    onInput={(e) => setDescription(e.currentTarget.value)}
                    placeholder={t('widgets.editor.descriptionPlaceholder')}
                    rows={3}
                  />
                </div>
                <div class="we__field">
                  <label class="we__label">{t('widgets.updateInterval')}</label>
                  <input
                    class="we__input"
                    type="number"
                    min={5}
                    max={3600}
                    value={updateInterval()}
                    onInput={(e) => setUpdateInterval(e.currentTarget.value)}
                  />
                  <span class="we__field-hint">
                    {t('widgets.editor.updateIntervalHint')}
                  </span>
                </div>
              </div>
            </Show>
          </div>
        </div>

        {/* ─── Center: Preview / Code ─── */}
        <div class="we__center-panel">
          <Show when={editorMode() === 'visual'}>
            <div class="we__preview-header">
              <span class="we__preview-title">
                {t('widgets.editor.livePreview')}
              </span>
              <button
                class="we__preview-refresh"
                onClick={refreshPreview}
                title={t('widgets.editor.refreshPreview')}
              >
                {t('widgets.editor.refresh')}
              </button>
            </div>
            <div class="we__preview-container">
              <div
                class="we__preview-aspect"
                style={aspectRatioStyle(aspectRatio())}
              >
                <Show when={showPreview()}>
                  <WidgetView
                    widget={previewWidget()!}
                    config={previewConfig()}
                    options={previewOptions()}
                    baseUrl={props.store.env.baseUrl}
                    socket={props.store.socket}
                  />
                </Show>
              </div>
            </div>
          </Show>

          <Show when={editorMode() === 'code'}>
            <div class="we__code-editor">
              <div class="we__code-header">
                <span>{t('widgets.editor.templateJson')}</span>
                <button
                  class="we__code-apply"
                  onClick={() => applyCodeToTree()}
                >
                  {t('widgets.editor.applyCode')}
                </button>
              </div>
              <textarea
                class={`we__code-textarea ${codeError() ? 'we__code-textarea--error' : ''}`}
                value={codeJson()}
                onInput={(e) => {
                  setCodeJson(e.currentTarget.value);
                  setCodeError(null);
                }}
                spellcheck={false}
              />
              <Show when={codeError()}>
                <div class="we__code-error">
                  <BsExclamationTriangle size={12} />
                  <span>{codeError()}</span>
                </div>
              </Show>
            </div>
          </Show>
        </div>

        {/* ─── Right panel: Property Inspector ─── */}
        <Show when={editorMode() === 'visual'}>
          <div class="we__right-panel">
            <PropertyInspector
              node={selectedNode()}
              onChange={handleNodeChange}
              t={t}
              optionsSchema={optionsSchemaParsed()}
              dataSchema={dataSchemaParsed()}
            />
          </div>
        </Show>
      </div>
    </div>
  );
};

// ─── JSON Editor pane (reused for schemas/fixtures) ──────────────────────────

interface JsonEditorPaneProps {
  value: string;
  onChange: (value: string) => void;
  error: string | null;
  placeholder?: string;
}

const JsonEditorPane: Component<JsonEditorPaneProps> = (props) => {
  return (
    <div class="we__json-pane">
      <textarea
        class={`we__json-textarea ${props.error ? 'we__json-textarea--error' : ''}`}
        value={props.value}
        onInput={(e) => props.onChange(e.currentTarget.value)}
        placeholder={props.placeholder || '{}'}
        spellcheck={false}
        autocomplete="off"
        autocorrect="off"
        autocapitalize="off"
      />
      <Show when={props.error}>
        <div class="we__json-error">
          <BsExclamationTriangle size={12} />
          <span>{props.error}</span>
        </div>
      </Show>
    </div>
  );
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function aspectRatioStyle(ratio: string): string {
  const parts = ratio.split(':');
  if (parts.length === 2) {
    const [w, h] = parts.map(Number);
    if (w > 0 && h > 0) {
      return `aspect-ratio: ${w} / ${h}; width: 100%; max-height: 100%;`;
    }
  }
  return 'width: 100%; height: 100%;';
}
