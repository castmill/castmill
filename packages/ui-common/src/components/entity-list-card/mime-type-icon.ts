import type { Component } from 'solid-js';
import {
  BsCameraVideo,
  BsFileEarmark,
  BsFileEarmarkCode,
  BsFileEarmarkImage,
  BsFileEarmarkMusic,
  BsFileEarmarkPlay,
  BsImage,
  BsMusicNoteBeamed,
} from 'solid-icons/bs';

type IconComponent = Component<any>;

const FILE_ICONS = {
  image: BsFileEarmarkImage,
  video: BsFileEarmarkPlay,
  audio: BsFileEarmarkMusic,
  code: BsFileEarmarkCode,
  other: BsFileEarmark,
};

const KIND_ICONS = {
  ...FILE_ICONS,
  image: BsImage,
  video: BsCameraVideo,
  audio: BsMusicNoteBeamed,
};

/**
 * Icon for a MIME type. `file` (default) returns file-shaped icons for
 * previews/columns; `kind` returns compact photo/video/audio glyphs for
 * inline metadata.
 */
export const mimeTypeIcon = (
  mimeType?: string | null,
  variant: 'file' | 'kind' = 'file'
): IconComponent => {
  const icons = variant === 'kind' ? KIND_ICONS : FILE_ICONS;
  const mime = mimeType || '';
  if (mime.startsWith('image/')) return icons.image;
  if (mime.startsWith('video/')) return icons.video;
  if (mime.startsWith('audio/')) return icons.audio;
  if (/json|javascript|html|text/.test(mime)) return icons.code;
  return icons.other;
};

/** Short type label: "image/svg+xml" → "SVG", "video/x-matroska" → "MATROSKA". */
export const mimeTypeLabel = (mimeType?: string | null) =>
  mimeType?.split('/')[1]?.replace(/^x-/, '').split(/[+;]/)[0].toUpperCase();
