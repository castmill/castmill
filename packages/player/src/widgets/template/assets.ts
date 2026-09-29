type AssetDefinition = { path?: string; url?: string };
type AssetManifest = Record<string, Record<string, AssetDefinition>>;

function assetUrl(
  reference: string,
  assets: AssetManifest,
  widgetSlug?: string
): string | undefined {
  const separator = reference.indexOf('.');
  if (separator < 1) return undefined;

  const category = reference.slice(0, separator);
  const name = reference.slice(separator + 1);
  const asset = assets[category]?.[name];
  const path = asset?.url || asset?.path;
  if (!path) return undefined;

  if (
    path.startsWith('/') ||
    path.startsWith('data:') ||
    /^https?:\/\//i.test(path)
  ) {
    return path;
  }

  return widgetSlug ? `/widget_assets/${widgetSlug}/${path}` : path;
}

function resolveStringAssets(
  value: string,
  assets: AssetManifest,
  widgetSlug?: string
): string {
  const parts: string[] = [];
  let cursor = 0;

  while (cursor < value.length) {
    const start = value.indexOf('{{asset:', cursor);
    if (start < 0) {
      parts.push(value.slice(cursor));
      break;
    }

    const end = value.indexOf('}}', start + 8);
    if (end < 0) {
      parts.push(value.slice(cursor));
      break;
    }

    const reference = value.slice(start + 8, end);
    parts.push(value.slice(cursor, start));
    parts.push(
      assetUrl(reference, assets, widgetSlug) || value.slice(start, end + 2)
    );
    cursor = end + 2;
  }

  return parts.join('');
}

export function resolveWidgetAssets<T>(
  value: T,
  assets: AssetManifest | undefined,
  widgetSlug?: string
): T {
  if (!assets) return value;

  if (typeof value === 'string') {
    return resolveStringAssets(value, assets, widgetSlug) as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) =>
      resolveWidgetAssets(item, assets, widgetSlug)
    ) as T;
  }

  if (value && typeof value === 'object') {
    const resolved: Record<string, unknown> = {};
    Object.keys(value).forEach((key) => {
      resolved[key] = resolveWidgetAssets(
        (value as Record<string, unknown>)[key],
        assets,
        widgetSlug
      );
    });
    return resolved as T;
  }

  return value;
}
