const SUPPORTED_COMPONENT_TYPES = new Set([
  'group',
  'text',
  'image',
  'video',
  'list',
  'paginated-list',
  'scroller',
  'layout',
  'image-carousel',
  'qr-code',
]);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateComponent(value: unknown, path: string): string | null {
  if (!isObject(value)) return path;
  if (
    typeof value.type !== 'string' ||
    !SUPPORTED_COMPONENT_TYPES.has(value.type) ||
    typeof value.name !== 'string' ||
    !value.name.trim()
  ) {
    return path;
  }
  if (value.opts !== undefined && !isObject(value.opts)) return path;
  if (value.style !== undefined && !isObject(value.style)) return path;
  if (value.animations !== undefined && !Array.isArray(value.animations)) {
    return path;
  }

  if (value.type === 'group') {
    if (value.components !== undefined && !Array.isArray(value.components)) {
      return `${path}.components`;
    }
    const components = value.components || [];
    for (let index = 0; index < components.length; index++) {
      const error = validateComponent(
        components[index],
        `${path}.components[${index}]`
      );
      if (error) return error;
    }
  }

  if (
    value.type === 'list' ||
    value.type === 'paginated-list' ||
    value.type === 'scroller'
  ) {
    return validateComponent(value.component, `${path}.component`);
  }

  return null;
}

export function validateWidgetTemplate(value: unknown): string | null {
  return validateComponent(value, 'template');
}
