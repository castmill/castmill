import {
  Component,
  createSignal,
  createEffect,
  Show,
  For,
  batch,
} from 'solid-js';
import {
  TemplateNode,
  ComponentType,
  componentTypeLabel,
} from './template-model';

// ─── Types ──────────────────────────────────────────────────────────────────

/** Castmill custom schema type (not JSON Schema). */
export type WidgetSchema = Record<string, any> | undefined;

export interface PropertyInspectorProps {
  node: TemplateNode | null;
  onChange: (updated: TemplateNode) => void;
  t: (key: string, params?: Record<string, any>) => string;
  /** Parsed options_schema of the widget being edited. */
  optionsSchema?: WidgetSchema;
  /** Parsed data_schema of the widget being edited. */
  dataSchema?: WidgetSchema;
}

// ─── CSS property groups ────────────────────────────────────────────────────

interface StyleField {
  key: string;
  label: string;
  type: 'text' | 'color' | 'select' | 'number';
  options?: string[];
  unit?: string;
}

const LAYOUT_FIELDS: StyleField[] = [
  {
    key: 'display',
    label: 'Display',
    type: 'select',
    options: ['flex', 'block', 'grid', 'none', 'inline-flex'],
  },
  {
    key: 'flex-direction',
    label: 'Direction',
    type: 'select',
    options: ['row', 'column', 'row-reverse', 'column-reverse'],
  },
  {
    key: 'align-items',
    label: 'Align Items',
    type: 'select',
    options: ['stretch', 'center', 'flex-start', 'flex-end', 'baseline'],
  },
  {
    key: 'justify-content',
    label: 'Justify',
    type: 'select',
    options: [
      'flex-start',
      'center',
      'flex-end',
      'space-between',
      'space-around',
      'space-evenly',
    ],
  },
  {
    key: 'flex-wrap',
    label: 'Wrap',
    type: 'select',
    options: ['nowrap', 'wrap', 'wrap-reverse'],
  },
  { key: 'gap', label: 'Gap', type: 'text' },
];

const SIZE_FIELDS: StyleField[] = [
  { key: 'width', label: 'Width', type: 'text' },
  { key: 'height', label: 'Height', type: 'text' },
  { key: 'min-width', label: 'Min Width', type: 'text' },
  { key: 'min-height', label: 'Min Height', type: 'text' },
  { key: 'max-width', label: 'Max Width', type: 'text' },
  { key: 'max-height', label: 'Max Height', type: 'text' },
];

const SPACING_FIELDS: StyleField[] = [
  { key: 'padding', label: 'Padding', type: 'text' },
  { key: 'padding-top', label: 'Pad Top', type: 'text' },
  { key: 'padding-right', label: 'Pad Right', type: 'text' },
  { key: 'padding-bottom', label: 'Pad Bottom', type: 'text' },
  { key: 'padding-left', label: 'Pad Left', type: 'text' },
  { key: 'margin', label: 'Margin', type: 'text' },
  { key: 'margin-top', label: 'Margin Top', type: 'text' },
  { key: 'margin-right', label: 'Margin Right', type: 'text' },
  { key: 'margin-bottom', label: 'Margin Bottom', type: 'text' },
  { key: 'margin-left', label: 'Margin Left', type: 'text' },
];

const POSITION_FIELDS: StyleField[] = [
  {
    key: 'position',
    label: 'Position',
    type: 'select',
    options: ['static', 'relative', 'absolute', 'fixed'],
  },
  { key: 'top', label: 'Top', type: 'text' },
  { key: 'right', label: 'Right', type: 'text' },
  { key: 'bottom', label: 'Bottom', type: 'text' },
  { key: 'left', label: 'Left', type: 'text' },
  { key: 'z-index', label: 'Z-Index', type: 'text' },
];

