/** @jsxImportSource solid-js */

import {
  Component,
  Show,
  onMount,
  onCleanup,
  createSignal,
  mergeProps,
} from 'solid-js';
import { IconTypes } from 'solid-icons';
import {
  AiOutlineCheckCircle,
  AiOutlineCloseCircle,
  AiOutlineInfoCircle,
  AiOutlineWarning,
} from 'solid-icons/ai';
import { VsClose } from 'solid-icons/vs';
import { IconWrapper } from '../icon-wrapper';

import styles from './toast.module.scss';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastProps {
  id: string;
  type?: ToastType;
  message: string;
  duration?: number;
  onClose?: () => void;
}

const iconMap: Record<ToastType, IconTypes> = {
  success: AiOutlineCheckCircle,
  error: AiOutlineCloseCircle,
  info: AiOutlineInfoCircle,
  warning: AiOutlineWarning,
};

export const Toast: Component<ToastProps> = (props) => {
  const defaultProps = mergeProps(
    {
      type: 'info' as ToastType,
      duration: 5000,
    },
    props
  );

  const [isVisible, setIsVisible] = createSignal(false);
  const [isExiting, setIsExiting] = createSignal(false);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => {
      setIsVisible(false);
      if (defaultProps.onClose) {
        defaultProps.onClose();
      }
    }, 300); // Match animation duration
  };

  let autoCloseTimer: NodeJS.Timeout | null = null;

  onMount(() => {
    // Trigger enter animation
    setTimeout(() => setIsVisible(true), 10);

    // Auto-close after duration if specified
    if (defaultProps.duration && defaultProps.duration > 0) {
      autoCloseTimer = setTimeout(() => {
        handleClose();
      }, defaultProps.duration);
    }
  });

  onCleanup(() => {
    if (autoCloseTimer) {
      clearTimeout(autoCloseTimer);
    }
  });

  const toastClasses = () => {
    const classes = [
      styles.toast,
      styles[`toast-${defaultProps.type}`],
      isVisible() ? styles.visible : '',
      isExiting() ? styles.exiting : '',
    ];
    return classes.filter(Boolean).join(' ');
  };

  return (
    <div class={toastClasses()} role="alert" data-testid="toast">
      <div class={styles.toastIcon}>
        <IconWrapper icon={iconMap[defaultProps.type]} />
      </div>
      <div class={styles.toastMessage}>{defaultProps.message}</div>
      <button
        class={styles.toastClose}
        onClick={handleClose}
        aria-label="Close notification"
        data-testid="toast-close-button"
      >
        <IconWrapper icon={VsClose} />
      </button>
    </div>
  );
};
