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

export function resolveWidgetAssets<T>(
  value: T,
  assets: AssetManifest | undefined,
  widgetSlug?: string
): T {
  if (!assets) return value;

  if (typeof value === 'string') {
    return value.replace(
      /\{\{asset:([^}]+)\}\}/g,
      (placeholder, reference: string) =>
        assetUrl(reference, assets, widgetSlug) || placeholder
    ) as T;
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
