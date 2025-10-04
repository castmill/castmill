/** @jsxImportSource solid-js */

import { Component, For } from 'solid-js';
import { Portal } from 'solid-js/web';
import { Toast, ToastProps } from './toast';

import styles from './toast-container.module.scss';

export interface ToastContainerProps {
  toasts: ToastProps[];
  onRemove: (id: string) => void;
}

export const ToastContainer: Component<ToastContainerProps> = (props) => {
  return (
    <Portal mount={document.body}>
      <div class={styles.toastContainer} data-testid="toast-container">
        <For each={props.toasts}>
          {(toast) => (
            <Toast
              {...toast}
              onClose={() => {
                if (toast.onClose) {
                  toast.onClose();
                }
                props.onRemove(toast.id);
              }}
            />
          )}
        </For>
      </div>
    </Portal>
  );
};
