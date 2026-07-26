import { Component, createSignal, createMemo, Show, For } from 'solid-js';
import { BsX, BsPlus, BsChevronDown, BsChevronRight } from 'solid-icons/bs';

// ─── Types ──────────────────────────────────────────────────────────────────

/**
 * Supported field types in the Castmill schema system.
 * Simple: string, number, boolean
 * Special: color, url, city
 * Complex: ref, map, list
 * Advanced: location, layout, layout-ref
 */
const FIELD_TYPES = [
  'string',
  'number',
  'boolean',
  'color',
  'url',
  'city',
  'ref',
  'map',
  'list',
  'location',
  'layout',
  'layout-ref',
] as const;

type FieldType = (typeof FIELD_TYPES)[number];

/** Normalized internal representation of a schema field. */
interface SchemaField {
  name: string;
  type: FieldType;
  required: boolean;
  description: string;
  defaultValue: string;
  order: number;
  // Number-specific
  min?: string;
  max?: string;
  // Enum (select options)
  enumValues?: string;
  // Ref-specific
  collection?: string;
  // Complex (map/list) — stored as JSON
  nestedSchema?: string;
}

export interface SchemaEditorProps {
  /** The parsed schema object. */
  schema: Record<string, any>;
  /** Called whenever the schema changes. */
  onChange: (schema: Record<string, any>) => void;
  /** i18n helper (unused for now but available). */
  t: (key: string, params?: Record<string, any>) => string;
  /** Title shown above the editor. */
  title?: string;
}

// ─── Conversion helpers ─────────────────────────────────────────────────────

function schemaToFields(schema: Record<string, any>): SchemaField[] {
  if (!schema || typeof schema !== 'object') return [];

  return Object.entries(schema)
    .map(([name, value], idx) => {
      // Simple form: "field_name": "string"
      if (typeof value === 'string') {
        return {
          name,
          type: value as FieldType,
          required: false,
          description: '',
          defaultValue: '',
          order: idx,
        };
      }

      // Expanded form: { type, required, default, description, ... }
      const obj = value as Record<string, any>;
      return {
        name,
        type: (obj.type || 'string') as FieldType,
        required: !!obj.required,
        description: obj.description || '',
        defaultValue:
          obj.default !== undefined
            ? typeof obj.default === 'object'
              ? JSON.stringify(obj.default)
              : String(obj.default)
            : '',
        order: obj.order ?? idx,
        min: obj.min !== undefined ? String(obj.min) : undefined,
        max: obj.max !== undefined ? String(obj.max) : undefined,
        enumValues: obj.enum ? obj.enum.join(', ') : undefined,
        collection: obj.collection || undefined,
        nestedSchema:
          obj.schema || obj.items
            ? JSON.stringify(obj.schema || obj.items, null, 2)
            : undefined,
      };
    })
    .sort((a, b) => a.order - b.order);
}

function fieldsToSchema(fields: SchemaField[]): Record<string, any> {
  const schema: Record<string, any> = {};

  fields.forEach((field, idx) => {
    const entry: Record<string, any> = { type: field.type };

    if (field.required) entry.required = true;
    if (field.description) entry.description = field.description;
    if (field.order !== idx) entry.order = field.order;
    entry.order = idx + 1;

    // Default value
    if (field.defaultValue !== '') {
      if (field.type === 'number') {
        entry.default = Number(field.defaultValue) || 0;
      } else if (field.type === 'boolean') {
        entry.default = field.defaultValue === 'true';
      } else {
        // Try JSON parse for objects/arrays
        try {
          entry.default = JSON.parse(field.defaultValue);
        } catch {
          entry.default = field.defaultValue;
        }
      }
    }

    // Number constraints
    if (field.type === 'number') {
      if (field.min !== undefined && field.min !== '')
        entry.min = Number(field.min);
      if (field.max !== undefined && field.max !== '')
        entry.max = Number(field.max);
    }

    // Enum
    if (field.enumValues) {
      entry.enum = field.enumValues
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean);
    }

    // Ref
    if (field.type === 'ref' && field.collection) {
      entry.collection = field.collection;
    }

    // Complex
    if ((field.type === 'map' || field.type === 'list') && field.nestedSchema) {
      try {
        const parsed = JSON.parse(field.nestedSchema);
        if (field.type === 'map') entry.schema = parsed;
        else entry.items = parsed;
      } catch {
        // keep as-is
      }
    }

    schema[field.name] = entry;
  });

  return schema;
}

// ─── Component ──────────────────────────────────────────────────────────────