const TYPOGRAPHY_FIELDS: StyleField[] = [
  { key: 'color', label: 'Color', type: 'color' },
  { key: 'font-size', label: 'Font Size', type: 'text' },
  {
    key: 'font-weight',
    label: 'Font Weight',
    type: 'select',
    options: ['100', '200', '300', '400', '500', '600', '700', '800', '900'],
  },
  { key: 'font-family', label: 'Font Family', type: 'text' },
  {
    key: 'text-align',
    label: 'Text Align',
    type: 'select',
    options: ['left', 'center', 'right', 'justify'],
  },
  { key: 'line-height', label: 'Line Height', type: 'text' },
  { key: 'letter-spacing', label: 'Letter Spacing', type: 'text' },
  {
    key: 'text-transform',
    label: 'Transform',
    type: 'select',
    options: ['none', 'uppercase', 'lowercase', 'capitalize'],
  },
];

const APPEARANCE_FIELDS: StyleField[] = [
  { key: 'background-color', label: 'Background', type: 'color' },
  { key: 'background', label: 'Background CSS', type: 'text' },
  { key: 'opacity', label: 'Opacity', type: 'text' },
  {
    key: 'overflow',
    label: 'Overflow',
    type: 'select',
    options: ['visible', 'hidden', 'scroll', 'auto'],
  },
  { key: 'border-radius', label: 'Border Radius', type: 'text' },
  { key: 'border', label: 'Border', type: 'text' },
  { key: 'box-shadow', label: 'Box Shadow', type: 'text' },
  {
    key: 'object-fit',
    label: 'Object Fit',
    type: 'select',
    options: ['cover', 'contain', 'fill', 'none', 'scale-down'],
  },
];

// ─── Type-specific opts fields ──────────────────────────────────────────────

interface OptsField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'boolean' | 'json' | 'binding';
  description?: string;
}

function getOptsFields(nodeType: ComponentType): OptsField[] {
  switch (nodeType) {
    case 'text':
      return [
        {
          key: 'text',
          label: 'Text Content',
          type: 'binding',
          description: 'Static text or { type: "opt", key: "..." }',
        },
        {
          key: 'autofit',
          label: 'Auto Fit',
          type: 'json',
          description: 'Auto-fit settings: { baseSize, maxSize, minSize }',
        },
        { key: 'chars', label: 'Char Animation', type: 'boolean' },
        { key: 'perspective', label: 'Perspective', type: 'number' },
      ];
    case 'image':
      return [
        {
          key: 'src',
          label: 'Source URL',
          type: 'binding',
          description: 'Image URL or binding',
        },
        {
          key: 'url',
          label: 'URL (alt)',
          type: 'binding',
          description: 'Alternative URL field',
        },
        { key: 'fallbackUrl', label: 'Fallback URL', type: 'text' },
        {
          key: 'size',
          label: 'Size Mode',
          type: 'text',
          description: 'cover | contain',
        },
        { key: 'duration', label: 'Duration (ms)', type: 'number' },
        { key: 'autozoom', label: 'Auto Zoom', type: 'boolean' },
      ];
    case 'video':
      return [
        { key: 'src', label: 'Source URL', type: 'binding' },
        { key: 'muted', label: 'Muted', type: 'boolean' },
        { key: 'loop', label: 'Loop', type: 'boolean' },
        { key: 'autoplay', label: 'Autoplay', type: 'boolean' },
      ];
    case 'paginated-list':
      return [
        {
          key: 'data',
          label: 'Data Source',
          type: 'json',
          description: 'E.g. { type: "ctx", key: "posts" }',
        },
        { key: 'page_size', label: 'Page Size', type: 'number' },
        { key: 'page_duration', label: 'Page Duration (s)', type: 'number' },
        {
          key: 'transition',
          label: 'Transition',
          type: 'json',
          description: '{ type, duration, easing }',
        },
      ];
    case 'scroller':
      return [
        { key: 'speed', label: 'Speed', type: 'number' },
        {
          key: 'direction',
          label: 'Direction',
          type: 'text',
          description: 'up | down | left | right',
        },
      ];
    case 'image-carousel':
      return [
        {
          key: 'images',
          label: 'Images',
          type: 'json',
          description: 'Array of image URLs',
        },
        { key: 'duration', label: 'Duration (ms)', type: 'number' },
      ];
    case 'qr-code':
      return [
        { key: 'data', label: 'Data/URL', type: 'binding' },
        { key: 'color', label: 'Color', type: 'text' },
        { key: 'backgroundColor', label: 'Background', type: 'text' },
      ];
    case 'group':
    default:
      return [];
  }
}

