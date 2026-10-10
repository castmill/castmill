/**
 * Playback debug overlay.
 *
 * Each renderer has one box in its upper right corner that shows the playlist
 * it is playing and the current item, each with a progress bar and a
 * countdown, and the next item when it is known. Every layout area shows its
 * own box; the box of the playlist containing the layout is hidden.
 *
 * The overlay is plain DOM with inline styles and ES5-level APIs so that it
 * works on the oldest supported players (Chrome 38 / legacy WebOS).
 *
 * Enable it with one of:
 * - `setDebugOverlay(true)` or `toggleDebugOverlay()` from code.
 * - `castmillDebugOverlay(true)` from the browser console.
 * - The `debugOverlay=1` (or `true`) URL query parameter.
 * - `localStorage.setItem('castmill:debugOverlay', 'true')` and a reload.
 * - Building a player app with `VITE_DEBUG_OVERLAY=true`
 *   (see `enableDebugOverlayFromEnv`).
 */

export const DEBUG_OVERLAY_STORAGE_KEY = 'castmill:debugOverlay';
export const DEBUG_OVERLAY_ATTRIBUTE = 'data-castmill-debug-overlay';

export interface DebugItemInfo {
  name: string;
  widget?: string;
  type?: string;
  media?: string;
  /** Duration of the item slot in the playlist, in milliseconds. */
  duration: number;
  /** Current duration reported by the item, when it differs from the slot. */
  itemDuration?: number;
}

export interface DebugOverlayState {
  index: number;
  count: number;
  /** Milliseconds elapsed in the current item slot. */
  elapsed: number;
  current: DebugItemInfo;
  next?: DebugItemInfo;
  /** The playlist that is playing the item, i.e. the one in this renderer. */
  playlist?: DebugPlaylistInfo;
}

export interface DebugPlaylistInfo {
  name?: string;
  /** Milliseconds elapsed in the current loop of the playlist. */
  elapsed: number;
  /** Duration of one loop of the playlist, in milliseconds. */
  duration: number;
}

type Listener = (enabled: boolean) => void;

interface DebugOverlayFlag {
  enabled: boolean;
  listeners: Listener[];
}

function isTrue(value: string | null | undefined): boolean {
  return value === 'true' || value === '1';
}

function readInitialFlag(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    const search = window.location?.search || '';
    const match = /[?&]debugOverlay=([^&]*)/.exec(search);
    if (match) return isTrue(decodeURIComponent(match[1]));
    return isTrue(window.localStorage?.getItem(DEBUG_OVERLAY_STORAGE_KEY));
  } catch {
    return false;
  }
}

const localFlag: { current?: DebugOverlayFlag } = {};

// Packages such as @castmill/device bundle their own copy of the player, so
// the flag lives on the window to be shared by every copy on the page.
function flag(): DebugOverlayFlag {
  const root: { __castmillDebugOverlay?: DebugOverlayFlag } =
    typeof window === 'undefined' ? localFlag : (window as any);
  if (!root.__castmillDebugOverlay) {
    root.__castmillDebugOverlay = {
      enabled: readInitialFlag(),
      listeners: [],
    };
  }
  return root.__castmillDebugOverlay;
}

export function isDebugOverlayEnabled(): boolean {
  return flag().enabled;
}

export function setDebugOverlay(value: boolean): void {
  const state = flag();
  value = Boolean(value);
  if (value === state.enabled) return;
  state.enabled = value;
  if (!value) hideDebugOverlays();
  state.listeners.slice().forEach((listener) => listener(value));
}

/**
 * Enables the overlay when a build-time flag is `true` or `1`. Player apps
 * pass `import.meta.env.VITE_DEBUG_OVERLAY`, which their bundler inlines.
 * Other values leave the current state unchanged.
 */
export function enableDebugOverlayFromEnv(value: unknown): void {
  if (typeof value === 'string' && isTrue(value.trim())) {
    setDebugOverlay(true);
  }
}

export function toggleDebugOverlay(): boolean {
  setDebugOverlay(!isDebugOverlayEnabled());
  return isDebugOverlayEnabled();
}

export function onDebugOverlayChange(listener: Listener): () => void {
  const { listeners } = flag();
  listeners.push(listener);
  return () => {
    const index = listeners.indexOf(listener);
    if (index >= 0) listeners.splice(index, 1);
  };
}

function hideDebugOverlays(): void {
  if (typeof document === 'undefined' || !document.querySelectorAll) return;
  const overlays = document.querySelectorAll(`[${DEBUG_OVERLAY_ATTRIBUTE}]`);
  for (let i = 0; i < overlays.length; i++) {
    (overlays[i] as HTMLElement).style.display = 'none';
  }
}

if (typeof window !== 'undefined') {
  (window as any).castmillDebugOverlay = (value?: boolean) => {
    if (value === undefined) return toggleDebugOverlay();
    setDebugOverlay(value);
    return isDebugOverlayEnabled();
  };
}

