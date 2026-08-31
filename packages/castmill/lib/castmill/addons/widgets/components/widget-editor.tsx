import {
  Component,
  createSignal,
  createMemo,
  createEffect,
  Show,
  For,
  onCleanup,
  ErrorBoundary,
} from 'solid-js';
import { Button, useToast } from '@castmill/ui-common';
import {
  BsX,
  BsUpload,
  BsExclamationTriangle,
  BsPlus,
  BsTrash,
  BsArrowUp,
  BsArrowDown,
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
import { validateWidgetTemplate } from './widget-template-validation';

import './widget-editor.scss';

// ─── Fixture management (localStorage) ─────────────────────────────────────

const FIXTURES_STORAGE_KEY = 'castmill_widget_fixtures';

export interface WidgetFixture {
  data: Record<string, any>;
  options: Record<string, any>;
}

function fixtureStorageKey(organizationId: string): string {
  return `${FIXTURES_STORAGE_KEY}:${organizationId}`;
}

function loadFixtureLibrary(
  organizationId: string
): Record<string, WidgetFixture> {
  try {
    const raw = localStorage.getItem(fixtureStorageKey(organizationId));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveFixtureLibrary(
  organizationId: string,
  lib: Record<string, WidgetFixture>
): void {
  try {
    localStorage.setItem(
      fixtureStorageKey(organizationId),
      JSON.stringify(lib)
    );
  } catch {
    // Ignore storage errors
  }
}

// ─── Types ──────────────────────────────────────────────────────────────────

type WidgetWithId = JsonWidget & { id: number; slug: string };

type EditorTab =
  | 'design'
  | 'template'
  | 'options_schema'
  | 'data_schema'
  | 'assets'
  | 'fonts'
  | 'fixture'
  | 'settings';

type TemplateNode = Record<string, any>;

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

function isJsonObject(value: any): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const DEFAULT_TEMPLATE = prettyJson({
  type: 'group',
  name: 'my-widget',
  opts: {},
  style: {
    width: '100%',
    height: '100%',
    'background-color': '#1a1a2e',
    display: 'flex',
    'flex-direction': 'column',
    'align-items': 'center',
    'justify-content': 'center',
  },
  components: [
    {
      type: 'text',
      name: 'headline',
      opts: {
        text: { key: 'options.headline', default: 'Hello World' },
      },
      style: {
        color: '#ffffff',
        'font-size': '2em',
        'font-weight': 'bold',
        'text-align': 'center',
      },
    },
  ],
});

const DEFAULT_OPTIONS_SCHEMA = prettyJson({
  headline: {
    type: 'string',
    default: 'Hello World',
    description: 'Main headline text',
  },
});

const DEFAULT_DATA_SCHEMA = prettyJson({});

const DEFAULT_FIXTURE = prettyJson({
  options: {
    headline: 'Hello World',
  },
  data: {},
});

function getComponents(node: TemplateNode): TemplateNode[] {
  if (Array.isArray(node.components)) return node.components;
  return node.component ? [node.component] : [];
}

function setComponents(
  node: TemplateNode,
  components: TemplateNode[]
): TemplateNode {
  if ('component' in node && !Array.isArray(node.components)) {
    return { ...node, component: components[0] };
  }
  return { ...node, components };
}

function getNodeAtPath(
  root: TemplateNode,
  path: number[]
): TemplateNode | undefined {
  return path.reduce<TemplateNode | undefined>(
    (node, index) => (node ? getComponents(node)[index] : undefined),
    root
  );
}

function updateNodeAtPath(
  root: TemplateNode,
  path: number[],
  update: (node: TemplateNode) => TemplateNode
): TemplateNode {
  if (path.length === 0) return update(root);
  const [index, ...rest] = path;
  const components = getComponents(root);
  return setComponents(
    root,
    components.map((component, componentIndex) =>
      componentIndex === index
        ? updateNodeAtPath(component, rest, update)
        : component
    )
  );
}

function newTemplateNode(
  type: 'group' | 'text' | 'image',
  defaultText: string
): TemplateNode {
  const name = `${type}-${Date.now().toString(36)}`;
  if (type === 'group') {
    return {
      type,
      name,
      opts: {},
      style: {
        display: 'flex',
        'flex-direction': 'column',
        width: '100%',
        height: '100%',
      },
      components: [],
    };
  }
  if (type === 'image') {
    return {
      type,
      name,
      opts: { url: '', size: 'cover' },
      style: { width: '100%', height: '100%' },
    };
  }
  return {
    type,
    name,
    opts: { text: defaultText },
    style: { color: '#ffffff', 'font-size': '1em' },
  };
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

  // ── JSON editor content ─────────────────────────────────────────────────
  const [templateJson, setTemplateJson] = createSignal(
    prettyJson(props.widget?.template) || DEFAULT_TEMPLATE
  );
  const [optionsSchemaJson, setOptionsSchemaJson] = createSignal(
    prettyJson(props.widget?.options_schema) || DEFAULT_OPTIONS_SCHEMA
  );
  const [dataSchemaJson, setDataSchemaJson] = createSignal(
    prettyJson(props.widget?.data_schema) || DEFAULT_DATA_SCHEMA
  );
  const [assetsJson, setAssetsJson] = createSignal(
    prettyJson(props.widget?.assets) || '{}'
  );
  const [fontsJson, setFontsJson] = createSignal(
    prettyJson(props.widget?.fonts) || '[]'
  );

  // ── Fixture ─────────────────────────────────────────────────────────────
  const [fixtureJson, setFixtureJson] = createSignal(DEFAULT_FIXTURE);
  const [fixtureName, setFixtureName] = createSignal('');
  const [fixtureLibrary, setFixtureLibrary] = createSignal<
    Record<string, WidgetFixture>
  >(loadFixtureLibrary(props.store.organizations.selectedId));

  // ── UI state ────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = createSignal<EditorTab>('design');
  const [selectedPath, setSelectedPath] = createSignal<number[]>([]);
  const [isSaving, setIsSaving] = createSignal(false);
  const [previewRevision, setPreviewRevision] = createSignal(0);

  const refreshPreview = () => {
    setPreviewRevision((revision) => revision + 1);
  };

  // ── Derived: parsed JSON ─────────────────────────────────────────────────
  const templateParsed = createMemo(() => {
    const [ok, val] = tryParseJson(templateJson());
    return ok ? val : null;
  });
  const optionsSchemaParsed = createMemo(() => {
    const [ok, val] = tryParseJson(optionsSchemaJson());
    return ok ? val : undefined;
  });
  const dataSchemaParsed = createMemo(() => {
    const [ok, val] = tryParseJson(dataSchemaJson());
    return ok ? val : undefined;
  });
  const assetsParsed = createMemo(() => {
    const [ok, val] = tryParseJson(assetsJson());
    return ok && isJsonObject(val) ? val : {};
  });
  const fontsParsed = createMemo(() => {
    const [ok, val] = tryParseJson(fontsJson());
    return ok && Array.isArray(val) ? val : [];
  });
  const fixtureParsed = createMemo(() => {
    const [ok, val] = tryParseJson(fixtureJson());
    if (!ok || !val) return { data: {}, options: {} };
    return {
      data: val.data || {},
      options: val.options || {},
    };
  });

  const selectedNode = createMemo(() => {
    const template = templateParsed();
    return template ? getNodeAtPath(template, selectedPath()) : undefined;
  });

  const initialState = JSON.stringify({
    name: name(),
    description: description(),
    aspectRatio: aspectRatio(),
    updateInterval: updateInterval(),
    templateJson: templateJson(),
    optionsSchemaJson: optionsSchemaJson(),
    dataSchemaJson: dataSchemaJson(),
    assetsJson: assetsJson(),
    fontsJson: fontsJson(),
  });

  const isDirty = createMemo(
    () =>
      initialState !==
      JSON.stringify({
        name: name(),
        description: description(),
        aspectRatio: aspectRatio(),
        updateInterval: updateInterval(),
        templateJson: templateJson(),
        optionsSchemaJson: optionsSchemaJson(),
        dataSchemaJson: dataSchemaJson(),
        assetsJson: assetsJson(),
        fontsJson: fontsJson(),
      })
  );

  const beforeUnload = (event: BeforeUnloadEvent) => {
    if (isDirty()) event.preventDefault();
  };
  window.addEventListener('beforeunload', beforeUnload);
  onCleanup(() => {
    window.removeEventListener('beforeunload', beforeUnload);
  });

  // ── Derived: per-tab validation errors ──────────────────────────────────
  const templateError = createMemo(() => {
    const [ok, value] = tryParseJson(templateJson());
    if (!ok) return String(value);
    const invalidPath = validateWidgetTemplate(value);
    return invalidPath
      ? t('widgets.editor.invalidTemplate', { path: invalidPath })
      : null;
  });
  const optionsSchemaError = createMemo(() => {
    const [ok, value] = tryParseJson(optionsSchemaJson());
    return ok && (value === undefined || isJsonObject(value))
      ? null
      : ok
        ? t('widgets.editor.schemaMustBeObject')
        : String(value);
  });
  const dataSchemaError = createMemo(() => {
    const [ok, value] = tryParseJson(dataSchemaJson());
    return ok && (value === undefined || isJsonObject(value))
      ? null
      : ok
        ? t('widgets.editor.schemaMustBeObject')
        : String(value);
  });
  const assetsError = createMemo(() => {
    const [ok, value] = tryParseJson(assetsJson());
    return ok && (value === undefined || isJsonObject(value))
      ? null
      : ok
        ? t('widgets.editor.assetsMustBeObject')
        : String(value);
  });
  const fontsError = createMemo(() => {
    const [ok, value] = tryParseJson(fontsJson());
    return ok &&
      Array.isArray(value) &&
      value.every(
        (font) =>
          isJsonObject(font) &&
          typeof font.name === 'string' &&
          !!font.name.trim() &&
          typeof font.url === 'string' &&
          !!font.url.trim()
      )
      ? null
      : ok
        ? t('widgets.editor.fontsMustBeArray')
        : String(value);
  });
  const fixtureError = createMemo(() => {
    const [ok, err] = tryParseJson(fixtureJson());
    return ok ? null : String(err);
  });
  const updateIntervalError = createMemo(() => {
    const value = Number(updateInterval());
    return Number.isInteger(value) && value >= 5 && value <= 3600
      ? null
      : t('widgets.editor.updateIntervalError');
  });

  const hasErrors = createMemo(
    () =>
      !!templateError() ||
      !!optionsSchemaError() ||
      !!dataSchemaError() ||
      !!assetsError() ||
      !!fontsError() ||
      !!updateIntervalError() ||
      !name().trim()
  );

  const updateSelectedNode = (update: (node: TemplateNode) => TemplateNode) => {
    const template = templateParsed();
    if (!template) return;
    setTemplateJson(
      prettyJson(updateNodeAtPath(template, selectedPath(), update))
    );
  };

  const addComponent = (type: 'group' | 'text' | 'image') => {
    const selected = selectedNode();
    const parentPath =
      selected?.type === 'group' ? selectedPath() : selectedPath().slice(0, -1);
    const template = templateParsed();
    if (!template) return;
    const parent = getNodeAtPath(template, parentPath);
    if (!parent || parent.type !== 'group') return;
    const nextIndex = getComponents(parent).length;
    setTemplateJson(
      prettyJson(
        updateNodeAtPath(template, parentPath, (node) => ({
          ...setComponents(node, [
            ...getComponents(node),
            newTemplateNode(type, t('widgets.editor.defaultText')),
          ]),
        }))
      )
    );
    setSelectedPath([...parentPath, nextIndex]);
  };

  const removeSelected = () => {
    const path = selectedPath();
    const template = templateParsed();
    if (!template || path.length === 0) return;
    const parentPath = path.slice(0, -1);
    const index = path[path.length - 1];
    setTemplateJson(
      prettyJson(
        updateNodeAtPath(template, parentPath, (node) => ({
          ...setComponents(
            node,
            getComponents(node).filter((_, i) => i !== index)
          ),
        }))
      )
    );
    setSelectedPath(parentPath);
  };

  const moveSelected = (offset: -1 | 1) => {
    const path = selectedPath();
    const template = templateParsed();
    if (!template || path.length === 0) return;
    const parentPath = path.slice(0, -1);
    const index = path[path.length - 1];
    const target = index + offset;
    const parent = getNodeAtPath(template, parentPath);
    const components = parent ? getComponents(parent) : [];
    if (target < 0 || target >= components.length) return;
    setTemplateJson(
      prettyJson(
        updateNodeAtPath(template, parentPath, (node) => {
          const next = [...getComponents(node)];
          [next[index], next[target]] = [next[target], next[index]];
          return setComponents(node, next);
        })
      )
    );
    setSelectedPath([...parentPath, target]);
  };

  const requestCancel = () => {
    if (
      !isDirty() ||
      window.confirm(t('widgets.editor.discardChangesConfirm'))
    ) {
      props.onCancel();
    }
  };

  // ── Preview widget derived from editor state ─────────────────────────────
  const previewWidget = createMemo<JsonWidget | null>(() => {
    const template = templateParsed();
    if (!template || templateError()) return null;
    return {
      id: props.widget?.id,
      name: name() || 'Preview',
      description: description(),
      slug: props.widget?.slug || 'preview',
      template,
      options_schema: optionsSchemaParsed(),
      data_schema: dataSchemaParsed(),
      update_interval_seconds: Number(updateInterval()) || 60,
      aspect_ratio: aspectRatio() || undefined,
      fonts: fontsParsed(),
      assets: assetsParsed(),
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
  const previewKey = createMemo(() => {
    if (!previewWidget() || fixtureError()) return null;
    return JSON.stringify({
      revision: previewRevision(),
      template: templateJson(),
      optionsSchema: optionsSchemaJson(),
      dataSchema: dataSchemaJson(),
      assets: assetsJson(),
      fonts: fontsJson(),
      fixture: fixtureJson(),
      aspectRatio: aspectRatio(),
    });
  });

  // ── Fixture helpers ──────────────────────────────────────────────────────
  const saveFixture = () => {
    const n = fixtureName().trim();
    if (!n) {
      toast.showToast(t('widgets.editor.fixtureNameRequired'), 'error', 3000);
      return;
    }
    const [ok, val] = tryParseJson(fixtureJson());
    if (!ok) {
      toast.showToast(t('widgets.editor.invalidJson'), 'error', 3000);
      return;
    }
    const lib = {
      ...fixtureLibrary(),
      [n]: { data: val?.data || {}, options: val?.options || {} },
    };
    setFixtureLibrary(lib);
    saveFixtureLibrary(props.store.organizations.selectedId, lib);
    toast.showToast(t('widgets.editor.fixtureSaved'), 'success', 2000);
  };

  const loadFixture = (fixtureName: string) => {
    const fixture = fixtureLibrary()[fixtureName];
    if (fixture) {
      setFixtureJson(
        prettyJson({ data: fixture.data, options: fixture.options })
      );
      refreshPreview();
    }
  };

  const deleteFixture = (fixtureName: string) => {
    const lib = { ...fixtureLibrary() };
    delete lib[fixtureName];
    setFixtureLibrary(lib);
    saveFixtureLibrary(props.store.organizations.selectedId, lib);
  };

  // ── Save ─────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (hasErrors()) return;
    setIsSaving(true);

    try {
      const widgetData = {
        name: name().trim(),
        description: description().trim(),
        template: templateParsed()!,
        options_schema: optionsSchemaParsed() || {},
        data_schema: dataSchemaParsed() || {},
        assets: assetsParsed(),
        fonts: fontsParsed(),
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

      toast.showToast(
        isEditing()
          ? t('widgets.editor.savedSuccess')
          : t('widgets.editor.createdSuccess'),
        'success',
        3000
      );
      props.onSave(savedWidget);
    } catch (err: any) {
      toast.showToast(
        t('widgets.editor.saveError', {
          error: err.message || String(err),
        }),
        'error',
        5000
      );
    } finally {
      setIsSaving(false);
    }
  };

  // ── Tab list ─────────────────────────────────────────────────────────────
  const tabs: { key: EditorTab; label: string; hasError: () => boolean }[] = [
    {
      key: 'design',
      label: t('widgets.editor.design'),
      hasError: () => !!templateError(),
    },
    {
      key: 'template',
      label: t('widgets.template'),
      hasError: () => !!templateError(),
    },
    {
      key: 'options_schema',
      label: t('widgets.optionsSchema'),
      hasError: () => !!optionsSchemaError(),
    },
    {
      key: 'data_schema',
      label: t('widgets.dataSchema'),
      hasError: () => !!dataSchemaError(),
    },
    {
      key: 'assets',
      label: t('widgets.assets.title'),
      hasError: () => !!assetsError(),
    },
    {
      key: 'fonts',
      label: t('widgets.assets.fonts'),
      hasError: () => !!fontsError(),
    },
    {
      key: 'fixture',
      label: t('widgets.editor.fixture'),
      hasError: () => !!fixtureError(),
    },
    {
      key: 'settings',
      label: t('widgets.editor.settings'),
      hasError: () => !!updateIntervalError(),
    },
  ];

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div class="widget-editor">
      {/* Toolbar */}
      <div class="widget-editor__toolbar">
        <div class="widget-editor__toolbar-left">
          <button
            class="widget-editor__close-btn"
            onClick={requestCancel}
            title={t('common.cancel')}
          >
            <BsX size={20} />
          </button>
          <input
            class={`widget-editor__name-input ${!name().trim() ? 'widget-editor__name-input--error' : ''}`}
            type="text"
            placeholder={t('widgets.editor.namePlaceholder')}
            value={name()}
            onInput={(e) => setName(e.currentTarget.value)}
          />
          <Show when={!name().trim()}>
            <span class="widget-editor__inline-error">
              {t('widgets.editor.nameRequired')}
            </span>
          </Show>
        </div>

        <div class="widget-editor__toolbar-right">
          <Button
            label={t('common.cancel')}
            onClick={requestCancel}
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

      {/* Main body */}
      <div class="widget-editor__body">
        {/* Left – editor panel */}
        <div class="widget-editor__editor-panel">
          {/* Tab bar */}
          <div class="widget-editor__tab-bar">
            <For each={tabs}>
              {(tab) => (
                <button
                  class={`widget-editor__tab ${activeTab() === tab.key ? 'widget-editor__tab--active' : ''} ${tab.hasError() ? 'widget-editor__tab--error' : ''}`}
                  onClick={() => setActiveTab(tab.key)}
                >
                  {tab.label}
                  <Show when={tab.hasError()}>
                    <BsExclamationTriangle
                      class="widget-editor__tab-error-icon"
                      size={12}
                    />
                  </Show>
                </button>
              )}
            </For>
          </div>

          {/* Editor content */}
          <div class="widget-editor__editor-content">
            {/* Visual designer */}
            <Show when={activeTab() === 'design'}>
              <VisualDesigner
                template={templateParsed()}
                selectedPath={selectedPath()}
                onSelect={setSelectedPath}
                selectedNode={selectedNode()}
                onUpdate={updateSelectedNode}
                onAdd={addComponent}
                onRemove={removeSelected}
                onMove={moveSelected}
                t={t}
              />
            </Show>

            {/* Template */}
            <Show when={activeTab() === 'template'}>
              <JsonEditorPane
                value={templateJson()}
                onChange={(value) => {
                  setTemplateJson(value);
                  setSelectedPath([]);
                }}
                error={templateError()}
                placeholder={t('widgets.editor.templatePlaceholder')}
              />
            </Show>

            {/* Options Schema */}
            <Show when={activeTab() === 'options_schema'}>
              <JsonEditorPane
                value={optionsSchemaJson()}
                onChange={setOptionsSchemaJson}
                error={optionsSchemaError()}
                placeholder={t('widgets.editor.optionsSchemaPlaceholder')}
              />
            </Show>

            {/* Data Schema */}
            <Show when={activeTab() === 'data_schema'}>
              <JsonEditorPane
                value={dataSchemaJson()}
                onChange={setDataSchemaJson}
                error={dataSchemaError()}
                placeholder={t('widgets.editor.dataSchemaPlaceholder')}
              />
            </Show>

            <Show when={activeTab() === 'assets'}>
              <div class="widget-editor__fixture-panel">
                <p class="widget-editor__fixture-hint">
                  {t('widgets.editor.assetsHint')}
                </p>
                <JsonEditorPane
                  value={assetsJson()}
                  onChange={setAssetsJson}
                  error={assetsError()}
                  placeholder='{"images": {}}'
                />
              </div>
            </Show>

            <Show when={activeTab() === 'fonts'}>
              <div class="widget-editor__fixture-panel">
                <p class="widget-editor__fixture-hint">
                  {t('widgets.editor.fontsHint')}
                </p>
                <JsonEditorPane
                  value={fontsJson()}
                  onChange={setFontsJson}
                  error={fontsError()}
                  placeholder='[{"name": "", "url": ""}]'
                />
              </div>
            </Show>

            {/* Fixture */}
            <Show when={activeTab() === 'fixture'}>
              <div class="widget-editor__fixture-panel">
                <p class="widget-editor__fixture-hint">
                  {t('widgets.editor.fixtureHint')}
                </p>

                <JsonEditorPane
                  value={fixtureJson()}
                  onChange={setFixtureJson}
                  error={fixtureError()}
                  placeholder={t('widgets.editor.fixturePlaceholder')}
                />

                {/* Save fixture */}
                <div class="widget-editor__fixture-save">
                  <input
                    class="widget-editor__fixture-name-input"
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

                {/* Saved fixture library */}
                <Show when={Object.keys(fixtureLibrary()).length > 0}>
                  <div class="widget-editor__fixture-library">
                    <h4 class="widget-editor__fixture-library-title">
                      {t('widgets.editor.savedFixtures')}
                    </h4>
                    <For each={Object.entries(fixtureLibrary())}>
                      {([fname, _fixture]) => (
                        <div class="widget-editor__fixture-item">
                          <span class="widget-editor__fixture-item-name">
                            {fname}
                          </span>
                          <div class="widget-editor__fixture-item-actions">
                            <button
                              class="widget-editor__fixture-action"
                              onClick={() => loadFixture(fname)}
                              title={t('widgets.editor.loadFixture')}
                            >
                              <BsUpload size={14} />
                            </button>
                            <button
                              class="widget-editor__fixture-action widget-editor__fixture-action--danger"
                              onClick={() => deleteFixture(fname)}
                              title={t('common.delete')}
                            >
                              <BsX size={14} />
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
            <Show when={activeTab() === 'settings'}>
              <div class="widget-editor__settings-panel">
                <div class="widget-editor__field">
                  <label class="widget-editor__label">
                    {t('common.description')}
                  </label>
                  <textarea
                    class="widget-editor__textarea widget-editor__textarea--short"
                    value={description()}
                    onInput={(e) => setDescription(e.currentTarget.value)}
                    placeholder={t('widgets.editor.descriptionPlaceholder')}
                    rows={3}
                  />
                </div>

                <div class="widget-editor__field">
                  <label class="widget-editor__label">
                    {t('widgets.editor.aspectRatio')}
                  </label>
                  <select
                    class="widget-editor__select"
                    value={aspectRatio()}
                    onChange={(e) => setAspectRatio(e.currentTarget.value)}
                  >
                    <For each={ASPECT_RATIOS}>
                      {(ratio) => <option value={ratio}>{ratio}</option>}
                    </For>
                  </select>
                </div>

                <div class="widget-editor__field">
                  <label class="widget-editor__label">
                    {t('widgets.updateInterval')}
                  </label>
                  <input
                    class="widget-editor__input"
                    type="number"
                    min={5}
                    max={3600}
                    value={updateInterval()}
                    onInput={(e) => setUpdateInterval(e.currentTarget.value)}
                  />
                  <span class="widget-editor__field-hint">
                    {t('widgets.editor.updateIntervalHint')}
                  </span>
                  <Show when={updateIntervalError()}>
                    <span class="widget-editor__inline-error">
                      {updateIntervalError()}
                    </span>
                  </Show>
                </div>
              </div>
            </Show>
          </div>
        </div>

        {/* Right – preview panel */}
        <div class="widget-editor__preview-panel">
          <div class="widget-editor__preview-header">
            <span class="widget-editor__preview-title">
              {t('widgets.editor.livePreview')}
            </span>
            <button
              class="widget-editor__preview-refresh"
              onClick={() => refreshPreview()}
              title={t('widgets.editor.refreshPreview')}
            >
              {t('widgets.editor.refresh')}
            </button>
          </div>

          <div class="widget-editor__preview-container">
            <For
              each={previewKey() ? [previewKey()!] : []}
              fallback={
                <div class="widget-editor__preview-placeholder">
                  <BsExclamationTriangle size={32} />
                  <p>{t('widgets.editor.fixJsonToPreview')}</p>
                </div>
              }
            >
              {() => (
                <div
                  class="widget-editor__preview-aspect"
                  style={aspectRatioStyle(aspectRatio())}
                >
                  <ErrorBoundary
                    fallback={
                      <div class="widget-editor__preview-placeholder">
                        <BsExclamationTriangle size={32} />
                        <p>{t('widgets.editor.fixJsonToPreview')}</p>
                      </div>
                    }
                  >
                    <WidgetView
                      widget={previewWidget()!}
                      config={previewConfig()}
                      options={previewOptions()}
                      baseUrl={props.store.env.baseUrl}
                      socket={props.store.socket}
                    />
                  </ErrorBoundary>
                </div>
              )}
            </For>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Visual designer ──────────────────────────────────────────────────────────

interface VisualDesignerProps {
  template: TemplateNode | null;
  selectedPath: number[];
  selectedNode?: TemplateNode;
  onSelect: (path: number[]) => void;
  onUpdate: (update: (node: TemplateNode) => TemplateNode) => void;
  onAdd: (type: 'group' | 'text' | 'image') => void;
  onRemove: () => void;
  onMove: (offset: -1 | 1) => void;
  t: (key: string, params?: Record<string, any>) => string;
}

const VisualDesigner: Component<VisualDesignerProps> = (props) => {
  const styleValue = (key: string) => {
    const value = props.selectedNode?.style?.[key];
    return typeof value === 'string' || typeof value === 'number'
      ? String(value)
      : '';
  };

  const selectedValue = () => {
    const node = props.selectedNode;
    const value =
      node?.type === 'image'
        ? (node.opts?.url ?? node.opts?.src)
        : node?.opts?.text;
    return typeof value === 'object' && value?.key
      ? String(value.key)
      : String(value ?? '');
  };

  const valueSource = () => {
    const value =
      props.selectedNode?.type === 'image'
        ? (props.selectedNode?.opts?.url ?? props.selectedNode?.opts?.src)
        : props.selectedNode?.opts?.text;
    if (typeof value !== 'object' || !value?.key) return 'literal';
    return String(value.key).startsWith('data.') ? 'data' : 'options';
  };

  const updateValue = (source: string, value: string) => {
    props.onUpdate((node) => {
      const key =
        node.type === 'image' && 'src' in (node.opts || {}) ? 'src' : 'url';
      const nextValue =
        source === 'literal'
          ? value
          : {
              key: `${source}.${value.replace(/^(data|options)\./, '')}`,
              default: '',
            };
      return { ...node, opts: { ...node.opts, [key]: nextValue } };
    });
  };

  const updateStyle = (key: string, value: string) => {
    props.onUpdate((node) => {
      const style = { ...(node.style || {}) };
      if (value.trim()) style[key] = value;
      else delete style[key];
      return { ...node, style };
    });
  };

  return (
    <div class="widget-editor__designer">
      <div class="widget-editor__component-panel">
        <div class="widget-editor__section-header">
          <span>{props.t('widgets.editor.components')}</span>
          <div class="widget-editor__add-menu">
            <button
              onClick={() => props.onAdd('text')}
              title={props.t('widgets.editor.addText')}
            >
              <BsPlus size={12} /> {props.t('widgets.editor.text')}
            </button>
            <button
              onClick={() => props.onAdd('image')}
              title={props.t('widgets.editor.addImage')}
            >
              <BsPlus size={12} /> {props.t('widgets.editor.image')}
            </button>
            <button
              onClick={() => props.onAdd('group')}
              title={props.t('widgets.editor.addGroup')}
            >
              <BsPlus size={12} /> {props.t('widgets.editor.group')}
            </button>
          </div>
        </div>
        <Show
          when={props.template}
          fallback={
            <p class="widget-editor__designer-empty">
              {props.t('widgets.editor.fixJsonToPreview')}
            </p>
          }
        >
          <div class="widget-editor__component-tree">
            <ComponentTree
              node={props.template!}
              path={[]}
              selectedPath={props.selectedPath}
              onSelect={props.onSelect}
            />
          </div>
        </Show>
      </div>

      <div class="widget-editor__properties-panel">
        <div class="widget-editor__section-header">
          <span>{props.t('widgets.editor.properties')}</span>
          <Show when={props.selectedPath.length > 0}>
            <div class="widget-editor__property-actions">
              <button
                onClick={() => props.onMove(-1)}
                title={props.t('widgets.editor.moveUp')}
              >
                <BsArrowUp size={14} />
              </button>
              <button
                onClick={() => props.onMove(1)}
                title={props.t('widgets.editor.moveDown')}
              >
                <BsArrowDown size={14} />
              </button>
              <button
                class="danger"
                onClick={props.onRemove}
                title={props.t('common.delete')}
              >
                <BsTrash size={14} />
              </button>
            </div>
          </Show>
        </div>
        <Show
          when={props.selectedNode}
          fallback={
            <p class="widget-editor__designer-empty">
              {props.t('widgets.editor.selectComponent')}
            </p>
          }
        >
          {(node) => (
            <div class="widget-editor__property-form">
              <DesignerField label={props.t('common.name')}>
                <input
                  value={node().name || ''}
                  onInput={(event) =>
                    props.onUpdate((current) => ({
                      ...current,
                      name: event.currentTarget.value,
                    }))
                  }
                />
              </DesignerField>

              <Show when={node().type === 'text' || node().type === 'image'}>
                <DesignerField label={props.t('widgets.editor.contentSource')}>
                  <select
                    value={valueSource()}
                    onChange={(event) =>
                      updateValue(event.currentTarget.value, selectedValue())
                    }
                  >
                    <option value="literal">
                      {props.t('widgets.editor.fixedValue')}
                    </option>
                    <option value="options">
                      {props.t('widgets.editor.widgetOption')}
                    </option>
                    <option value="data">
                      {props.t('widgets.editor.fixtureData')}
                    </option>
                  </select>
                </DesignerField>
                <DesignerField
                  label={
                    valueSource() === 'literal'
                      ? props.t('widgets.editor.value')
                      : props.t('widgets.editor.fieldName')
                  }
                >
                  <input
                    value={selectedValue().replace(/^(data|options)\./, '')}
                    onInput={(event) =>
                      updateValue(valueSource(), event.currentTarget.value)
                    }
                  />
                </DesignerField>
              </Show>

              <Show when={node().type === 'image'}>
                <DesignerField label={props.t('widgets.editor.imageFit')}>
                  <select
                    value={node().opts?.size || 'cover'}
                    onChange={(event) =>
                      props.onUpdate((current) => ({
                        ...current,
                        opts: {
                          ...current.opts,
                          size: event.currentTarget.value,
                        },
                      }))
                    }
                  >
                    <option value="cover">
                      {props.t('widgets.editor.cover')}
                    </option>
                    <option value="contain">
                      {props.t('widgets.editor.contain')}
                    </option>
                  </select>
                </DesignerField>
              </Show>

              <Show when={node().type === 'group'}>
                <DesignerField label={props.t('widgets.editor.direction')}>
                  <select
                    value={node().style?.['flex-direction'] || 'column'}
                    onChange={(event) =>
                      updateStyle('flex-direction', event.currentTarget.value)
                    }
                  >
                    <option value="column">
                      {props.t('widgets.editor.vertical')}
                    </option>
                    <option value="row">
                      {props.t('widgets.editor.horizontal')}
                    </option>
                  </select>
                </DesignerField>
              </Show>

              <div class="widget-editor__property-grid">
                <DesignerField label={props.t('widgets.editor.width')}>
                  <input
                    value={styleValue('width')}
                    placeholder="100%"
                    onInput={(event) =>
                      updateStyle('width', event.currentTarget.value)
                    }
                  />
                </DesignerField>
                <DesignerField label={props.t('widgets.editor.height')}>
                  <input
                    value={styleValue('height')}
                    placeholder="100%"
                    onInput={(event) =>
                      updateStyle('height', event.currentTarget.value)
                    }
                  />
                </DesignerField>
                <DesignerField label={props.t('widgets.editor.textColor')}>
                  <input
                    type="color"
                    value={styleValue('color') || '#ffffff'}
                    onInput={(event) =>
                      updateStyle('color', event.currentTarget.value)
                    }
                  />
                </DesignerField>
                <DesignerField label={props.t('widgets.editor.background')}>
                  <input
                    value={
                      styleValue('background') || styleValue('background-color')
                    }
                    placeholder="#000000"
                    onInput={(event) =>
                      updateStyle(
                        node().style?.background !== undefined
                          ? 'background'
                          : 'background-color',
                        event.currentTarget.value
                      )
                    }
                  />
                </DesignerField>
                <DesignerField label={props.t('widgets.editor.fontSize')}>
                  <input
                    value={styleValue('font-size')}
                    placeholder="1em"
                    onInput={(event) =>
                      updateStyle('font-size', event.currentTarget.value)
                    }
                  />
                </DesignerField>
                <DesignerField label={props.t('widgets.editor.spacing')}>
                  <input
                    value={styleValue('padding')}
                    placeholder="1em"
                    onInput={(event) =>
                      updateStyle('padding', event.currentTarget.value)
                    }
                  />
                </DesignerField>
                <DesignerField label={props.t('widgets.editor.position')}>
                  <select
                    value={styleValue('position')}
                    onChange={(event) =>
                      updateStyle('position', event.currentTarget.value)
                    }
                  >
                    <option value="">
                      {props.t('widgets.editor.automatic')}
                    </option>
                    <option value="relative">relative</option>
                    <option value="absolute">absolute</option>
                    <option value="fixed">fixed</option>
                  </select>
                </DesignerField>
                <DesignerField label={props.t('widgets.editor.display')}>
                  <select
                    value={styleValue('display')}
                    onChange={(event) =>
                      updateStyle('display', event.currentTarget.value)
                    }
                  >
                    <option value="">
                      {props.t('widgets.editor.automatic')}
                    </option>
                    <option value="block">block</option>
                    <option value="flex">flex</option>
                    <option value="grid">grid</option>
                    <option value="none">none</option>
                  </select>
                </DesignerField>
                <For each={['top', 'right', 'bottom', 'left']}>
                  {(key) => (
                    <DesignerField label={props.t(`widgets.editor.${key}`)}>
                      <input
                        value={styleValue(key)}
                        placeholder="0"
                        onInput={(event) =>
                          updateStyle(key, event.currentTarget.value)
                        }
                      />
                    </DesignerField>
                  )}
                </For>
                <DesignerField label={props.t('widgets.editor.alignment')}>
                  <select
                    value={styleValue('align-items')}
                    onChange={(event) =>
                      updateStyle('align-items', event.currentTarget.value)
                    }
                  >
                    <option value="">
                      {props.t('widgets.editor.automatic')}
                    </option>
                    <option value="flex-start">flex-start</option>
                    <option value="center">center</option>
                    <option value="flex-end">flex-end</option>
                    <option value="stretch">stretch</option>
                    <option value="baseline">baseline</option>
                  </select>
                </DesignerField>
                <DesignerField label={props.t('widgets.editor.justification')}>
                  <select
                    value={styleValue('justify-content')}
                    onChange={(event) =>
                      updateStyle('justify-content', event.currentTarget.value)
                    }
                  >
                    <option value="">
                      {props.t('widgets.editor.automatic')}
                    </option>
                    <option value="flex-start">flex-start</option>
                    <option value="center">center</option>
                    <option value="flex-end">flex-end</option>
                    <option value="space-between">space-between</option>
                    <option value="space-around">space-around</option>
                    <option value="space-evenly">space-evenly</option>
                  </select>
                </DesignerField>
                <DesignerField label={props.t('widgets.editor.gap')}>
                  <input
                    value={styleValue('gap')}
                    placeholder="0.5em"
                    onInput={(event) =>
                      updateStyle('gap', event.currentTarget.value)
                    }
                  />
                </DesignerField>
                <DesignerField label={props.t('widgets.editor.margin')}>
                  <input
                    value={styleValue('margin')}
                    placeholder="0"
                    onInput={(event) =>
                      updateStyle('margin', event.currentTarget.value)
                    }
                  />
                </DesignerField>
                <DesignerField label={props.t('widgets.editor.overflow')}>
                  <select
                    value={styleValue('overflow')}
                    onChange={(event) =>
                      updateStyle('overflow', event.currentTarget.value)
                    }
                  >
                    <option value="">
                      {props.t('widgets.editor.automatic')}
                    </option>
                    <option value="visible">visible</option>
                    <option value="hidden">hidden</option>
                    <option value="auto">auto</option>
                    <option value="scroll">scroll</option>
                  </select>
                </DesignerField>
                <DesignerField label={props.t('widgets.editor.opacity')}>
                  <input
                    type="number"
                    min="0"
                    max="1"
                    step="0.05"
                    value={styleValue('opacity')}
                    placeholder="1"
                    onInput={(event) =>
                      updateStyle('opacity', event.currentTarget.value)
                    }
                  />
                </DesignerField>
                <DesignerField label={props.t('widgets.editor.fontWeight')}>
                  <input
                    value={styleValue('font-weight')}
                    placeholder="400"
                    onInput={(event) =>
                      updateStyle('font-weight', event.currentTarget.value)
                    }
                  />
                </DesignerField>
                <DesignerField label={props.t('widgets.editor.lineHeight')}>
                  <input
                    value={styleValue('line-height')}
                    placeholder="1.4"
                    onInput={(event) =>
                      updateStyle('line-height', event.currentTarget.value)
                    }
                  />
                </DesignerField>
                <DesignerField label={props.t('widgets.editor.textAlign')}>
                  <select
                    value={styleValue('text-align')}
                    onChange={(event) =>
                      updateStyle('text-align', event.currentTarget.value)
                    }
                  >
                    <option value="">
                      {props.t('widgets.editor.automatic')}
                    </option>
                    <option value="left">left</option>
                    <option value="center">center</option>
                    <option value="right">right</option>
                  </select>
                </DesignerField>
              </div>
              <details class="widget-editor__advanced-properties">
                <summary>{props.t('widgets.editor.advanced')}</summary>
                <JsonObjectDesignerField
                  label={props.t('widgets.editor.componentOptions')}
                  value={node().opts || {}}
                  onChange={(opts) =>
                    props.onUpdate((current) => ({ ...current, opts }))
                  }
                  invalidLabel={props.t('widgets.editor.invalidJsonObject')}
                />
                <JsonObjectDesignerField
                  label={props.t('widgets.editor.componentStyles')}
                  value={node().style || {}}
                  onChange={(style) =>
                    props.onUpdate((current) => ({ ...current, style }))
                  }
                  invalidLabel={props.t('widgets.editor.invalidJsonObject')}
                />
                <JsonObjectDesignerField
                  label={props.t('widgets.editor.visibilityFilter')}
                  value={node().filter || {}}
                  onChange={(filter) =>
                    props.onUpdate((current) => ({
                      ...current,
                      filter:
                        Object.keys(filter).length > 0 ? filter : undefined,
                    }))
                  }
                  invalidLabel={props.t('widgets.editor.invalidJsonObject')}
                />
              </details>
            </div>
          )}
        </Show>
      </div>
    </div>
  );
};

const DesignerField: Component<{
  label: string;
  children: any;
}> = (props) => (
  <label class="widget-editor__designer-field">
    <span>{props.label}</span>
    {props.children}
  </label>
);

const JsonObjectDesignerField: Component<{
  label: string;
  value: Record<string, any>;
  onChange: (value: Record<string, any>) => void;
  invalidLabel: string;
}> = (props) => {
  const [text, setText] = createSignal(prettyJson(props.value));
  const error = createMemo(() => {
    const [ok, value] = tryParseJson(text());
    return ok && isJsonObject(value) ? null : props.invalidLabel;
  });

  createEffect(() => setText(prettyJson(props.value)));

  const update = (value: string) => {
    setText(value);
    const [ok, parsed] = tryParseJson(value);
    if (ok && isJsonObject(parsed)) props.onChange(parsed);
  };

  return (
    <DesignerField label={props.label}>
      <textarea
        classList={{ error: !!error() }}
        value={text()}
        onInput={(event) => update(event.currentTarget.value)}
      />
      <Show when={error()}>
        <small class="widget-editor__designer-error">{error()}</small>
      </Show>
    </DesignerField>
  );
};

const ComponentTree: Component<{
  node: TemplateNode;
  path: number[];
  selectedPath: number[];
  onSelect: (path: number[]) => void;
}> = (props) => {
  const selected = () =>
    props.path.length === props.selectedPath.length &&
    props.path.every((index, i) => index === props.selectedPath[i]);

  return (
    <div class="widget-editor__tree-branch">
      <button
        class={`widget-editor__tree-node ${selected() ? 'widget-editor__tree-node--selected' : ''}`}
        style={`--tree-depth: ${props.path.length}`}
        onClick={() => props.onSelect(props.path)}
      >
        <span
          class={`widget-editor__type-dot widget-editor__type-dot--${props.node.type}`}
        />
        <span>{props.node.name || props.node.type}</span>
        <small>{props.node.type}</small>
      </button>
      <For each={getComponents(props.node)}>
        {(child, index) => (
          <ComponentTree
            node={child}
            path={[...props.path, index()]}
            selectedPath={props.selectedPath}
            onSelect={props.onSelect}
          />
        )}
      </For>
    </div>
  );
};

// ─── JSON Editor pane ─────────────────────────────────────────────────────────

interface JsonEditorPaneProps {
  value: string;
  onChange: (value: string) => void;
  error: string | null;
  placeholder?: string;
}

const JsonEditorPane: Component<JsonEditorPaneProps> = (props) => {
  return (
    <div class="widget-editor__json-pane">
      <textarea
        class={`widget-editor__json-textarea ${props.error ? 'widget-editor__json-textarea--error' : ''}`}
        value={props.value}
        onInput={(e) => props.onChange(e.currentTarget.value)}
        placeholder={props.placeholder || '{}'}
        spellcheck={false}
        autocomplete="off"
        autocorrect="off"
        autocapitalize="off"
      />
      <Show when={props.error}>
        <div class="widget-editor__json-error">
          <BsExclamationTriangle size={12} />
          <span>{props.error}</span>
        </div>
      </Show>
    </div>
  );
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function aspectRatioStyle(_ratio: string): string {
  // WidgetView performs the contain calculation from the widget aspect ratio.
  return 'width: 100%; height: 100%;';
}
