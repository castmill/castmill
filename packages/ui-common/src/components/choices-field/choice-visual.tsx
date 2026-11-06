import { Component, Show, createSignal, onCleanup } from 'solid-js';
import { BsArrowsFullscreen, BsPlayFill, BsStopFill } from 'solid-icons/bs';

import styles from './choices-field.module.scss';

export interface ChoicePreview {
  type: string;
  url: string;
  mime_type?: string;
}

export interface Choice {
  value: string;
  label: string;
  description?: string;
  thumbnail_url?: string;
  preview?: ChoicePreview;
  disabled?: boolean;
}

export interface ChoiceVisualLabels {
  play: string;
  stop: string;
  enlarge: string;
}

interface ChoiceVisualProps {
  choice: Choice;
  labels: ChoiceVisualLabels;
  /** Shows the larger version of an image preview. */
  onEnlarge?: (choice: Choice) => void;
  /** Enables playing previews (used in the picker dialog). */
  interactive?: boolean;
}

export const FONT_SAMPLE = 'Aa Bb Cc 123';

const loadedFonts = new Map<string, Promise<string | null>>();

/**
 * Loads a font preview once and resolves to its CSS family name, or null when
 * the browser cannot load it.
 */
export const loadPreviewFont = (url: string): Promise<string | null> => {
  const cached = loadedFonts.get(url);
  if (cached) {
    return cached;
  }

  const FontFaceCtor = (globalThis as any).FontFace;
  let loading: Promise<string | null>;

  if (!FontFaceCtor || typeof document === 'undefined' || !document.fonts) {
    loading = Promise.resolve(null);
  } else {
    const family = `castmill-choice-${loadedFonts.size + 1}`;
    const face = new FontFaceCtor(family, `url(${JSON.stringify(url)})`);
    loading = face.load().then(
      (loaded: FontFace) => {
        document.fonts.add(loaded);
        return family;
      },
      () => null
    );
  }

  loadedFonts.set(url, loading);
  return loading;
};

// Only one audio preview plays at a time.
let stopActiveAudio: (() => void) | null = null;

/**
 * The still image, font sample or media preview of a choice. Previews of unknown
 * types fall back to the thumbnail and label.
 */
export const ChoiceVisual: Component<ChoiceVisualProps> = (props) => {
  const previewType = () => props.choice.preview?.type;
  const [fontFamily, setFontFamily] = createSignal<string | null>(null);
  const [playing, setPlaying] = createSignal(false);
  let video: HTMLVideoElement | undefined;
  let audio: HTMLAudioElement | null = null;

  if (previewType() === 'font') {
    loadPreviewFont(props.choice.preview!.url).then(setFontFamily);
  }

  const playVideo = () => {
    setPlaying(true);
    video?.play()?.catch(() => setPlaying(false));
  };

  const stopVideo = () => {
    video?.pause();
    setPlaying(false);
  };

  const stopAudio = () => {
    audio?.pause();
    setPlaying(false);
    if (stopActiveAudio === stopAudio) {
      stopActiveAudio = null;
    }
  };

  const toggleAudio = () => {
    if (playing()) {
      stopAudio();
      return;
    }
    stopActiveAudio?.();
    audio = audio || new Audio(props.choice.preview!.url);
    audio.onended = stopAudio;
    stopActiveAudio = stopAudio;
    setPlaying(true);
    audio.play()?.catch(() => stopAudio());
  };

  onCleanup(() => {
    stopAudio();
    video?.pause();
  });

  const thumbnail = () => (
    <Show
      when={props.choice.thumbnail_url}
      fallback={
        <span class={styles.placeholder} aria-hidden="true">
          {props.choice.label.slice(0, 1).toUpperCase()}
        </span>
      }
    >
      <img
        class={styles.thumbnail}
        src={props.choice.thumbnail_url}
        alt=""
        loading="lazy"
        draggable={false}
      />
    </Show>
  );

  const mediaButton = (onClick: () => void) => (
    <button
      type="button"
      class={styles.mediaButton}
      aria-label={playing() ? props.labels.stop : props.labels.play}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      {playing() ? <BsStopFill /> : <BsPlayFill />}
    </button>
  );

  return (
    <span
      class={styles.visual}
      onMouseEnter={() =>
        props.interactive && previewType() === 'video' && playVideo()
      }
      onMouseLeave={() =>
        props.interactive && previewType() === 'video' && stopVideo()
      }
    >
      <Show when={previewType() === 'font'} fallback={thumbnail()}>
        <span
          class={styles.fontSample}
          style={
            fontFamily() ? { 'font-family': `"${fontFamily()}"` } : undefined
          }
          data-testid="font-sample"
        >
          {FONT_SAMPLE}
        </span>
      </Show>

      <Show when={props.interactive && previewType() === 'video'}>
        <video
          ref={video}
          class={styles.video}
          classList={{ [styles.hidden]: !playing() }}
          src={props.choice.preview!.url}
          poster={props.choice.thumbnail_url}
          muted
          loop
          playsinline
          preload="none"
          data-testid="video-preview"
        />
        {mediaButton(() => (playing() ? stopVideo() : playVideo()))}
      </Show>

      <Show when={props.interactive && previewType() === 'audio'}>
        {mediaButton(toggleAudio)}
      </Show>

      <Show
        when={props.interactive && previewType() === 'image' && props.onEnlarge}
      >
        <button
          type="button"
          class={styles.mediaButton}
          aria-label={props.labels.enlarge}
          onClick={(e) => {
            e.stopPropagation();
            props.onEnlarge!(props.choice);
          }}
        >
          <BsArrowsFullscreen />
        </button>
      </Show>
    </span>
  );
};