export function formatDebugSeconds(ms: number): string {
  const value = Number.isFinite(ms) ? Math.max(0, ms) : 0;
  return `${(value / 1000).toFixed(1)}s`;
}

function describeItem(item: DebugItemInfo): string {
  const kind = [item.widget, item.type]
    .filter((part, index, parts) => part && parts.indexOf(part) === index)
    .join(' · ');
  const name = quotedName(item.name);
  return [kind, name].filter((part) => part).join(' ');
}

function quotedName(name: string | undefined): string {
  return name && name !== 'undefined' ? `"${name}"` : '';
}

function progressOf(elapsed: number, duration: number): number {
  return duration > 0 && Number.isFinite(elapsed)
    ? Math.min(1, Math.max(0, elapsed / duration))
    : 0;
}

function describeDuration(item: DebugItemInfo): string {
  const itemDuration =
    item.itemDuration !== undefined &&
    Number.isFinite(item.itemDuration) &&
    Math.abs(item.itemDuration - item.duration) >= 100
      ? ` (item ${formatDebugSeconds(item.itemDuration)})`
      : '';
  return `${formatDebugSeconds(item.duration)}${itemDuration}`;
}

export interface DebugSectionView {
  title: string;
  media?: string;
  /** Fraction of the current slot that has elapsed, between 0 and 1. */
  progress: number;
  countdown: string;
  next?: string;
  nextMedia?: string;
}

export function describeDebugSection(
  label: string,
  state: DebugOverlayState
): DebugSectionView {
  const { current, next } = state;
  const progress = progressOf(state.elapsed, current.duration);
  return {
    title: `${label} ${state.index + 1}/${state.count} ${describeItem(current)} ${describeDuration(current)}`,
    media: current.media ? `media: ${current.media}` : undefined,
    progress,
    countdown: formatDebugSeconds(current.duration - state.elapsed),
    next: next
      ? `Next: ${describeItem(next)} ${describeDuration(next)}`
      : undefined,
    nextMedia: next?.media ? `media: ${next.media}` : undefined,
  };
}

export function describeDebugPlaylist(
  playlist: DebugPlaylistInfo,
  count: number
): DebugSectionView {
  const name = quotedName(playlist.name);
  const items = `${count} item${count === 1 ? '' : 's'}`;
  return {
    title: `Playlist ${name ? `${name} ` : ''}${items} ${formatDebugSeconds(playlist.duration)}`,
    progress: progressOf(playlist.elapsed, playlist.duration),
    countdown: formatDebugSeconds(playlist.duration - playlist.elapsed),
  };
}

const OVERLAY_PROPERTY = '__castmillDebugOverlay';

interface DebugContainer extends HTMLElement {
  [OVERLAY_PROPERTY]?: DebugOverlay;
}

/** Hides the overlays of the renderers that contain `el`. */
function hideAncestorOverlays(el: HTMLElement): void {
  let node = el.parentNode as DebugContainer | null;
  while (node && node.nodeType === 1) {
    node[OVERLAY_PROPERTY]?.hide();
    node = node.parentNode as DebugContainer | null;
  }
}

interface SectionElements {
  root: HTMLElement;
  title: HTMLElement;
  media: HTMLElement;
  fill: HTMLElement;
  countdown: HTMLElement;
  next: HTMLElement;
  nextMedia: HTMLElement;
  width?: string;
  color?: string;
  top?: string;
}

function setText(
  el: HTMLElement,
  text: string | undefined,
  visibleDisplay = 'block'
): void {
  const value = text || '';
  if (el.textContent !== value) el.textContent = value;
  const display = value ? visibleDisplay : 'none';
  if (el.style.display !== display) el.style.display = display;
}

function line(parent: HTMLElement): HTMLElement {
  const el = document.createElement('div');
  el.style.whiteSpace = 'nowrap';
  el.style.overflow = 'hidden';
  el.style.textOverflow = 'ellipsis';
  parent.appendChild(el);
  return el;
}

function createSection(parent: HTMLElement, color: string): SectionElements {
  const root = document.createElement('div');
  parent.appendChild(root);
  const title = line(root);
  const media = line(root);

  const row = document.createElement('div');
  row.style.whiteSpace = 'nowrap';
  row.style.margin = '0.2em 0';
  const track = document.createElement('div');
  track.style.display = 'inline-block';
  track.style.verticalAlign = 'middle';
  track.style.width = '16em';
  track.style.height = '0.6em';
  track.style.background = 'rgba(255, 255, 255, 0.25)';
  track.style.overflow = 'hidden';
  const fill = document.createElement('div');
  fill.style.height = '100%';
  fill.style.width = '0%';
  fill.style.background = color;
  track.appendChild(fill);
  const countdown = document.createElement('span');
  countdown.style.display = 'inline-block';
  countdown.style.verticalAlign = 'middle';
  countdown.style.width = '4em';
  countdown.style.marginLeft = '0.6em';
  countdown.style.textAlign = 'right';
  row.appendChild(track);
  row.appendChild(countdown);
  root.appendChild(row);

  const next = line(root);
  next.style.opacity = '0.75';
  const nextMedia = line(root);
  nextMedia.style.opacity = '0.75';
  return { root, title, media, fill, countdown, next, nextMedia };
}

