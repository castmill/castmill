import {
  Component,
  createSignal,
  createMemo,
  Show,
  For,
} from 'solid-js';
import {
  Button,
  useToast,
} from '@castmill/ui-common';
import {
  BsX,
  BsUpload,
  BsExclamationTriangle,
} from 'solid-icons/bs';
import { AiOutlineSave } from 'solid-icons/ai';
import { JsonWidget, JsonWidgetConfig, OptionsDict } from '@castmill/player';
import { WidgetView } from '../../playlists/components/widget-view';
import { WidgetsService, WidgetCreateFromJson, WidgetFullUpdate } from '../services/widgets.service';
import { AddonStore } from '../../common/interfaces/addon-store';

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

type EditorTab = 'template' | 'options_schema' | 'data_schema' | 'fixture' | 'settings';

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

const DEFAULT_TEMPLATE = prettyJson({
  type: 'group',
  name: 'my-widget',
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
        },
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

// ─── Component ───────────────────────────────────────────────────────────────

export const WidgetEditor: Component<WidgetEditorProps> = (props) => {
  const toast = useToast();
  const t = (key: string, params?: Record<string, any>) =>
    props.store.i18n?.t(key, params) || key;

  const isEditing = () => props.widget !== undefined;

  // ── Metadata fields ─────────────────────────────────────────────────────
  const [name, setName] = createSignal(props.widget?.name || '');
  const [description, setDescription] = createSignal(props.widget?.description || '');
  const [aspectRatio, setAspectRatio] = createSignal(props.widget?.aspect_ratio || '16:9');
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

  // ── Fixture ─────────────────────────────────────────────────────────────
  const [fixtureJson, setFixtureJson] = createSignal(DEFAULT_FIXTURE);
  const [fixtureName, setFixtureName] = createSignal('');
  const [fixtureLibrary, setFixtureLibrary] = createSignal<Record<string, WidgetFixture>>(
    loadFixtureLibrary()
  );

  // ── UI state ────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = createSignal<EditorTab>('template');
  const [isSaving, setIsSaving] = createSignal(false);
  // Used to force the preview panel to remount WidgetView
  const [showPreview, setShowPreview] = createSignal(true);

  const refreshPreview = () => {
    setShowPreview(false);
    // Allow one tick for cleanup, then remount
    setTimeout(() => setShowPreview(true), 50);
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
  const fixtureParsed = createMemo(() => {
    const [ok, val] = tryParseJson(fixtureJson());
    if (!ok || !val) return { data: {}, options: {} };
    return {
      data: val.data || {},
      options: val.options || {},
    };
  });

  // ── Derived: per-tab validation errors ──────────────────────────────────
  const templateError = createMemo(() => {
    const [ok, err] = tryParseJson(templateJson());
    return ok ? null : String(err);
  });
  const optionsSchemaError = createMemo(() => {
    const [ok, err] = tryParseJson(optionsSchemaJson());
    return ok ? null : String(err);
  });
  const dataSchemaError = createMemo(() => {
    const [ok, err] = tryParseJson(dataSchemaJson());
    return ok ? null : String(err);
  });
  const fixtureError = createMemo(() => {
    const [ok, err] = tryParseJson(fixtureJson());
    return ok ? null : String(err);
  });

  const hasErrors = createMemo(
    () =>
      !!templateError() ||
      !!optionsSchemaError() ||
      !!dataSchemaError() ||
      !name().trim()
  );

  // ── Preview widget derived from editor state ─────────────────────────────
  const previewWidget = createMemo<JsonWidget | null>(() => {
    const template = templateParsed();
    if (!template) return null;
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

  const previewOptions = createMemo<OptionsDict>(() => fixtureParsed().options as OptionsDict);

  // ── Fixture helpers ──────────────────────────────────────────────────────
  const saveFixture = () => {
    const n = fixtureName().trim();
    if (!n) {
      toast.show({ message: t('widgets.editor.fixtureNameRequired'), type: 'error', duration: 3000 });
      return;
    }
    const [ok, val] = tryParseJson(fixtureJson());
    if (!ok) {
      toast.show({ message: t('widgets.editor.invalidJson'), type: 'error', duration: 3000 });
      return;
    }
    const lib = { ...fixtureLibrary(), [n]: { data: val?.data || {}, options: val?.options || {} } };
    setFixtureLibrary(lib);
    saveFixtureLibrary(lib);
    toast.show({ message: t('widgets.editor.fixtureSaved'), type: 'success', duration: 2000 });
  };

  const loadFixture = (fixtureName: string) => {
    const fixture = fixtureLibrary()[fixtureName];
    if (fixture) {
      setFixtureJson(prettyJson({ data: fixture.data, options: fixture.options }));
      refreshPreview();
    }
  };

  const deleteFixture = (fixtureName: string) => {
    const lib = { ...fixtureLibrary() };
    delete lib[fixtureName];
    setFixtureLibrary(lib);
    saveFixtureLibrary(lib);
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
        message: t('widgets.editor.saveError', { error: err.message || String(err) }),
        type: 'error',
        duration: 5000,
      });
    } finally {
      setIsSaving(false);
    }
  };

  // ── Tab list ─────────────────────────────────────────────────────────────
  const tabs: { key: EditorTab; label: string; hasError: () => boolean }[] = [
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
      key: 'fixture',
      label: t('widgets.editor.fixture'),
      hasError: () => !!fixtureError(),
    },
    {
      key: 'settings',
      label: t('widgets.editor.settings'),
      hasError: () => false,
    },
  ];

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div class="widget-editor">
      {/* Toolbar */}
      <div class="widget-editor__toolbar">
        <div class="widget-editor__toolbar-left">
          <button class="widget-editor__close-btn" onClick={props.onCancel} title={t('common.cancel')}>
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
            onClick={props.onCancel}
            color="secondary"
            disabled={isSaving()}
          />
          <Button
            label={isSaving() ? t('common.saving') : (isEditing() ? t('common.save') : t('widgets.editor.createWidget'))}
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
                    <BsExclamationTriangle class="widget-editor__tab-error-icon" size={12} />
                  </Show>
                </button>
              )}
            </For>
          </div>

          {/* Editor content */}
          <div class="widget-editor__editor-content">
            {/* Template */}
            <Show when={activeTab() === 'template'}>
              <JsonEditorPane
                value={templateJson()}
                onChange={setTemplateJson}
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

            {/* Fixture */}
            <Show when={activeTab() === 'fixture'}>
              <div class="widget-editor__fixture-panel">
                <p class="widget-editor__fixture-hint">
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
                          <span class="widget-editor__fixture-item-name">{fname}</span>
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
                  <label class="widget-editor__label">{t('common.description')}</label>
                  <textarea
                    class="widget-editor__textarea widget-editor__textarea--short"
                    value={description()}
                    onInput={(e) => setDescription(e.currentTarget.value)}
                    placeholder={t('widgets.editor.descriptionPlaceholder')}
                    rows={3}
                  />
                </div>

                <div class="widget-editor__field">
                  <label class="widget-editor__label">{t('widgets.editor.aspectRatio')}</label>
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
                  <label class="widget-editor__label">{t('widgets.updateInterval')}</label>
                  <input
                    class="widget-editor__input"
                    type="number"
                    min={5}
                    max={3600}
                    value={updateInterval()}
                    onInput={(e) => setUpdateInterval(e.currentTarget.value)}
                  />
                  <span class="widget-editor__field-hint">{t('widgets.editor.updateIntervalHint')}</span>
                </div>
              </div>
            </Show>
          </div>
        </div>

        {/* Right – preview panel */}
        <div class="widget-editor__preview-panel">
          <div class="widget-editor__preview-header">
            <span class="widget-editor__preview-title">{t('widgets.editor.livePreview')}</span>
            <button
              class="widget-editor__preview-refresh"
              onClick={() => refreshPreview()}
              title={t('widgets.editor.refreshPreview')}
            >
              {t('widgets.editor.refresh')}
            </button>
          </div>

          <div class="widget-editor__preview-container">
            <Show
              when={previewWidget() !== null}
              fallback={
                <div class="widget-editor__preview-placeholder">
                  <BsExclamationTriangle size={32} />
                  <p>{t('widgets.editor.fixJsonToPreview')}</p>
                </div>
              }
            >
              <div class="widget-editor__preview-aspect" style={aspectRatioStyle(aspectRatio())}>
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
            </Show>
          </div>
        </div>
      </div>
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

function aspectRatioStyle(ratio: string): string {
  // Convert "16:9" → padding-top trick for aspect ratio
  const parts = ratio.split(':');
  if (parts.length === 2) {
    const [w, h] = parts.map(Number);
    if (w > 0 && h > 0) {
      return `aspect-ratio: ${w} / ${h}; width: 100%; max-height: 100%;`;
    }
  }
  // liquid / unknown
  return 'width: 100%; height: 100%;';
}
