import { describe, it, expect } from 'vitest';
import { resolveNetworkLogo } from './network-logo';

const bundled = { dark: 'castmill-dark.png', light: 'castmill-light.png' };

describe('resolveNetworkLogo', () => {
  it('uses the bundled Castmill logos when the network has no logo', () => {
    expect(resolveNetworkLogo('dark', {}, bundled)).toEqual({
      src: 'castmill-dark.png',
      needsDarkBackdrop: false,
    });
    expect(
      resolveNetworkLogo('light', { logo: '', logoLight: null }, bundled)
    ).toEqual({ src: 'castmill-light.png', needsDarkBackdrop: false });
  });

  it('uses the network logo in dark mode', () => {
    expect(
      resolveNetworkLogo(
        'dark',
        { logo: 'net-dark.png', logoLight: 'net-light.png' },
        bundled
      )
    ).toEqual({ src: 'net-dark.png', needsDarkBackdrop: false });
  });

  it('uses the bundled dark logo in dark mode when only a light logo is set', () => {
    expect(
      resolveNetworkLogo('dark', { logoLight: 'net-light.png' }, bundled)
    ).toEqual({ src: 'castmill-dark.png', needsDarkBackdrop: false });
  });

  it('uses the light logo variant in light mode', () => {
    expect(
      resolveNetworkLogo(
        'light',
        { logo: 'net-dark.png', logoLight: 'net-light.png' },
        bundled
      )
    ).toEqual({ src: 'net-light.png', needsDarkBackdrop: false });
  });

  it('puts a dark-only network logo on a dark backdrop in light mode', () => {
    expect(
      resolveNetworkLogo('light', { logo: ' net-dark.png ' }, bundled)
    ).toEqual({ src: 'net-dark.png', needsDarkBackdrop: true });
  });

  it('ignores whitespace-only URLs', () => {
    expect(
      resolveNetworkLogo('light', { logo: '  ', logoLight: '  ' }, bundled)
    ).toEqual({ src: 'castmill-light.png', needsDarkBackdrop: false });
  });
});
