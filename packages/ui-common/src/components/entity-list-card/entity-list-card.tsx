import {
  Component,
  For,
  JSX,
  Show,
  children,
  createMemo,
  createSignal,
  splitProps,
} from 'solid-js';
import { Dynamic } from 'solid-js/web';

import style from './entity-list-card.module.scss';

export type EntityCardTone = 'neutral' | 'success' | 'warning' | 'danger';

/** A metadata entry; falsy entries (e.g. `cond && value`) are skipped. */
export type EntityCardMetaItem = JSX.Element | false | null | undefined;

export interface EntityListCardSelection {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Accessible name of the checkbox. */
  label: string;
  id?: string;
}

export interface EntityListCardProps {
  /** Primary entity name. Truncated to one line. */
  title: JSX.Element;
  /** Plain-text title used as tooltip when the title is truncated. */
  titleText?: string;
  /** Short description or identifying information (one line). */
  subtitle?: JSX.Element;
  /** Compact secondary values, rendered inline and separated by dots. */
  meta?: EntityCardMetaItem[];
  /** Thumbnail, preview or icon, rendered in a fixed square. */
  visual?: JSX.Element;
  /** Optional row for genuinely important operational information. */
  footer?: JSX.Element;
  /** Selection checkbox; omitted when not selectable. */
  selection?: EntityListCardSelection;
  /** Overflow menu (or other trailing actions), pinned to the top end. */
  actions?: JSX.Element;
  /** Opens the entity when the card's main content is activated. */
  onOpen?: () => void;
  /** Dims the card and disables opening and selection. */
  disabled?: boolean;
  /** Marks the card as loading (`aria-busy`). */
  busy?: boolean;
  class?: string;
}

const isPresent = (item: EntityCardMetaItem) =>
  item !== false && item !== null && item !== undefined && item !== '';

const hasContent = (value: unknown): boolean =>
  Array.isArray(value) ? value.some(hasContent) : isPresent(value as any);

/**
 * Compact horizontal card used for entities in narrow list layouts:
 * `[checkbox] [visual] [title / subtitle / meta] [actions]`.
 *
 * The title is the only "open" control; a pseudo-element stretches its hit
 * area over the whole card, so tapping anywhere opens the entity while the
 * checkbox, actions and any other controls stay independent (no nested
 * interactive elements).
 */
export const EntityListCard: Component<EntityListCardProps> = (props) => {
  const meta = createMemo(() => (props.meta || []).filter(isPresent));
  // Resolve each slot once: reading a JSX prop getter twice (for the `Show`
  // condition and the content) would otherwise create its elements twice.
  const visual = children(() => props.visual);
  const subtitle = children(() => props.subtitle);
  const footer = children(() => props.footer);
  const actions = children(() => props.actions);
  const canOpen = () => !!props.onOpen && !props.disabled;

  return (
    <div
      class={`${style.card} ${props.class ?? ''}`}
      classList={{
        [style.selected]: !!props.selection?.checked,
        [style.openable]: canOpen(),
        [style.disabled]: !!props.disabled,
        [style.busy]: !!props.busy,
      }}
      aria-busy={props.busy ? 'true' : undefined}
      aria-disabled={props.disabled ? 'true' : undefined}
      data-entity-card=""
    >
      <Show when={props.selection}>
        {(selection) => (
          <label class={style.select}>
            <input
              type="checkbox"
              id={selection().id}
              class={style.checkbox}
              checked={selection().checked}
              disabled={props.disabled}
              aria-label={selection().label}
              onInput={(e) => selection().onChange(e.currentTarget.checked)}
            />
          </label>
        )}
      </Show>

      <Show when={hasContent(visual())}>
        <div class={style.visual}>{visual()}</div>
      </Show>

      <div class={style.body}>
        <div class={style.title} title={props.titleText}>
          <Show when={canOpen()} fallback={props.title}>
            <button
              type="button"
              class={style.open}
              onClick={() => props.onOpen?.()}
            >
              {props.title}
            </button>
          </Show>
        </div>
        <Show when={hasContent(subtitle())}>
          <div class={style.subtitle}>{subtitle()}</div>
        </Show>
        <Show when={meta().length > 0}>
          <div class={style['meta-clip']}>
            <div class={style.meta}>
              <For each={meta()}>
                {(item) => <span class={style['meta-item']}>{item}</span>}
              </For>
            </div>
          </div>
        </Show>
        <Show when={hasContent(footer())}>
          <div class={style.footer}>{footer()}</div>
        </Show>
      </div>

      <Show when={hasContent(actions())}>
        <div class={style.actions}>{actions()}</div>
      </Show>
    </div>
  );
};

