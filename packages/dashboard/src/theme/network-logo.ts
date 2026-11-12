/**
 * Theme-aware selection of the network logo shown in the topbar.
 *
 * Networks may configure two logo URLs:
 * - `logo`: the main logo, designed for dark backgrounds (dark theme).
 * - `logoLight`: an optional variant designed for light backgrounds.
 *
 * Without a network logo the bundled Castmill logos are used. If a network
 * only configured a (dark-background) `logo`, the light theme renders it on a
 * dark backdrop so light-coloured text in the logo stays visible.
 */
import type { Theme } from './theme-context';

export interface NetworkLogoSources {
  logo?: string | null;
  logoLight?: string | null;
}

export interface BundledLogos {
  dark: string;
  light: string;
}

export interface ResolvedLogo {
  src: string;
  /** True when the logo must be rendered on a dark backdrop to be visible. */
  needsDarkBackdrop: boolean;
}

const clean = (value?: string | null): string => (value || '').trim();

export function resolveNetworkLogo(
  theme: Theme,
  sources: NetworkLogoSources,
  bundled: BundledLogos
): ResolvedLogo {
  const logo = clean(sources.logo);
  const logoLight = clean(sources.logoLight);

  if (theme === 'light') {
    if (logoLight) return { src: logoLight, needsDarkBackdrop: false };
    if (logo) return { src: logo, needsDarkBackdrop: true };
    return { src: bundled.light, needsDarkBackdrop: false };
  }

  return { src: logo || bundled.dark, needsDarkBackdrop: false };
}
