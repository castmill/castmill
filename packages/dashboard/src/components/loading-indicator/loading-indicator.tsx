import { Component, createSignal, onMount, onCleanup } from 'solid-js';
import styles from './loading-indicator.module.scss';

interface LoadingIndicatorProps {
  delay?: number; // Delay in milliseconds before showing (default 500ms)
  message?: string; // Optional message to display
}

export const LoadingIndicator: Component<LoadingIndicatorProps> = (props) => {
  const [showIndicator, setShowIndicator] = createSignal(false);
  let timeoutId: NodeJS.Timeout | undefined;

  onMount(() => {
    // Show the indicator after the specified delay
    timeoutId = setTimeout(() => {
      setShowIndicator(true);
    }, props.delay ?? 500);
  });

  onCleanup(() => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  });

  return (
    <div class={styles.loadingContainer}>
      {showIndicator() && (
        <>
          <div class={styles.spinner}></div>
          {props.message && <p class={styles.message}>{props.message}</p>}
        </>
      )}
    </div>
  );
};
