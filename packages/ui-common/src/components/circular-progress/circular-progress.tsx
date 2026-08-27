import { Component } from 'solid-js';
import styles from './circular-progress.module.scss';

interface CircularProgressProps {
  progress: number;
}

export const CircularProgress: Component<CircularProgressProps> = (props) => {
  const radius = 1.2; // Using em units for radius
  const strokeWidth = 0.3; // Using em units for stroke width
  const circumference = 2 * Math.PI * radius;

  const offset = circumference - (props.progress / 100) * circumference;

  return (
    <div class={styles.circularContainer}>
      <svg
        class={styles.svgContainer}
        viewBox={`0 0 ${2 * (radius + strokeWidth)} ${2 * (radius + strokeWidth)}`}
      >
        <circle
          cx={radius + strokeWidth}
          cy={radius + strokeWidth}
          r={radius}
          stroke-width={strokeWidth}
          fill="none"
          stroke="#999"
        />
        <circle
          cx={radius + strokeWidth}
          cy={radius + strokeWidth}
          r={radius}
          stroke-width={strokeWidth}
          fill="none"
          stroke="#5792ee"
          stroke-dasharray={circumference.toString()}
          stroke-dashoffset={offset}
          transform={`rotate(-90 ${radius + strokeWidth} ${radius + strokeWidth})`}
        />
      </svg>
      <span class={styles.progressText}>{props.progress}%</span>
    </div>
  );
};
