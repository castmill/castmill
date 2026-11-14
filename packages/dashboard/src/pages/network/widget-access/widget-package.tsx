import { Component, Show, createSignal } from 'solid-js';
import { Button, useToast } from '@castmill/ui-common';
import { BsDownload, BsInfoCircle, BsTrash } from 'solid-icons/bs';
import {
  NetworkService,
  NetworkWidgetAccess,
} from '../../../services/network.service';
import { useI18n } from '../../../i18n';
import { ConfirmAccessChange, accessErrorMessage } from './access-ui';
import styles from './widget-access.module.scss';

const saveFile = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

/**
 * The uploaded package of a network widget: its version, a download of it, and
 * deleting the widget. Widgets the platform installs can be neither.
 */
export const WidgetPackage: Component<{
  widget: NetworkWidgetAccess;
  widgetLabel: string;
  onDeleted: (widget: NetworkWidgetAccess) => void;
}> = (props) => {
  const { t, locale } = useI18n();
  const toast = useToast();
  const [busy, setBusy] = createSignal(false);
  const [confirmDelete, setConfirmDelete] = createSignal(false);

  const uploadedAt = () => {
    const value = props.widget.package?.inserted_at;
    if (!value) return '';
    return new Date(value).toLocaleString(locale(), {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  };

  const download = async () => {
    const version = props.widget.package?.version;
    if (!version) return;
    setBusy(true);
    try {
      const { blob, filename } = await NetworkService.downloadWidgetPackage(
        props.widget.id,
        version
      );
      saveFile(blob, filename);
    } catch {
      toast.error(t('network.widgets.package.errors.download'));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setConfirmDelete(false);
    setBusy(true);
    try {
      await NetworkService.deleteWidget(props.widget.id);
      toast.success(
        t('network.widgets.package.deleted', { widget: props.widgetLabel })
      );
      props.onDeleted(props.widget);
    } catch (error) {
      toast.error(accessErrorMessage(error, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section class={styles['detail-section']}>
      <h3>{t('network.widgets.package.title')}</h3>
      <Show
        when={!props.widget.managed}
        fallback={
          <p class={styles['notice']}>
            <BsInfoCircle aria-hidden="true" />
            <span>{t('network.widgets.package.managed')}</span>
          </p>
        }
      >
        <div class={styles['package-row']}>
          <Show when={props.widget.package}>
            <span class={styles['package-version']}>
              {t('network.widgets.package.version', {
                version: props.widget.package!.version,
              })}
            </span>
            <span class={styles['package-date']}>
              {t('network.widgets.package.uploaded', { date: uploadedAt() })}
            </span>
          </Show>
          <div class={styles['package-actions']}>
            <Show when={props.widget.package}>
              <Button
                label={t('network.widgets.package.download')}
                icon={BsDownload}
                color="secondary"
                disabled={busy()}
                onClick={() => void download()}
              />
            </Show>
            <Button
              label={t('network.widgets.package.delete')}
              icon={BsTrash}
              color="danger"
              disabled={busy() || props.widget.in_use_count > 0}
              onClick={() => setConfirmDelete(true)}
            />
          </div>
        </div>
        <Show when={props.widget.in_use_count > 0}>
          <p class={styles['notice']}>
            <BsInfoCircle aria-hidden="true" />
            <span>{t('network.widgets.package.deleteInUse')}</span>
          </p>
        </Show>
      </Show>

      <Show when={confirmDelete()}>
        <ConfirmAccessChange
          title={t('network.widgets.package.deleteTitle', {
            widget: props.widgetLabel,
          })}
          message={t('network.widgets.package.deleteMessage')}
          confirmLabel={t('network.widgets.package.delete')}
          cancelLabel={t('common.cancel')}
          danger
          onConfirm={() => void remove()}
          onClose={() => setConfirmDelete(false)}
        />
      </Show>
    </section>
  );
};