type IconComponent = Component<any>;

export interface EntityCardIconProps {
  icon?: IconComponent;
  /** Text/emoji glyph shown when no icon component is given. */
  glyph?: string;
  tone?: EntityCardTone;
}

/** Centered icon (or emoji glyph) for entities without a preview. */
export const EntityCardIcon: Component<EntityCardIconProps> = (props) => (
  <span
    class={style.icon}
    data-tone={props.tone ?? 'neutral'}
    aria-hidden="true"
  >
    <Show when={props.icon} fallback={props.glyph}>
      {(icon) => <Dynamic component={icon()} />}
    </Show>
  </span>
);

export interface EntityCardThumbnailProps {
  src?: string;
  alt?: string;
  /** Shown when there is no `src` or the image fails to load. */
  fallbackIcon?: IconComponent;
  fallbackGlyph?: string;
  /** `contain` keeps logos/icons uncropped; defaults to `cover`. */
  fit?: 'cover' | 'contain';
}

/** Image preview filling the visual square, with an icon fallback. */
export const EntityCardThumbnail: Component<EntityCardThumbnailProps> = (
  props
) => {
  const [failedSrc, setFailedSrc] = createSignal<string>();
  const showImage = () => !!props.src && failedSrc() !== props.src;

  return (
    <Show
      when={showImage()}
      fallback={
        <EntityCardIcon icon={props.fallbackIcon} glyph={props.fallbackGlyph} />
      }
    >
      <img
        class={style.thumbnail}
        classList={{ [style.contain]: props.fit === 'contain' }}
        src={props.src}
        alt={props.alt ?? ''}
        loading="lazy"
        onError={() => setFailedSrc(props.src)}
      />
    </Show>
  );
};

export interface EntityCardStatusProps {
  tone: EntityCardTone;
  children: JSX.Element;
  title?: string;
}

/** Small status dot followed by a short label. */
export const EntityCardStatus: Component<EntityCardStatusProps> = (props) => (
  <span class={style.status} data-tone={props.tone} title={props.title}>
    <span class={style.dot} aria-hidden="true" />
    {props.children}
  </span>
);

export interface EntityCardNoticeProps extends JSX.HTMLAttributes<HTMLDivElement> {
  tone?: Exclude<EntityCardTone, 'success'>;
  /**
   * Explanation shown after the headline (clamped to two lines). Keep the
   * essential information visible; tooltips are unreachable on touch screens.
   */
  detail?: JSX.Element;
}

/** Compact, tinted footer line for actionable operational problems. */
export const EntityCardNotice: Component<EntityCardNoticeProps> = (props) => {
  const [local, rest] = splitProps(props, [
    'tone',
    'class',
    'children',
    'detail',
  ]);
  return (
    <div
      {...rest}
      class={`${style.notice} ${local.class ?? ''}`}
      data-tone={local.tone ?? 'warning'}
    >
      <span class={style['notice-text']}>
        <strong class={style['notice-title']}>{local.children}</strong>
        <Show when={local.detail}>
          <span class={style['notice-detail']}>{local.detail}</span>
        </Show>
      </span>
    </div>
  );
};

export interface EntityCardFieldProps {
  label: JSX.Element;
  children: JSX.Element;
}

/**
 * Labelled metadata value, for values whose meaning is not obvious on its own
 * (e.g. counts). Prefer bare values when they are self-explanatory.
 */
export const EntityCardField: Component<EntityCardFieldProps> = (props) => (
  <span class={style.field}>
    <span class={style['field-label']}>{props.label}</span>
    {props.children}
  </span>
);

export interface EntityCardMetaIconProps {
  icon: IconComponent;
  /** Accessible name, e.g. the file type the icon stands for. */
  label?: string;
}

/** Small icon used as a metadata value (e.g. photo/video kind). */
export const EntityCardMetaIcon: Component<EntityCardMetaIconProps> = (
  props
) => (
  <Dynamic
    component={props.icon}
    class={style['meta-icon']}
    role="img"
    aria-label={props.label}
    title={props.label}
  />
);
