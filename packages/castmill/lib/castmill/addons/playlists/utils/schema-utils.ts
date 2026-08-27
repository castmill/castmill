import type {
  Schema,
  SimpleType,
  FieldAttributes,
  ComplexFieldAttributes,
} from '@castmill/player';

/**
 * Represents a schema field entry - either a simple type string or an object with type info
 */
type SchemaField =
  | SimpleType
  | FieldAttributes
  | ComplexFieldAttributes
  | { type: string; default?: unknown; [key: string]: unknown };

/**
 * Type guard to check if a schema field has a default value
 */
function hasDefault(
  field: SchemaField
): field is { default: unknown } & Record<string, unknown> {
  return (
    typeof field === 'object' &&
    field !== null &&
    'default' in field &&
    field.default !== undefined
  );
}

/**
 * Type guard to check if a value is a SimpleType string
 */
function isSimpleType(value: unknown): value is SimpleType {
  return value === 'string' || value === 'number' || value === 'boolean';
}

/**
 * Gets the default value for a simple type
 */
function getSimpleTypeDefault(type: SimpleType): string | number | boolean {
  switch (type) {
    case 'string':
      return '';
    case 'number':
      return 0;
    case 'boolean':
      return false;
  }
}

/**
 * Extracts default values from a data_schema to use as initial/placeholder data.
 *
 * This is useful for:
 * - Providing initial values when adding a widget to a playlist
 * - Allowing widgets with integration data to render in preview mode
 * - Ensuring widgets with dynamic content (like scrollers) render properly
 *   before integration data is fetched
 *
 * @param dataSchema - The schema definition from a widget's data_schema property
 * @returns An object with default values for each schema field that has one
 *
 * @example
 * ```ts
 * const schema = {
 *   title: { type: 'string', default: 'Hello' },
 *   count: 'number',
 *   items: { type: 'list', schema: {...}, default: [] }
 * };
 *
 * const defaults = getDefaultDataFromSchema(schema);
 * // Result: { title: 'Hello', count: 0, items: [] }
 * ```
 */
export function getDefaultDataFromSchema(
  dataSchema: Schema | undefined
): Record<string, unknown> {
  if (!dataSchema) return {};

  const defaults: Record<string, unknown> = {};

  for (const [key, field] of Object.entries(dataSchema)) {
    // Check if field has an explicit default value
    if (hasDefault(field)) {
      defaults[key] = field.default;
    } else if (isSimpleType(field)) {
      // Simple type string without default - provide sensible placeholder
      defaults[key] = getSimpleTypeDefault(field);
    }
    // Note: Complex types (map, list) without defaults are intentionally
    // left undefined to avoid creating empty containers that might
    // cause unexpected behavior in widgets
  }

  return defaults;
}
