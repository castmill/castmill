/**
 * Network Settings page — identity, social links, domain, access control.
 */
import { Component, Show, createSignal, createEffect } from 'solid-js';
import {
  Button,
  FormItem,
  useToast,
  Switch,
  Dropdown,
} from '@castmill/ui-common';
import { NetworkService } from '../../services/network.service';
import { store, setStore } from '../../store';
import { useI18n, SUPPORTED_LOCALES } from '../../i18n';
import { BsCheckLg } from 'solid-icons/bs';
import { useNetworkContext } from './network-context';
import styles from './network.module.scss';

const NetworkSettings: Component = () => {
  const { t } = useI18n();
  const toast = useToast();
  const { settings, setSettings } = useNetworkContext();

  // Form state
  const [saving, setSaving] = createSignal(false);
  const [name, setName] = createSignal('');
  const [email, setEmail] = createSignal('');
  const [logo, setLogo] = createSignal('');
  const [copyright, setCopyright] = createSignal('');
  const [privacyPolicyUrl, setPrivacyPolicyUrl] = createSignal('');
  const [defaultLocale, setDefaultLocale] = createSignal('en');
  const [invitationOnly, setInvitationOnly] = createSignal(false);
  const [invitationOnlyOrgAdmins, setInvitationOnlyOrgAdmins] =
    createSignal(false);

  // Social links state
  const [socialGithub, setSocialGithub] = createSignal('');
  const [socialTwitter, setSocialTwitter] = createSignal('');
  const [socialLinkedin, setSocialLinkedin] = createSignal('');
  const [socialFacebook, setSocialFacebook] = createSignal('');

  // Modification tracking
  const [isModified, setIsModified] = createSignal(false);

  // Validation
  const [emailError, setEmailError] = createSignal<string | null>(null);

  const isValidEmail = (value: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
  };

  const validateEmail = (value: string): string | null => {
    if (!value || value.trim() === '') {
      return t('network.validation.emailRequired');
    }
    if (!isValidEmail(value)) {
      return t('network.validation.emailInvalid');
    }
    return null;
  };

  // Initialize form with current settings
  const initForm = (current: NonNullable<ReturnType<typeof settings>>) => {
    setName(current.name || '');
    setEmail(current.email || '');
    setLogo(current.logo || '');
    setCopyright(current.copyright || '');
    setPrivacyPolicyUrl(current.privacy_policy_url || '');
    setDefaultLocale(current.default_locale || 'en');
    setInvitationOnly(current.invitation_only);
    setInvitationOnlyOrgAdmins(current.invitation_only_org_admins);

    const socialLinks = current.meta?.social_links || {};
    setSocialGithub(socialLinks.github || '');
    setSocialTwitter(socialLinks.twitter || '');
    setSocialLinkedin(socialLinks.linkedin || '');
    setSocialFacebook(socialLinks.facebook || '');
  };

  // Initialize on mount (settings already loaded by context)
  createEffect(() => {
    const current = settings();
    if (current) {
      initForm(current);
    }
  });

  // Track form modifications
  createEffect(() => {
    const current = settings();
    if (!current) return;

    const currentSocialLinks = current.meta?.social_links || {};

    const modified =
      name() !== current.name ||
      email() !== current.email ||
      logo() !== (current.logo || '') ||
      copyright() !== (current.copyright || '') ||
      privacyPolicyUrl() !== (current.privacy_policy_url || '') ||
      defaultLocale() !== (current.default_locale || 'en') ||
      invitationOnly() !== current.invitation_only ||
      invitationOnlyOrgAdmins() !== current.invitation_only_org_admins ||
      socialGithub() !== (currentSocialLinks.github || '') ||
      socialTwitter() !== (currentSocialLinks.twitter || '') ||
      socialLinkedin() !== (currentSocialLinks.linkedin || '') ||
      socialFacebook() !== (currentSocialLinks.facebook || '');

    setIsModified(modified);
  });

  const handleSave = async () => {
    const emailValidationError = validateEmail(email());
    if (emailValidationError) {
      setEmailError(emailValidationError);
      return;
    }
    setEmailError(null);

    setSaving(true);
    try {
      const socialLinks: Record<string, string> = {};
      if (socialGithub()) socialLinks.github = socialGithub();
      if (socialTwitter()) socialLinks.twitter = socialTwitter();
      if (socialLinkedin()) socialLinks.linkedin = socialLinkedin();
      if (socialFacebook()) socialLinks.facebook = socialFacebook();

      const currentMeta = settings()?.meta || {};
      const newMeta = {
        ...currentMeta,
        social_links:
          Object.keys(socialLinks).length > 0 ? socialLinks : undefined,
      };

      const updated = await NetworkService.updateSettings({
        name: name(),
        email: email(),
        logo: logo() || undefined,
        copyright: copyright() || undefined,
        privacy_policy_url: privacyPolicyUrl() || undefined,
        default_locale: defaultLocale(),
        invitation_only: invitationOnly(),
        invitation_only_org_admins: invitationOnlyOrgAdmins(),
        meta: newMeta,
      });

      setSettings(updated);
      setIsModified(false);

      // Update global store so footer/topbar reflects changes immediately
      setStore('networkSettings', {
        ...store.networkSettings,
        logo: updated.logo || '',
        copyright: updated.copyright || '© 2011-2025 Castmill™',
        email: updated.email || 'support@castmill.com',
        defaultLocale: updated.default_locale || 'en',
        socialLinks: updated.meta?.social_links || {},
      });

      toast.success(t('network.saveSuccess'));
    } catch (err) {
      console.error('Failed to save network settings:', err);
      toast.error(err instanceof Error ? err.message : t('network.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    const current = settings();
    if (!current) return;
    initForm(current);
    setEmailError(null);
    setIsModified(false);
  };

  return (
    <div class={styles['network-page']}>
      {/* Header */}
      <div class={styles['page-header']}>
        <h1>{t('network.tabs.settings')}</h1>
      </div>

      {/* Network Identity Section */}
      <div class={styles['section']}>
        <h2>{t('network.identity.title')}</h2>
        <p>{t('network.identity.description')}</p>

        <div class={styles['form-grid']}>
          <FormItem
            label={t('network.identity.name')}
            id="network-name"
            value={name()}
            placeholder={t('network.identity.namePlaceholder')}
            onInput={(value) => setName(value as string)}
          >
            <span class={styles['help-text']}>
              {t('network.identity.nameHelp')}
            </span>
          </FormItem>

          <FormItem
            label={t('network.identity.email')}
            id="network-email"
            value={email()}
            placeholder={t('network.identity.emailPlaceholder')}
            onInput={(value) => {
              const strValue = value as string;
              setEmail(strValue);
              if (emailError() && !validateEmail(strValue)) {
                setEmailError(null);
              }
            }}
          >
            <Show when={emailError()}>
              <div class="error">{emailError()}</div>
            </Show>
            <Show when={!emailError()}>
              <span class={styles['help-text']}>
                {t('network.identity.emailHelp')}
              </span>
            </Show>
          </FormItem>

          <FormItem
            label={t('network.identity.logo')}
            id="network-logo"
            value={logo()}
            placeholder={t('network.identity.logoPlaceholder')}
            onInput={(value) => setLogo(value as string)}
          >
            <span class={styles['help-text']}>
              {t('network.identity.logoHelp')}
            </span>
          </FormItem>

          <FormItem
            label={t('network.identity.copyright')}
            id="network-copyright"
            value={copyright()}
            placeholder={t('network.identity.copyrightPlaceholder')}
            onInput={(value) => setCopyright(value as string)}
          >
            <span class={styles['help-text']}>
              {t('network.identity.copyrightHelp')}
            </span>
          </FormItem>

          <FormItem
            label={t('network.identity.privacyPolicyUrl')}
            id="network-privacy-policy-url"
            value={privacyPolicyUrl()}
            placeholder={t('network.identity.privacyPolicyUrlPlaceholder')}
            onInput={(value) => setPrivacyPolicyUrl(value as string)}
          >
            <span class={styles['help-text']}>
              {t('network.identity.privacyPolicyUrlHelp')}
            </span>
          </FormItem>

          <div class={styles['form-item']}>
            <Dropdown
              id="network-default-locale"
              label={t('network.identity.defaultLanguage')}
              items={SUPPORTED_LOCALES.map((locale) => ({
                value: locale.code,
                name: `${locale.nativeName} (${locale.name})`,
              }))}
              value={defaultLocale()}
              onSelectChange={(value) => setDefaultLocale(value || 'en')}
            />
            <span class={styles['help-text']}>
              {t('network.identity.defaultLanguageHelp')}
            </span>
          </div>
        </div>
      </div>

      {/* Social Links Section */}
      <div class={styles['section']}>
        <h2>{t('network.socialLinks.title')}</h2>
        <p>{t('network.socialLinks.description')}</p>

        <div class={styles['form-grid']}>
          <FormItem
            label={t('network.socialLinks.github')}
            id="network-github"
            value={socialGithub()}
            placeholder={t('network.socialLinks.githubPlaceholder')}
            onInput={(value) => setSocialGithub(value as string)}
          >
            <></>
          </FormItem>

          <FormItem
            label={t('network.socialLinks.twitter')}
            id="network-twitter"
            value={socialTwitter()}
            placeholder={t('network.socialLinks.twitterPlaceholder')}
            onInput={(value) => setSocialTwitter(value as string)}
          >
            <></>
          </FormItem>

          <FormItem
            label={t('network.socialLinks.linkedin')}
            id="network-linkedin"
            value={socialLinkedin()}
            placeholder={t('network.socialLinks.linkedinPlaceholder')}
            onInput={(value) => setSocialLinkedin(value as string)}
          >
            <></>
          </FormItem>

          <FormItem
            label={t('network.socialLinks.facebook')}
            id="network-facebook"
            value={socialFacebook()}
            placeholder={t('network.socialLinks.facebookPlaceholder')}
            onInput={(value) => setSocialFacebook(value as string)}
          >
            <></>
          </FormItem>
        </div>
      </div>

      {/* Domain Section */}
      <div class={styles['section']}>
        <h2>{t('network.domain.title')}</h2>
        <p>{t('network.domain.description')}</p>

        <div class={styles['form-row']}>
          <label>{t('network.domain.label')}</label>
          <div class={styles['domain-display']}>
            <span class={styles['domain-value']}>{settings()!.domain}</span>
            <span class={styles['domain-note']}>
              {t('network.domain.note')}
            </span>
          </div>
        </div>
      </div>

      {/* Access Control Section */}
      <div class={styles['section']}>
        <h2>{t('network.access.title')}</h2>
        <p>{t('network.access.description')}</p>

        <div class={styles['toggle-row']}>
          <div class={styles['toggle-info']}>
            <span class={styles['toggle-label']}>
              {t('network.access.invitationOnly')}
            </span>
            <span class={styles['toggle-description']}>
              {t('network.access.invitationOnlyDescription')}
            </span>
          </div>
          <Switch
            name={t('network.access.invitationOnly')}
            key="invitationOnly"
            isActive={invitationOnly()}
            disabled={false}
            onToggle={() => setInvitationOnly(!invitationOnly())}
          />
        </div>

        <div class={styles['toggle-row']}>
          <div class={styles['toggle-info']}>
            <span class={styles['toggle-label']}>
              {t('network.access.invitationOnlyOrgAdmins')}
            </span>
            <span class={styles['toggle-description']}>
              {t('network.access.invitationOnlyOrgAdminsDescription')}
            </span>
          </div>
          <Switch
            name={t('network.access.invitationOnlyOrgAdmins')}
            key="invitationOnlyOrgAdmins"
            isActive={invitationOnlyOrgAdmins()}
            disabled={false}
            onToggle={() =>
              setInvitationOnlyOrgAdmins(!invitationOnlyOrgAdmins())
            }
          />
        </div>
      </div>

      {/* Actions */}
      <div class={styles['actions']}>
        <Show when={isModified()}>
          <Button
            label={t('common.reset')}
            color="secondary"
            onClick={handleReset}
          />
        </Show>
        <Button
          label={saving() ? t('common.saving') : t('common.save')}
          onClick={handleSave}
          disabled={!isModified() || saving()}
          icon={BsCheckLg}
          color="success"
        />
      </div>
    </div>
  );
};

export default NetworkSettings;