export const SchemaEditor: Component<SchemaEditorProps> = (props) => {
  const fields = createMemo(() => schemaToFields(props.schema || {}));
  const [expandedField, setExpandedField] = createSignal<string | null>(null);

  const updateField = (index: number, updates: Partial<SchemaField>) => {
    const current = [...fields()];
    current[index] = { ...current[index], ...updates };
    props.onChange(fieldsToSchema(current));
  };

  const removeField = (index: number) => {
    const current = [...fields()];
    current.splice(index, 1);
    props.onChange(fieldsToSchema(current));
  };

  const addField = () => {
    const current = [...fields()];
    let newName = 'new_field';
    let counter = 1;
    const existingNames = new Set(current.map((f) => f.name));
    while (existingNames.has(newName)) {
      newName = `new_field_${counter++}`;
    }
    current.push({
      name: newName,
      type: 'string',
      required: false,
      description: '',
      defaultValue: '',
      order: current.length,
    });
    props.onChange(fieldsToSchema(current));
    setExpandedField(newName);
  };

  const renameField = (index: number, newName: string) => {
    // Sanitize: only allow alphanumeric, underscores, hyphens
    const sanitized = newName.replace(/[^a-zA-Z0-9_-]/g, '');
    if (!sanitized) return;
    const current = [...fields()];
    const existingNames = new Set(
      current.map((f, i) => (i === index ? '' : f.name))
    );
    if (existingNames.has(sanitized)) return; // duplicate
    current[index] = { ...current[index], name: sanitized };
    props.onChange(fieldsToSchema(current));
    if (expandedField() === fields()[index].name) {
      setExpandedField(sanitized);
    }
  };

  const moveField = (index: number, direction: -1 | 1) => {
    const current = [...fields()];
    const target = index + direction;
    if (target < 0 || target >= current.length) return;
    [current[index], current[target]] = [current[target], current[index]];
    props.onChange(fieldsToSchema(current));
  };

  const toggleExpand = (name: string) => {
    setExpandedField(expandedField() === name ? null : name);
  };

  // ── Type-specific attribute editor ────────────────────────────────────

  const hasNumericConstraints = (type: string) => type === 'number';
  const hasEnum = (type: string) => ['string', 'number'].includes(type);
  const hasCollection = (type: string) => type === 'ref';
  const hasNested = (type: string) => ['map', 'list'].includes(type);

  return (
    <div class="se">
      <Show when={props.title}>
        <div class="se__title">{props.title}</div>
      </Show>

      <Show when={fields().length === 0}>
        <div class="se__empty">
          No fields defined. Click "Add Field" to start.
        </div>
      </Show>

      <div class="se__fields">
        <For each={fields()}>
          {(field, index) => {
            const isExpanded = () => expandedField() === field.name;

            return (
              <div
                class={`se__field ${isExpanded() ? 'se__field--expanded' : ''}`}
              >
                {/* Header row: always visible */}
                <div
                  class="se__field-header"
                  onClick={() => toggleExpand(field.name)}
                >
                  <span class="se__field-expand">
                    <Show
                      when={isExpanded()}
                      fallback={<BsChevronRight size={10} />}
                    >
                      <BsChevronDown size={10} />
                    </Show>
                  </span>
                  <span class="se__field-name">{field.name}</span>
                  <span class="se__field-type-badge">{field.type}</span>
                  <Show when={field.required}>
                    <span class="se__field-required-badge">required</span>
                  </Show>
                  <Show when={field.description}>
                    <span
                      class="se__field-desc-preview"
                      title={field.description}
                    >
                      {field.description.length > 30
                        ? field.description.slice(0, 30) + '…'
                        : field.description}
                    </span>
                  </Show>
                  <div class="se__field-header-actions">
                    <button
                      class="se__move-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        moveField(index(), -1);
                      }}
                      disabled={index() === 0}
                      title="Move up"
                    >
                      ↑
                    </button>
                    <button
                      class="se__move-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        moveField(index(), 1);
                      }}
                      disabled={index() === fields().length - 1}
                      title="Move down"
                    >
                      ↓
                    </button>
                    <button
                      class="se__remove-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeField(index());
                      }}
                      title="Remove field"
                    >
                      <BsX size={14} />
                    </button>
                  </div>
                </div>

                {/* Expanded detail editor */}
                <Show when={isExpanded()}>
                  <div class="se__field-body">
                    {/* Row 1: Name + Type */}
                    <div class="se__row">
                      <div class="se__col">
                        <label class="se__label">Field Name</label>
                        <input
                          class="se__input"
                          type="text"
                          value={field.name}
                          onChange={(e) =>
                            renameField(index(), e.currentTarget.value)
                          }
                        />
                      </div>
                      <div class="se__col">
                        <label class="se__label">Type</label>
                        <select
                          class="se__input se__select"
                          value={field.type}
                          onChange={(e) =>
                            updateField(index(), {
                              type: e.currentTarget.value as FieldType,
                            })
                          }
                        >
                          <For each={[...FIELD_TYPES]}>
                            {(t) => <option value={t}>{t}</option>}
                          </For>
                        </select>
                      </div>
                    </div>

                    {/* Row 2: Description */}
                    <div class="se__row">
                      <div class="se__col se__col--full">
                        <label class="se__label">Description</label>
                        <input
                          class="se__input"
                          type="text"
                          value={field.description}
                          onInput={(e) =>
                            updateField(index(), {
                              description: e.currentTarget.value,
                            })
                          }
                          placeholder="What this field is for…"
                        />
                      </div>
                    </div>

                    {/* Row 3: Default + Required */}
                    <div class="se__row">
                      <div class="se__col">
                        <label class="se__label">Default Value</label>
                        <input
                          class="se__input"
                          type="text"
                          value={field.defaultValue}
                          onInput={(e) =>
                            updateField(index(), {
                              defaultValue: e.currentTarget.value,
                            })
                          }
                          placeholder={
                            field.type === 'boolean'
                              ? 'true / false'
                              : 'Default…'
                          }
                        />
                      </div>
                      <div class="se__col se__col--checkbox">
                        <label class="se__checkbox-label">
                          <input
                            type="checkbox"
                            checked={field.required}
                            onChange={(e) =>
                              updateField(index(), {
                                required: e.currentTarget.checked,
                              })
                            }
                          />
                          Required
                        </label>
                      </div>
                    </div>

                    {/* Number constraints */}
                    <Show when={hasNumericConstraints(field.type)}>
                      <div class="se__row">
                        <div class="se__col">
                          <label class="se__label">Min</label>
                          <input
                            class="se__input"
                            type="number"
                            value={field.min ?? ''}
                            onInput={(e) =>
                              updateField(index(), {
                                min: e.currentTarget.value,
                              })
                            }
                          />
                        </div>
                        <div class="se__col">
                          <label class="se__label">Max</label>
                          <input
                            class="se__input"
                            type="number"
                            value={field.max ?? ''}
                            onInput={(e) =>
                              updateField(index(), {
                                max: e.currentTarget.value,
                              })
                            }
                          />
                        </div>
                      </div>
                    </Show>

                    {/* Enum */}
                    <Show when={hasEnum(field.type)}>
                      <div class="se__row">
                        <div class="se__col se__col--full">
                          <label class="se__label">
                            Allowed Values
                            <span class="se__hint">comma-separated</span>
                          </label>
                          <input
                            class="se__input"
                            type="text"
                            value={field.enumValues ?? ''}
                            onInput={(e) =>
                              updateField(index(), {
                                enumValues: e.currentTarget.value,
                              })
                            }
                            placeholder="e.g. small, medium, large"
                          />
                        </div>
                      </div>
                    </Show>

                    {/* Ref collection */}
                    <Show when={hasCollection(field.type)}>
                      <div class="se__row">
                        <div class="se__col se__col--full">
                          <label class="se__label">Collection</label>
                          <input
                            class="se__input"
                            type="text"
                            value={field.collection ?? ''}
                            onInput={(e) =>
                              updateField(index(), {
                                collection: e.currentTarget.value,
                              })
                            }
                            placeholder="e.g. medias"
                          />
                        </div>
                      </div>
                    </Show>

                    {/* Nested schema (map/list) */}
                    <Show when={hasNested(field.type)}>
                      <div class="se__row">
                        <div class="se__col se__col--full">
                          <label class="se__label">
                            {field.type === 'map'
                              ? 'Nested Schema (JSON)'
                              : 'Items Schema (JSON)'}
                          </label>
                          <textarea
                            class="se__textarea"
                            value={field.nestedSchema ?? '{}'}
                            onInput={(e) =>
                              updateField(index(), {
                                nestedSchema: e.currentTarget.value,
                              })
                            }
                            rows={4}
                            spellcheck={false}
                          />
                        </div>
                      </div>
                    </Show>
                  </div>
                </Show>
              </div>
            );
          }}
        </For>
      </div>

      <button class="se__add-btn" onClick={addField}>
        <BsPlus size={14} />
        <span>Add Field</span>
      </button>
    </div>
  );
};
