import type { JsonWidgetTemplate, JsonPlaylistItem } from '@castmill/player';

/**
 * Types of template components that have dynamic durations.
 * These components determine their duration at runtime based on content:
 * - video: duration based on video file length
 * - scroller: duration based on content height and scroll speed
 * - layout: duration based on contained playlist durations
 * - paginated-list: duration based on number of items and display time per item
 */
const DYNAMIC_DURATION_TYPES = [
  'video',
  'scroller',
  'layout',
  'paginated-list',
] as const;

type DynamicDurationType = (typeof DYNAMIC_DURATION_TYPES)[number];

/**
 * Checks if a template type is a dynamic duration type.
 */
function isDynamicDurationType(type: string): type is DynamicDurationType {
  return DYNAMIC_DURATION_TYPES.includes(type as DynamicDurationType);
}

/**
 * Recursively check if a widget template contains a component with dynamic duration.
 * These components determine their duration at runtime based on content
 * (video length, scroll distance/speed, contained playlists, or number of items).
 *
 * @param template - The widget template to check (can be nested)
 * @returns true if the template or any nested component has dynamic duration
 *
 * @example
 * ```ts
 * // Direct video widget
 * containsDynamicDurationComponent({ type: 'video', ... }) // true
 *
 * // Video nested in a group
 * containsDynamicDurationComponent({
 *   type: 'group',
 *   components: [{ type: 'video', ... }]
 * }) // true
 *
 * // Static image widget
 * containsDynamicDurationComponent({ type: 'image', ... }) // false
 * ```
 */
export function containsDynamicDurationComponent(
  template: JsonWidgetTemplate | undefined | null
): boolean {
  if (!template) return false;

  const type = template.type;

  // Check if this component type has dynamic duration
  if (isDynamicDurationType(type)) {
    return true;
  }

  // Check nested components array (for group, layout, etc.)
  if (template.components && Array.isArray(template.components)) {
    return template.components.some(containsDynamicDurationComponent);
  }

  // Check single nested component (for scroller's item template)
  if (template.component) {
    return containsDynamicDurationComponent(
      template.component as JsonWidgetTemplate
    );
  }

  return false;
}

/**
 * Check if a playlist item's widget has dynamic duration
 * (determined by content, not user input).
 *
 * Video and scroller widgets calculate their duration based on content length/scroll speed.
 * This checks recursively since the dynamic component may be nested
 * (e.g., scroller inside a group).
 *
 * @param item - The playlist item to check
 * @returns true if the widget's template contains any dynamic duration components
 */
export function hasDynamicDuration(item: JsonPlaylistItem): boolean {
  return containsDynamicDurationComponent(item.widget.template);
}
