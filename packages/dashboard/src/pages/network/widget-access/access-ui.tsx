import { Component } from 'solid-js';
import { Button, HttpError, Modal } from '@castmill/ui-common';
import {
  NetworkWidgetAccess,
  WidgetInUseDetails,
} from '../../../services/network.service';
import styles from './widget-access.module.scss';

type Translate = (key: string, params?: Record<string, any>) => string;

export const accessLabel = (widget: NetworkWidgetAccess, t: Translate) => {
  switch (widget.access) {
    case 'all':
      return t('network.widgets.summary.all');
    case 'except':
      return t('network.widgets.summary.except', {
        count: widget.listed_count,
      });
    case 'selected':
      return t('network.widgets.summary.selected', {
        count: widget.enabled_count,
        total: widget.eligible_count,
      });
    default:
      return t('network.widgets.summary.hidden');
  }
};

export const AccessStatus: Component<{
  widget: NetworkWidgetAccess;
  t: Translate;
}> = (props) => (
  <span
    class={`${styles['access-status']} ${
      styles[`access-status-${props.widget.access}`]
    }`}
  >
    <span class={styles['access-dot']} aria-hidden="true" />
    {accessLabel(props.widget, props.t)}
  </span>
);

/** Localized message for a failed access change, naming organizations in use. */
export const accessErrorMessage = (error: unknown, t: Translate) => {
  if (error instanceof HttpError && error.status === 409) {
    const organizations =
      (error.details as WidgetInUseDetails | undefined)?.organizations ?? [];
    const names = organizations.slice(0, 3).map((org) => org.name);
    const remaining = organizations.length - names.length;
    const list =
      remaining > 0
        ? t('network.widgets.errors.moreOrganizations', {
            names: names.join(', '),
            count: remaining,
          })
        : names.join(', ');

    return t('network.widgets.errors.inUse', { organizations: list });
  }

  if (error instanceof HttpError && error.status === 422) {
    return error.message;
  }

  return t('network.widgets.errors.save');
};

export const ConfirmAccessChange: Component<{
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}> = (props) => (
  <Modal
    title={props.title}
    description={props.message}
    onClose={props.onClose}
  >
    <div class={styles['confirm-actions']}>
      <Button
        label={props.cancelLabel}
        color="secondary"
        onClick={props.onClose}
      />
      <Button
        label={props.confirmLabel}
        color={props.danger ? 'danger' : 'primary'}
        onClick={props.onConfirm}
      />
    </div>
  </Modal>
);
