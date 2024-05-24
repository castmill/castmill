/** @jsxImportSource solid-js */
import { Component, Show } from 'solid-js';
import styles from './loading-overlay.module.scss';

interface LoadingOverlayProps {
  show: boolean;
}

export const LoadingOverlay: Component<LoadingOverlayProps> = (props) => {
  return (
    <Show when={props.show}>
      <div class={styles.loadingOverlay}>
        <div class={styles.spinner}></div>
      </div>
    </Show>
  );
};
