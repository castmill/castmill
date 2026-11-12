import React from 'react';
import BrowserOnly from '@docusaurus/BrowserOnly';
import WidgetPreview from '../WidgetPreview';
import { showcaseWidget } from './showcaseWidget';
import styles from './styles.module.css';
/**
 * A display bezel that runs a real template widget through the Castmill
 * player, so the homepage shows the same rendering a screen would.
 */
export default function HomeShowcase() {
    return (<figure className={styles.figure}>
      <div className={styles.screen}>
        <div className={styles.viewport}>
          <BrowserOnly fallback={<div className={styles.placeholder}/>}>
            {() => <WidgetPreview widget={showcaseWidget} height="100%" bare/>}
          </BrowserOnly>
        </div>
      </div>
      <div className={styles.stand} aria-hidden="true"/>
      <figcaption className={styles.caption}>
        A template widget, rendered live by the Castmill player.
      </figcaption>
    </figure>);
}