const PLAYLIST_COLOR = '#42a5f5';
const ITEM_COLOR = '#66bb6a';

/**
 * Overlay for one renderer element, in its upper right corner. It shows the
 * renderer's playlist and the item it is playing. A playlist that is showing
 * a layout does not render its own box while the layout areas show theirs.
 *
 * Updates are cheap no-ops while the overlay is disabled, and the DOM is only
 * touched when a value changes.
 */
export class DebugOverlay {
  private el?: HTMLElement;
  private sections: SectionElements[] = [];

  constructor(private readonly container: HTMLElement) {
    (container as DebugContainer)[OVERLAY_PROPERTY] = this;
  }

  update(state: DebugOverlayState): void {
    const container = this.container;
    if (!isDebugOverlayEnabled()) {
      this.hide();
      return;
    }
    if (this.hasVisibleDescendant()) {
      this.hide();
      return;
    }

    // A layout area shows the information of its own playlist; the playlist
    // containing the layout would be the same in every area, so its overlay
    // is hidden.
    hideAncestorOverlays(container);
    const views: DebugSectionView[] = [];
    if (state.playlist) {
      views.push(describeDebugPlaylist(state.playlist, state.count));
    }
    views.push(describeDebugSection('Item', state));

    const el = this.element();
    if (el.parentNode !== container) container.appendChild(el);
    if (el.style.display !== 'block') el.style.display = 'block';
    this.render(el, views);
  }

  hide(): void {
    if (this.el && this.el.style.display !== 'none') {
      this.el.style.display = 'none';
    }
  }

  remove(): void {
    this.el?.parentNode?.removeChild(this.el);
    this.el = undefined;
    this.sections = [];
  }

  private hasVisibleDescendant(): boolean {
    const overlays = this.container.querySelectorAll(
      `[${DEBUG_OVERLAY_ATTRIBUTE}]`
    );
    for (let i = 0; i < overlays.length; i++) {
      const overlay = overlays[i] as HTMLElement;
      if (overlay !== this.el && overlay.style.display === 'block') {
        return true;
      }
    }
    return false;
  }

  private render(el: HTMLElement, views: DebugSectionView[]): void {
    while (this.sections.length > views.length) {
      const section = this.sections.pop()!;
      el.removeChild(section.root);
    }
    for (let i = 0; i < views.length; i++) {
      const isItem = i === views.length - 1;
      let section = this.sections[i];
      if (!section) {
        section = createSection(el, ITEM_COLOR);
        this.sections.push(section);
      }
      const view = views[i];
      const color = isItem ? ITEM_COLOR : PLAYLIST_COLOR;
      if (section.color !== color) {
        section.color = color;
        section.fill.style.background = color;
      }
      const top = i > 0 ? '0.4em' : '0';
      if (section.top !== top) {
        section.top = top;
        section.root.style.marginTop = top;
      }
      setText(section.title, view.title);
      setText(section.media, view.media);
      setText(section.countdown, view.countdown, 'inline-block');
      setText(section.next, view.next);
      setText(section.nextMedia, view.nextMedia);
      const width = `${(view.progress * 100).toFixed(1)}%`;
      if (section.width !== width) {
        section.width = width;
        section.fill.style.width = width;
      }
    }
  }

  private element(): HTMLElement {
    if (this.el) return this.el;
    const el = document.createElement('div');
    el.setAttribute(DEBUG_OVERLAY_ATTRIBUTE, '');
    const style = el.style;
    style.position = 'absolute';
    style.top = '0.5em';
    style.right = '0.5em';
    style.zIndex = '2147483000';
    // Fixed width so that the box doesn't resize as the text changes; long
    // lines are truncated with an ellipsis. The bar row is 20.6em wide.
    style.width = '21em';
    style.maxWidth = '90%';
    style.padding = '0.4em 0.6em';
    style.background = 'rgba(0, 0, 0, 0.7)';
    style.color = '#fff';
    style.fontFamily = 'monospace';
    // Fixed size: renderer elements may inherit scaled widget font sizes.
    style.fontSize = '12px';
    style.lineHeight = '1.3';
    style.overflow = 'hidden';
    style.textAlign = 'left';
    style.pointerEvents = 'none';
    style.borderRadius = '0.3em';
    this.el = el;
    return el;
  }
}

/**
 * @deprecated Kept for backwards compatibility; use `DebugOverlay`.
 */
export class Debug {}