// ─── Component ──────────────────────────────────────────────────────────────

export const PropertyInspector: Component<PropertyInspectorProps> = (props) => {
  const [activeSection, setActiveSection] = createSignal<string>('opts');

  // ── Helpers ──────────────────────────────────────────────────────────────

  const getStyle = (): Record<string, any> => props.node?.opts?.style || {};

  const updateStyle = (key: string, value: string) => {
    if (!props.node) return;
    const style = { ...getStyle() };
    if (value === '' || value === undefined) {
      delete style[key];
    } else {
      style[key] = value;
    }
    props.onChange({
      ...props.node,
      opts: { ...props.node.opts, style },
    });
  };

  const updateOpt = (key: string, value: any) => {
    if (!props.node) return;
    const newOpts = { ...props.node.opts };
    if (value === '' || value === undefined || value === null) {
      delete newOpts[key];
    } else {
      newOpts[key] = value;
    }
    props.onChange({
      ...props.node,
      opts: newOpts,
    });
  };

  const updateName = (name: string) => {
    if (!props.node) return;
    props.onChange({ ...props.node, name });
  };

  const parseBindingValue = (raw: string): any => {
    const trimmed = raw.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        return JSON.parse(trimmed);
      } catch {
        return raw;
      }
    }
    return raw;
  };

  const stringifyBindingValue = (val: any): string => {
    if (val === null || val === undefined) return '';
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val);
  };

  // ── Sections ─────────────────────────────────────────────────────────────

  const sections = [
    { key: 'opts', label: 'Properties' },
    { key: 'layout', label: 'Layout' },
    { key: 'size', label: 'Size' },
    { key: 'spacing', label: 'Spacing' },
    { key: 'position', label: 'Position' },
    { key: 'typography', label: 'Typography' },
    { key: 'appearance', label: 'Appearance' },
    { key: 'advanced', label: 'Advanced' },
  ];

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <Show
      when={props.node}
      fallback={
        <div class="pi__empty">
          <p>{props.t('widgets.editor.selectComponent')}</p>
        </div>
      }
    >
      <div class="pi">
        {/* Node identity */}
        <div class="pi__header">
          <div class="pi__type-badge">{props.node!.type}</div>
          <input
            class="pi__name-input"
            type="text"
            value={props.node!.name}
            onInput={(e) => updateName(e.currentTarget.value)}
            placeholder="Component name"
          />
        </div>

        {/* Section tabs */}
        <div class="pi__section-tabs">
          <For each={sections}>
            {(section) => (
              <button
                class={`pi__section-tab ${activeSection() === section.key ? 'pi__section-tab--active' : ''}`}
                onClick={() => setActiveSection(section.key)}
              >
                {section.label}
              </button>
            )}
          </For>
        </div>

        {/* Content */}
        <div class="pi__content">
          {/* Properties (type-specific opts) */}
          <Show when={activeSection() === 'opts'}>
            <div class="pi__section">
              <For each={getOptsFields(props.node!.type)}>
                {(field) => (
                  <div class="pi__field">
                    <label class="pi__label">
                      {field.label}
                      <Show when={field.description}>
                        <span class="pi__hint" title={field.description}>
                          ?
                        </span>
                      </Show>
                    </label>
                    <Show
                      when={field.type === 'binding'}
                      fallback={renderOptsField(
                        field,
                        props.node!.opts,
                        updateOpt,
                        parseBindingValue,
                        stringifyBindingValue
                      )}
                    >
                      <BindingField
                        value={props.node!.opts[field.key]}
                        onChange={(val) => updateOpt(field.key, val)}
                        optionsSchema={props.optionsSchema}
                        dataSchema={props.dataSchema}
                      />
                    </Show>
                  </div>
                )}
              </For>
              <Show when={getOptsFields(props.node!.type).length === 0}>
                <p class="pi__no-fields">
                  No configurable properties for this component type.
                </p>
              </Show>
            </div>
          </Show>

          {/* Style sections */}
          <Show when={activeSection() === 'layout'}>
            <StyleSection
              fields={LAYOUT_FIELDS}
              style={getStyle()}
              onUpdate={updateStyle}
            />
          </Show>
          <Show when={activeSection() === 'size'}>
            <StyleSection
              fields={SIZE_FIELDS}
              style={getStyle()}
              onUpdate={updateStyle}
            />
          </Show>
          <Show when={activeSection() === 'spacing'}>
            <StyleSection
              fields={SPACING_FIELDS}
              style={getStyle()}
              onUpdate={updateStyle}
            />
          </Show>
          <Show when={activeSection() === 'position'}>
            <StyleSection
              fields={POSITION_FIELDS}
              style={getStyle()}
              onUpdate={updateStyle}
            />
          </Show>
          <Show when={activeSection() === 'typography'}>
            <StyleSection
              fields={TYPOGRAPHY_FIELDS}
              style={getStyle()}
              onUpdate={updateStyle}
            />
          </Show>
          <Show when={activeSection() === 'appearance'}>
            <StyleSection
              fields={APPEARANCE_FIELDS}
              style={getStyle()}
              onUpdate={updateStyle}
            />
          </Show>

          {/* Advanced JSON */}
          <Show when={activeSection() === 'advanced'}>
            <AdvancedSection node={props.node!} onChange={props.onChange} />
          </Show>
        </div>
      </div>
    </Show>
  );
};

