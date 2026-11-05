import { describe, expect, it } from 'vitest';
import {
  canDownloadNatively,
  isWebosNativeUrl,
  webosNativePath,
} from './native-url';

describe('WebOS resource routing', () => {
  it.each([
    ['https://api.test/medias/123/movie.mp4', true],
    ['https://cdn.test/movie.mp4', true],
    ['https://api.test/devices/123/channel', false],
    ['https://api.test/movie.mp4', false],
    ['https://cdn.test/movie.mp4?token=secret', false],
    ['https://cdn.test/movie.mp4#secret', false],
    ['https://user:password@cdn.test/movie.mp4', false],
    ['https://user@cdn.test/movie.mp4', false],
    ['file:///internal/movie.mp4', false],
    ['blob:movie', false],
    ['ftp://cdn.test/movie.mp4', false],
  ])('routes %s natively: %s', (url, expected) => {
    expect(canDownloadNatively(url, 'https://api.test')).toBe(expected);
  });

  it('uses the current origin by default', () => {
    expect(canDownloadNatively(`${window.location.origin}/devices/123`)).toBe(
      false
    );
  });

  it.each(['', '.mp4', '.webm', '.png'])(
    'recognizes a native file with extension %s',
    (extension) => {
      const name = `${'a'.repeat(64)}${extension}`;
      const url = `http://127.0.0.1:9080/castmill-cache/${name}`;
      expect(isWebosNativeUrl(url)).toBe(true);
      expect(webosNativePath(url)).toBe(
        `file://internal/castmill-cache/${name}`
      );
    }
  );

  it.each([
    'http://127.0.0.1:9080/castmill-cache/../../credentials.txt',
    `http://127.0.0.1:9080/castmill-cache/${'a'.repeat(64)}.mp4?token=secret`,
    `http://evil.test/castmill-cache/${'a'.repeat(64)}.mp4`,
    'blob:video',
    'file://internal/credentials.txt',
  ])('does not recognize arbitrary paths: %s', (url) => {
    expect(isWebosNativeUrl(url)).toBe(false);
    expect(webosNativePath(url)).toBeUndefined();
  });
});
