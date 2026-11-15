import React from 'react';
import useBaseUrl from '@docusaurus/useBaseUrl';
import ThemedImage from '@theme/ThemedImage';
import styles from './styles.module.css';

type ScreenshotProps = {
  /** File stem in static/img/screenshots, without the -light/-dark suffix. */
  src: string;
  alt: string;
  caption?: React.ReactNode;
  /** Largest display width in pixels, for dialogs and other small captures. */
  width?: number;
};

/**
 * A dashboard screenshot that follows the site's colour mode: it shows
 * `<src>-light.webp` in light mode and `<src>-dark.webp` in dark mode.
 */
export default function Screenshot({
  src,
  alt,
  caption,
  width,
}: ScreenshotProps) {
  const sources = {
    light: useBaseUrl(`/img/screenshots/${src}-light.webp`),
    dark: useBaseUrl(`/img/screenshots/${src}-dark.webp`),
  };

  return (
    <figure
      className={styles.figure}
      style={width ? { maxWidth: width } : undefined}
    >
      <ThemedImage
        className={styles.image}
        sources={sources}
        alt={alt}
        loading="lazy"
      />
      {caption && <figcaption className={styles.caption}>{caption}</figcaption>}
    </figure>
  );
}
