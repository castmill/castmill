/** @jsxImportSource solid-js */

import { JSX, ParentComponent, Show } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import type { IconTypes } from 'solid-icons';

import styles from './section-card.module.scss';

export interface SectionCardHeaderProps {
  title: JSX.Element;
  /** Id of the heading, for `aria-labelledby` references. */
  titleId?: string;
  description?: JSX.Element;
  icon?: IconTypes;
  /** Optional badge next to the title, e.g. the number of items. */
  count?: number;
  /** Buttons or status shown at the end of the header. */
  actions?: JSX.Element;
  class?: string;
}

const join = (...classes: Array<string | false | undefined>) =>
  classes.filter(Boolean).join(' ');

/** Header of a details section: icon, title, count, description, actions. */
export const SectionCardHeader = (props: SectionCardHeaderProps) => (
  <header class={join(styles.header, props.class)}>
    <div class={styles.heading}>
      <h3 id={props.titleId}>
        <Show when={props.icon}>
          {(icon) => (
            <span class={styles.icon} aria-hidden="true">
              <Dynamic component={icon()} />
            </span>
          )}
        </Show>
        <span>{props.title}</span>
        <Show when={props.count !== undefined}>
          <span class={styles.count}>{props.count}</span>
        </Show>
      </h3>
      <Show when={props.description}>
        {(description) => <p class={styles.description}>{description()}</p>}
      </Show>
    </div>
    <Show when={props.actions}>
      {(actions) => (
        <div class={styles.actions} data-section-actions>
          {actions()}
        </div>
      )}
    </Show>
  </header>
);

export interface SectionCardProps extends Omit<
  SectionCardHeaderProps,
  'class' | 'title'
> {
  /** Card title. Without a title (and actions) the header is omitted. */
  title?: JSX.Element;
  /** Footer actions, rendered on a sunken bar at the bottom of the card. */
  footer?: JSX.Element;
  footerClass?: string;
  class?: string;
  ref?: HTMLElement | ((el: HTMLElement) => void);
  'aria-label'?: string;
  'aria-labelledby'?: string;
}

/**
 * Card used for the sections of details drawers (devices, playlists...).
 * The card padding shrinks on phones and the footer bleeds to the card edges.
 */
export const SectionCard: ParentComponent<SectionCardProps> = (props) => (
  <section
    ref={props.ref as HTMLElement}
    class={join(styles.card, props.class)}
    aria-label={props['aria-label']}
    aria-labelledby={props['aria-labelledby']}
    data-section-card
  >
    <Show when={props.title !== undefined || props.actions}>
      <SectionCardHeader
        title={props.title}
        titleId={props.titleId}
        description={props.description}
        icon={props.icon}
        count={props.count}
        actions={props.actions}
      />
    </Show>
    {props.children}
    <Show when={props.footer}>
      {(footer) => (
        <footer class={join(styles.footer, props.footerClass)}>
          {footer()}
        </footer>
      )}
    </Show>
  </section>
);
