import { Component, For, Show, createSignal } from 'solid-js';
import { useToast } from '@castmill/ui-common';
import {
  BsEyeSlash,
  BsGlobe2,
  BsInfoCircle,
  BsPersonCheck,
  BsPersonDash,
  BsShieldLock,
} from 'solid-icons/bs';
import {
  NetworkService,
  NetworkWidgetAccess,
  WidgetAccessMode,
} from '../../../services/network.service';
import { useI18n } from '../../../i18n';
import { WidgetIcon, widgetDescription, widgetName } from './widget-icon';
import { ConfirmAccessChange, accessErrorMessage } from './access-ui';
import { StatusFilter, WidgetOrganizations } from './widget-organizations';
import { WidgetPackage } from './widget-package';
import styles from './widget-access.module.scss';

const MODES: { mode: WidgetAccessMode; icon: typeof BsGlobe2 }[] = [
  { mode: 'all', icon: BsGlobe2 },
  { mode: 'except', icon: BsPersonDash },
  { mode: 'selected', icon: BsPersonCheck },
  { mode: 'hidden', icon: BsEyeSlash },
];

export const WidgetDetail: Component<{
  widget: NetworkWidgetAccess;
  onWidgetChange: (widget: NetworkWidgetAccess) => void;
  onWidgetDeleted?: (widget: NetworkWidgetAccess) => void;
}> = (props) => {
  const { t, locale } = useI18n();
  const toast = useToast();
  const [modeSaving, setModeSaving] = createSignal(false);
  const [organizationsSaving, setOrganizationsSaving] = createSignal(false);
  const [confirmHide, setConfirmHide] = createSignal(false);
  const [status, setStatus] = createSignal<StatusFilter>('all');
  // Bumped after mode changes so the table reloads; organization changes reload it
  // themselves.
  const [version, setVersion] = createSignal(0);

  const name = () => widgetName(props.widget, locale());
  const saving = () => modeSaving() || organizationsSaving();
  const onChange = (widget: NetworkWidgetAccess) => {
    props.onWidgetChange(widget);
    setVersion((value) => value + 1);
  };

  const applyMode = async (mode: WidgetAccessMode) => {
    setModeSaving(true);
    try {
      onChange(await NetworkService.setWidgetAccess(props.widget.id, mode));
    } catch (error) {
      toast.error(accessErrorMessage(error, t));
    } finally {
      setModeSaving(false);
    }
  };

  const chooseMode = (mode: WidgetAccessMode) => {
    if (saving() || mode === props.widget.access) return;
    if (mode === 'hidden') setConfirmHide(true);
    else void applyMode(mode);
  };

  // Roving tab stop: only the checked mode (or the first) is in the tab order.
  const isTabStop = (mode: WidgetAccessMode) =>
    MODES.some((option) => option.mode === props.widget.access)
      ? props.widget.access === mode
      : MODES[0].mode === mode;

  // Arrow keys move focus between modes; Space/Enter selects one, since selecting
  // saves immediately (and "hidden" asks for confirmation).
  const onModeKeyDown = (event: KeyboardEvent) => {
    const radios = Array.from(
      (event.currentTarget as HTMLElement).querySelectorAll<HTMLButtonElement>(
        '[role="radio"]:not(:disabled)'
      )
    );
    if (radios.length === 0) return;
    const index = radios.indexOf(document.activeElement as HTMLButtonElement);
    let next: number;
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        next = (index + 1) % radios.length;
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        next = (index - 1 + radios.length) % radios.length;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = radios.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    radios[next].focus();
  };

  return (
    <article class={styles['detail']} aria-label={name()}>
      <header class={styles['detail-header']}>
        <WidgetIcon icon={props.widget.icon} size="large" />
        <div class={styles['detail-title']}>
          <div class={styles['detail-title-row']}>
            <h2>{name()}</h2>
            <span class={styles['tag']}>
              {t(`network.widgets.kind.${props.widget.kind}`)}
            </span>
            <Show when={props.widget.core}>
              <span class={`${styles['tag']} ${styles['tag-core']}`}>
                <BsShieldLock aria-hidden="true" />
                {t('network.widgets.core')}
              </span>
            </Show>
          </div>
          <Show when={widgetDescription(props.widget, locale())}>
            <p class={styles['detail-description']}>
              {widgetDescription(props.widget, locale())}
            </p>
          </Show>
          <div class={styles['detail-meta']}>
            <code>{props.widget.slug}</code>
            <span>
              {t('network.widgets.usedBy', {
                count: props.widget.in_use_count,
              })}
            </span>
          </div>
        </div>
        <span class={styles['save-state']} aria-live="polite">
          {saving() ? t('common.saving') : ''}
        </span>
      </header>

      <Show when={props.widget.owned}>
        <WidgetPackage
          widget={props.widget}
          widgetLabel={name()}
          onDeleted={(widget) => props.onWidgetDeleted?.(widget)}
        />
      </Show>

      <section class={styles['detail-section']}>
        <h3>{t('network.widgets.access.title')}</h3>
        <div
          class={styles['mode-cards']}
          role="radiogroup"
          aria-label={t('network.widgets.access.title')}
          onKeyDown={onModeKeyDown}
        >
          <For each={MODES}>
            {({ mode, icon: Icon }) => (
              <button
                type="button"
                role="radio"
                aria-checked={props.widget.access === mode}
                tabIndex={isTabStop(mode) ? 0 : -1}
                class={styles['mode-card']}
                classList={{
                  [styles['mode-card-active']]: props.widget.access === mode,
                  [styles[`mode-card-${mode}`]]: true,
                }}
                disabled={props.widget.core || saving()}
                onClick={() => chooseMode(mode)}
              >
                <span class={styles['mode-card-icon']} aria-hidden="true">
                  <Icon />
                </span>
                <span class={styles['mode-card-text']}>
                  <span class={styles['mode-card-title']}>
                    {t(`network.widgets.access.${mode}`)}
                  </span>
                  <span class={styles['mode-card-description']}>
                    {t(`network.widgets.access.${mode}Description`)}
                  </span>
                </span>
              </button>
            )}
          </For>
        </div>

        <p class={styles['notice']}>
          <BsInfoCircle aria-hidden="true" />
          <span>
            {props.widget.core
              ? t('network.widgets.notices.core')
              : t(`network.widgets.notices.${props.widget.access}`)}
          </span>
        </p>
        <Show when={props.widget.platform_restricted}>
          <p class={styles['notice']}>
            <BsInfoCircle aria-hidden="true" />
            <span>
              {t('network.widgets.notices.platform', {
                count: props.widget.eligible_count,
                total: props.widget.organizations_count,
              })}
            </span>
          </p>
        </Show>
      </section>

      <Show when={!props.widget.core}>
        <section class={`${styles['detail-section']} ${styles['detail-grow']}`}>
          <h3>{t('network.widgets.organizations.title')}</h3>
          <WidgetOrganizations
            widget={props.widget}
            widgetLabel={name()}
            reloadKey={version()}
            status={status()}
            onStatusChange={setStatus}
            onWidgetChange={props.onWidgetChange}
            onSavingChange={setOrganizationsSaving}
            blocked={modeSaving()}
          />
        </section>
      </Show>

      <Show when={confirmHide()}>
        <ConfirmAccessChange
          title={t('network.widgets.confirm.hideTitle', { widget: name() })}
          message={t('network.widgets.confirm.hideMessage')}
          confirmLabel={t('network.widgets.confirm.hideAction')}
          cancelLabel={t('common.cancel')}
          danger
          onConfirm={() => {
            setConfirmHide(false);
            void applyMode('hidden');
          }}
          onClose={() => setConfirmHide(false)}
        />
      </Show>
    </article>
  );
};
