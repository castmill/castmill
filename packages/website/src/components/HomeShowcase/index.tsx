import React from 'react';
import BrowserOnly from '@docusaurus/BrowserOnly';
import WidgetPreview from '../WidgetPreview';
import {
  showcaseOptions,
  showcaseWidget,
  stillShowcaseWidget,
} from './showcaseWidget';
import styles from './styles.module.css';

const prefersReducedMotion = () =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/**
 * A display bezel that runs a real template widget through the Castmill
 * player, so the homepage shows the same rendering a screen would.
 */
export default function HomeShowcase(): React.JSX.Element {
  return (
    <figure className={styles.figure}>
      <div className={styles.screen}>
        <div className={styles.viewport}>
          <BrowserOnly fallback={<div className={styles.placeholder} />}>
            {() => (
              <WidgetPreview
                widget={
                  prefersReducedMotion() ? stillShowcaseWidget : showcaseWidget
                }
                options={showcaseOptions}
                height="100%"
                bare
              />
            )}
          </BrowserOnly>
        </div>
      </div>
      <div className={styles.stand} aria-hidden="true" />
      <figcaption className={styles.caption}>
        A template widget, rendered live by the Castmill player.
      </figcaption>
    </figure>
  );
}