// ─── Style section ──────────────────────────────────────────────────────────

const StyleSection: Component<{
  fields: StyleField[];
  style: Record<string, any>;
  onUpdate: (key: string, value: string) => void;
}> = (props) => (
  <div class="pi__section">
    <For each={props.fields}>
      {(field) => (
        <div class="pi__field">
          <label class="pi__label">{field.label}</label>
          {renderStyleField(field, props.style, props.onUpdate)}
        </div>
      )}
    </For>
  </div>
);

function renderStyleField(
  field: StyleField,
  style: Record<string, any>,
  onUpdate: (key: string, value: string) => void
) {
  const currentVal = () => {
    const val = style[field.key];
    if (val && typeof val === 'object') return JSON.stringify(val);
    return val ?? '';
  };

  switch (field.type) {
    case 'select':
      return (
        <select
          class="pi__input pi__select"
          value={currentVal()}
          onChange={(e) => onUpdate(field.key, e.currentTarget.value)}
        >
          <option value="">—</option>
          <For each={field.options || []}>
            {(opt) => <option value={opt}>{opt}</option>}
          </For>
        </select>
      );
    case 'color':
      return (
        <div class="pi__color-field">
          <input
            class="pi__color-swatch"
            type="color"
            value={normalizeColor(currentVal())}
            onInput={(e) => onUpdate(field.key, e.currentTarget.value)}
          />
          <input
            class="pi__input pi__input--color-text"
            type="text"
            value={currentVal()}
            onInput={(e) => onUpdate(field.key, e.currentTarget.value)}
            placeholder="e.g. #ffffff"
          />
        </div>
      );
    default:
      return (
        <input
          class="pi__input"
          type="text"
          value={currentVal()}
          onInput={(e) => onUpdate(field.key, e.currentTarget.value)}
        />
      );
  }
}

function renderOptsField(
  field: OptsField,
  opts: Record<string, any>,
  updateOpt: (key: string, value: any) => void,
  parseBinding: (raw: string) => any,
  stringifyBinding: (val: any) => string
) {
  const currentVal = opts[field.key];

  switch (field.type) {
    case 'boolean':
      return (
        <label class="pi__checkbox-label">
          <input
            type="checkbox"
            checked={!!currentVal}
            onChange={(e) => updateOpt(field.key, e.currentTarget.checked)}
          />
          <span>{currentVal ? 'Yes' : 'No'}</span>
        </label>
      );
    case 'number':
      return (
        <input
          class="pi__input"
          type="number"
          value={currentVal ?? ''}
          onInput={(e) => {
            const v = e.currentTarget.value;
            updateOpt(field.key, v === '' ? undefined : Number(v));
          }}
        />
      );
    case 'json':
      return (
        <textarea
          class="pi__textarea"
          value={
            typeof currentVal === 'object'
              ? JSON.stringify(currentVal, null, 2)
              : (currentVal ?? '')
          }
          onInput={(e) => {
            try {
              updateOpt(field.key, JSON.parse(e.currentTarget.value));
            } catch {
              // Keep raw value for now; user is still typing
            }
          }}
          rows={3}
          spellcheck={false}
        />
      );
    case 'binding':
      return null; // handled by BindingField component
    default:
      return (
        <input
          class="pi__input"
          type="text"
          value={currentVal ?? ''}
          onInput={(e) => updateOpt(field.key, e.currentTarget.value)}
        />
      );
  }
}

