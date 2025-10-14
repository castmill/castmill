import {
  Component,
  Show,
  createSignal,
  createEffect,
  onCleanup,
} from 'solid-js';
import styles from './loading-progress-bar.module.scss';

interface LoadingProgressBarProps {
  loading: boolean;
}

export const LoadingProgressBar: Component<LoadingProgressBarProps> = (
  props
) => {
  const [progress, setProgress] = createSignal(0);
  const [visible, setVisible] = createSignal(false);
  let intervalId: NodeJS.Timeout | undefined;
  let timeoutId: NodeJS.Timeout | undefined;

  // Watch for loading state changes
  createEffect(() => {
    if (props.loading) {
      // Start showing the progress bar
      setVisible(true);
      setProgress(0);

      // Simulate progress
      let currentProgress = 0;
      intervalId = setInterval(() => {
        currentProgress += Math.random() * 15;
        if (currentProgress > 90) {
          currentProgress = 90; // Never complete until actually done
        }
        setProgress(currentProgress);
      }, 200);
    } else if (visible()) {
      // Complete the progress and hide
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = undefined;
      }

      // Jump to 100% and then fade out
      setProgress(100);
      timeoutId = setTimeout(() => {
        setVisible(false);
        setProgress(0);
      }, 400);
    }
  });

  onCleanup(() => {
    if (intervalId) clearInterval(intervalId);
    if (timeoutId) clearTimeout(timeoutId);
  });

  return (
    <Show when={visible()}>
      <div class={styles.progressBar}>
        <div class={styles.progressFill} style={{ width: `${progress()}%` }} />
      </div>
    </Show>
  );
};
