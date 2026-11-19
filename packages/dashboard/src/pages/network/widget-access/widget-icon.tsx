import {
  Component,
  Match,
  Switch,
  createEffect,
  createSignal,
  on,
} from 'solid-js';
import { BsPuzzle } from 'solid-icons/bs';
import { resolveWidgetIcon } from '@castmill/ui-common';
import { baseUrl } from '../../../env';
import { NetworkWidgetAccess } from '../../../services/network.service';
import styles from './widget-access.module.scss';

export const WidgetIcon: Component<{
  icon?: string | null;
  size?: 'medium' | 'large';
}> = (props) => {
  const [failed, setFailed] = createSignal(false);
  const icon = () => resolveWidgetIcon(props.icon, baseUrl);

  createEffect(
    on(
      () => props.icon,
      () => setFailed(false),
      { defer: true }
    )
  );

  return (
    <span
      class={`${styles['widget-icon']} ${
        props.size === 'large' ? styles['widget-icon-large'] : ''
      }`}
      aria-hidden="true"
    >
      <Switch fallback={<BsPuzzle class={styles['widget-icon-fallback']} />}>
        <Match when={!failed() && icon().src}>
          {(src) => (
            <img
              src={src()}
              alt=""
              loading="lazy"
              onError={() => setFailed(true)}
            />
          )}
        </Match>
        <Match when={[...(icon().glyph ?? '')].length <= 4 && icon().glyph}>
          {(glyph) => (
            <span class={styles['widget-icon-emoji']}>{glyph()}</span>
          )}
        </Match>
      </Switch>
    </span>
  );
};

export const widgetName = (widget: NetworkWidgetAccess, locale: string) =>
  widget.translations?.[locale]?.name ??
  widget.translations?.en?.name ??
  widget.name;

export const widgetDescription = (
  widget: NetworkWidgetAccess,
  locale: string
) =>
  widget.translations?.[locale]?.description ??
  widget.translations?.en?.description ??
  widget.description;