// ─── Binding mode types ─────────────────────────────────────────────────────

type BindingMode = 'static' | 'opt' | 'ctx' | 'item';

function detectBindingMode(val: any): BindingMode {
  if (val && typeof val === 'object' && val.type) {
    if (val.type === 'opt') return 'opt';
    if (val.type === 'ctx') return 'ctx';
    if (val.type === 'item') return 'item';
  }
  return 'static';
}

function extractSchemaKeys(schema: Record<string, any> | undefined): string[] {
  if (!schema || typeof schema !== 'object') return [];
  return Object.keys(schema);
}

function getSchemaFieldDescription(
  schema: Record<string, any> | undefined,
  key: string
): string {
  if (!schema || !schema[key]) return key;
  const field = schema[key];
  if (typeof field === 'string') return `${key} (${field})`;
  if (typeof field === 'object' && field.description)
    return `${key} — ${field.description}`;
  if (typeof field === 'object' && field.type) return `${key} (${field.type})`;
  return key;
}

// ─── Binding field component ────────────────────────────────────────────────

const BindingField: Component<{
  value: any;
  onChange: (val: any) => void;
  optionsSchema?: Record<string, any>;
  dataSchema?: Record<string, any>;
}> = (props) => {
  const mode = () => detectBindingMode(props.value);
  const optKeys = () => extractSchemaKeys(props.optionsSchema);
  const ctxKeys = () => extractSchemaKeys(props.dataSchema);
  const currentKey = () =>
    props.value && typeof props.value === 'object' ? props.value.key || '' : '';
  const staticValue = () =>
    typeof props.value === 'string'
      ? props.value
      : typeof props.value === 'number'
        ? String(props.value)
        : '';

  const setMode = (newMode: BindingMode) => {
    if (newMode === mode()) return;
    switch (newMode) {
      case 'static':
        props.onChange('');
        break;
      case 'opt': {
        const keys = optKeys();
        props.onChange({ type: 'opt', key: keys[0] || '' });
        break;
      }
      case 'ctx': {
        const keys = ctxKeys();
        props.onChange({ type: 'ctx', key: keys[0] || '' });
        break;
      }
      case 'item':
        props.onChange({ type: 'item', key: '' });
        break;
    }
  };

  const setBindingKey = (key: string) => {
    props.onChange({ type: mode(), key });
  };

  const modes: { value: BindingMode; label: string }[] = [
    { value: 'static', label: 'Static' },
    { value: 'opt', label: 'Option' },
    { value: 'ctx', label: 'Context' },
    { value: 'item', label: 'Item' },
  ];

  return (
    <div class="pi__binding">
      {/* Mode selector */}
      <div class="pi__binding-modes">
        <For each={modes}>
          {(m) => (
            <button
              class={`pi__binding-mode ${mode() === m.value ? 'pi__binding-mode--active' : ''}`}
              onClick={() => setMode(m.value)}
              title={
                m.value === 'opt'
                  ? 'Bind to a widget option'
                  : m.value === 'ctx'
                    ? 'Bind to context data'
                    : m.value === 'item'
                      ? 'Bind to list item field'
                      : 'Enter a static value'
              }
            >
              {m.label}
            </button>
          )}
        </For>
      </div>

      {/* Static: plain text input */}
      <Show when={mode() === 'static'}>
        <input
          class="pi__input"
          type="text"
          value={staticValue()}
          onInput={(e) => props.onChange(e.currentTarget.value)}
          placeholder="Enter value…"
        />
      </Show>

      {/* Option binding */}
      <Show when={mode() === 'opt'}>
        <Show
          when={optKeys().length > 0}
          fallback={
            <div class="pi__binding-empty">
              <input
                class="pi__input"
                type="text"
                value={currentKey()}
                onInput={(e) => setBindingKey(e.currentTarget.value)}
                placeholder="Option key (no options_schema defined)"
              />
            </div>
          }
        >
          <select
            class="pi__input pi__select"
            value={currentKey()}
            onChange={(e) => setBindingKey(e.currentTarget.value)}
          >
            <option value="" disabled>
              Select option…
            </option>
            <For each={optKeys()}>
              {(key) => (
                <option value={key}>
                  {getSchemaFieldDescription(props.optionsSchema, key)}
                </option>
              )}
            </For>
          </select>
        </Show>
      </Show>

      {/* Context binding */}
      <Show when={mode() === 'ctx'}>
        <Show
          when={ctxKeys().length > 0}
          fallback={
            <div class="pi__binding-empty">
              <input
                class="pi__input"
                type="text"
                value={currentKey()}
                onInput={(e) => setBindingKey(e.currentTarget.value)}
                placeholder="Context key (no data_schema defined)"
              />
            </div>
          }
        >
          <select
            class="pi__input pi__select"
            value={currentKey()}
            onChange={(e) => setBindingKey(e.currentTarget.value)}
          >
            <option value="" disabled>
              Select data field…
            </option>
            <For each={ctxKeys()}>
              {(key) => (
                <option value={key}>
                  {getSchemaFieldDescription(props.dataSchema, key)}
                </option>
              )}
            </For>
          </select>
        </Show>
      </Show>

      {/* Item binding (inside paginated-list) */}
      <Show when={mode() === 'item'}>
        <input
          class="pi__input"
          type="text"
          value={currentKey()}
          onInput={(e) => setBindingKey(e.currentTarget.value)}
          placeholder="Item field key"
        />
      </Show>

      {/* Show current binding summary */}
      <Show when={mode() !== 'static'}>
        <div class="pi__binding-preview">
          <code>{JSON.stringify(props.value)}</code>
        </div>
      </Show>
    </div>
  );
};

