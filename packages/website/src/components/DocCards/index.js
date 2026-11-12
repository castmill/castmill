import React from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import Icon from '../Icon';
import styles from './styles.module.css';
export function CardGrid({ children, columns = 3, }) {
    return (<div className={clsx(styles.grid, columns === 2 ? styles.twoColumns : styles.threeColumns)}>
      {children}
    </div>);
}
export function Card({ title, href, icon, children, }) {
    return (<Link to={href} className={styles.card}>
      {icon && (<span className={styles.icon} aria-hidden="true">
          <Icon name={icon}/>
        </span>)}
      <span className={styles.title}>{title}</span>
      {children && <span className={styles.description}>{children}</span>}
      <span className={styles.arrow} aria-hidden="true">
        →
      </span>
    </Link>);
}
/** Numbered list of steps rendered as a vertical timeline. */
export function Steps({ children }) {
    return <div className={styles.steps}>{children}</div>;
}
/** A horizontal chain of boxes joined by arrows. Wraps on narrow screens. */
export function Flow({ steps }) {
    return (<div className={styles.flow} role="list">
      {steps.map((step, index) => {
            const [title, subtitle] = step.split('|');
            return (<React.Fragment key={step}>
            {index > 0 && (<span className={styles.flowArrow} aria-hidden="true">
                →
              </span>)}
            <span className={styles.flowBox} role="listitem">
              <strong>{title}</strong>
              {subtitle && <span>{subtitle}</span>}
            </span>
          </React.Fragment>);
        })}
    </div>);
}
