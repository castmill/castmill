import { render, screen } from '@solidjs/testing-library';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { I18nProvider } from '../../i18n';

const networkSettings = vi.hoisted(() => ({
  copyright: '',
  email: '',
  socialLinks: {},
  privacyPolicyUrl: '',
  termsUrl: '',
}));

vi.mock('../../store/store', () => ({
  store: { networkSettings },
}));

import Footer from './footer';

const renderFooter = () =>
  render(() => (
    <I18nProvider>
      <Footer />
    </I18nProvider>
  ));

describe('Footer', () => {
  beforeEach(() => {
    networkSettings.privacyPolicyUrl = '';
    networkSettings.termsUrl = '';
  });

  it("links to the network's privacy policy and terms", () => {
    networkSettings.privacyPolicyUrl = 'https://example.com/privacy';
    networkSettings.termsUrl = 'https://example.com/terms';

    renderFooter();

    expect(screen.getByText('Privacy').closest('a')).toHaveAttribute(
      'href',
      'https://example.com/privacy'
    );
    expect(screen.getByText('Terms').closest('a')).toHaveAttribute(
      'href',
      'https://example.com/terms'
    );
  });

  it('hides the links a network has not set', () => {
    renderFooter();

    expect(screen.queryByText('Privacy')).not.toBeInTheDocument();
    expect(screen.queryByText('Terms')).not.toBeInTheDocument();
  });
});