// ─── Advanced section (raw JSON) ────────────────────────────────────────────

const AdvancedSection: Component<{
  node: TemplateNode;
  onChange: (updated: TemplateNode) => void;
}> = (props) => {
  const [json, setJson] = createSignal('');
  const [error, setError] = createSignal<string | null>(null);

  createEffect(() => {
    const { _id, children, item_template, ...rest } = props.node;
    setJson(JSON.stringify(rest, null, 2));
    setError(null);
  });

  const applyJson = () => {
    try {
      const parsed = JSON.parse(json());
      props.onChange({
        ...props.node,
        ...parsed,
        _id: props.node._id,
        children: props.node.children,
        item_template: props.node.item_template,
      });
      setError(null);
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <div class="pi__section">
      <p class="pi__hint-text">
        Edit the raw JSON for this node. Children are managed separately.
      </p>
      <textarea
        class={`pi__json-textarea ${error() ? 'pi__json-textarea--error' : ''}`}
        value={json()}
        onInput={(e) => setJson(e.currentTarget.value)}
        rows={12}
        spellcheck={false}
      />
      <Show when={error()}>
        <div class="pi__json-error">{error()}</div>
      </Show>
      <button class="pi__apply-btn" onClick={applyJson}>
        Apply JSON
      </button>
    </div>
  );
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalizeColor(val: string): string {
  if (!val) return '#000000';
  // If it's a binding object, return black
  if (val.startsWith('{')) return '#000000';
  // Already a valid hex
  if (/^#[0-9a-fA-F]{6}$/.test(val)) return val;
  if (/^#[0-9a-fA-F]{3}$/.test(val)) {
    return `#${val[1]}${val[1]}${val[2]}${val[2]}${val[3]}${val[3]}`;
  }
  return '#000000';
}
