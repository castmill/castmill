import {
  Component,
  Match,
  Switch,
  createEffect,
  createSignal,
  on,
} from 'solid-js';
import { BsPuzzle } from 'solid-icons/bs';
import { baseUrl } from '../../../env';
import { NetworkWidgetAccess } from '../../../services/network.service';
import styles from './widget-access.module.scss';

const isImageIcon = (icon: string) =>
  /^(data:image\/|https?:\/\/|\/)/.test(icon);

/** Widget icons are absolute URLs, data URIs, backend paths or short emoji. */
export const resolveIconUrl = (icon: string) =>
  icon.startsWith('/') && !icon.startsWith('//') ? `${baseUrl}${icon}` : icon;

export const WidgetIcon: Component<{
  icon?: string | null;
  size?: 'medium' | 'large';
}> = (props) => {
  const [failed, setFailed] = createSignal(false);
  const icon = () => props.icon?.trim() ?? '';

  createEffect(on(icon, () => setFailed(false), { defer: true }));

  return (
    <span
      class={`${styles['widget-icon']} ${
        props.size === 'large' ? styles['widget-icon-large'] : ''
      }`}
      aria-hidden="true"
    >
      <Switch fallback={<BsPuzzle class={styles['widget-icon-fallback']} />}>
        <Match when={icon() && isImageIcon(icon()) && !failed()}>
          <img
            src={resolveIconUrl(icon())}
            alt=""
            loading="lazy"
            onError={() => setFailed(true)}
          />
        </Match>
        <Match when={icon() && !isImageIcon(icon()) && [...icon()].length <= 4}>
          <span class={styles['widget-icon-emoji']}>{icon()}</span>
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
