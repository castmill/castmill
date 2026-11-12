import React from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import Icon, { type IconName } from '../Icon';
import styles from './styles.module.css';

interface CardGridProps {
  children: React.ReactNode;
  columns?: 2 | 3;
}

export function CardGrid({
  children,
  columns = 3,
}: CardGridProps): React.JSX.Element {
  return (
    <div
      className={clsx(
        styles.grid,
        columns === 2 ? styles.twoColumns : styles.threeColumns
      )}
    >
      {children}
    </div>
  );
}

interface CardProps {
  title: string;
  href: string;
  icon?: IconName;
  children?: React.ReactNode;
}

export function Card({
  title,
  href,
  icon,
  children,
}: CardProps): React.JSX.Element {
  return (
    <Link to={href} className={styles.card}>
      {icon && (
        <span className={styles.icon} aria-hidden="true">
          <Icon name={icon} />
        </span>
      )}
      <span className={styles.title}>{title}</span>
      {children && <span className={styles.description}>{children}</span>}
      <span className={styles.arrow} aria-hidden="true">
        →
      </span>
    </Link>
  );
}

interface StepsProps {
  children: React.ReactNode;
}

/** Numbered list of steps rendered as a vertical timeline. */
export function Steps({ children }: StepsProps): React.JSX.Element {
  return <div className={styles.steps}>{children}</div>;
}

interface FlowProps {
  /** Labels of the boxes, in order. Use "Title|Subtitle" to add a subtitle. */
  steps: string[];
}

/** A horizontal chain of boxes joined by arrows. Wraps on narrow screens. */
export function Flow({ steps }: FlowProps): React.JSX.Element {
  return (
    <div className={styles.flow} role="list">
      {steps.map((step, index) => {
        const [title, subtitle] = step.split('|');
        return (
          <React.Fragment key={step}>
            {index > 0 && (
              <span className={styles.flowArrow} aria-hidden="true">
                →
              </span>
            )}
            <span className={styles.flowBox} role="listitem">
              <strong>{title}</strong>
              {subtitle && <span>{subtitle}</span>}
            </span>
          </React.Fragment>
        );
      })}
    </div>
  );
}
