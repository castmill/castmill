import { Component, Show } from 'solid-js';
import './footer.scss';
import { useI18n } from '../../i18n';
import { store } from '../../store/store';

const Footer: Component = () => {
  const { t } = useI18n();

  // Get copyright from network settings or fall back to translation
  const copyright = () =>
    store.networkSettings.copyright || t('common.copyright');

  // Get support email from network settings
  const supportEmail = () =>
    store.networkSettings.email || 'support@castmill.com';

  // Get social links from network settings - no defaults, networks must configure their own
  const socialLinks = () => {
    const links = store.networkSettings.socialLinks;
    return {
      github: links?.github || '',
      twitter: links?.twitter || '',
      linkedin: links?.linkedin || '',
      facebook: links?.facebook || '',
    };
  };

  return (
    <div class="castmill-footer">
      <div class="footer-links">
        <p>{copyright()}</p>
        <a href="#">{t('common.privacy')}</a>
        <a href="#">{t('common.terms')}</a>
        <a href={`mailto:${supportEmail()}`}>{t('common.contact')}</a>
        <Show when={socialLinks().github}>
          <a
            href={socialLinks().github}
            target="_blank"
            rel="noopener noreferrer"
          >
            Github
          </a>
        </Show>
        <Show when={socialLinks().twitter}>
          <a
            href={socialLinks().twitter}
            target="_blank"
            rel="noopener noreferrer"
          >
            X
          </a>
        </Show>
        <Show when={socialLinks().linkedin}>
          <a
            href={socialLinks().linkedin}
            target="_blank"
            rel="noopener noreferrer"
          >
            LinkedIn
          </a>
        </Show>
        <Show when={socialLinks().facebook}>
          <a
            href={socialLinks().facebook}
            target="_blank"
            rel="noopener noreferrer"
          >
            Facebook
          </a>
        </Show>
      </div>
    </div>
  );
};

export default Footer;
