import {
  Component,
  createSignal,
  createEffect,
  Show,
  For,
  onMount,
} from 'solid-js';
import {
  Button,
  FormItem,
  useToast,
  Switch,
  Tabs,
  TabItem,
  ToolBar,
  ConfirmDialog,
  Pagination,
  Modal,
  StyledInput,
  ComboBox,
  Dropdown,
} from '@castmill/ui-common';
import {
  NetworkService,
  NetworkSettings,
  NetworkStats,
  Organization,
  NetworkUser,
  NetworkInvitation,
} from '../../services/network.service';
import { store, setStore } from '../../store';
import { useI18n, SUPPORTED_LOCALES } from '../../i18n';
import {
  BsBuilding,
  BsShieldLock,
  BsCheckLg,
  BsPlusLg,
  BsTrash,
  BsSlashCircle,
  BsUnlock,
} from 'solid-icons/bs';
import { IoPersonOutline, IoHardwareChipOutline } from 'solid-icons/io';
import { AiOutlineTeam } from 'solid-icons/ai';
import { FiDatabase } from 'solid-icons/fi';

import styles from './network-page.module.scss';

// Format bytes to human readable string
const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

const NetworkPage: Component = () => {
  const { t } = useI18n();
  const toast = useToast();

  // Loading states
  const [loading, setLoading] = createSignal(true);
  const [saving, setSaving] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  // Data
  const [settings, setSettings] = createSignal<NetworkSettings | null>(null);
  const [stats, setStats] = createSignal<NetworkStats | null>(null);
  const [organizations, setOrganizations] = createSignal<Organization[]>([]);
  const [users, setUsers] = createSignal<NetworkUser[]>([]);
  const [invitations, setInvitations] = createSignal<NetworkInvitation[]>([]);

  // Organizations pagination and search state
  const [orgSearch, setOrgSearch] = createSignal('');
  const [orgPage, setOrgPage] = createSignal(1);
  const [orgPageSize] = createSignal(10);
  const [orgTotalCount, setOrgTotalCount] = createSignal(0);
  const [orgTotalPages, setOrgTotalPages] = createSignal(0);
  const [loadingOrgs, setLoadingOrgs] = createSignal(false);

  // Delete organization state
  const [orgToDelete, setOrgToDelete] = createSignal<Organization | null>(null);
  const [deletingOrg, setDeletingOrg] = createSignal(false);

  // Block organization state
  const [orgToBlock, setOrgToBlock] = createSignal<Organization | null>(null);
  const [orgToUnblock, setOrgToUnblock] = createSignal<Organization | null>(
    null
  );
  const [blockingOrg, setBlockingOrg] = createSignal(false);
  const [blockOrgReason, setBlockOrgReason] = createSignal('');

  // User action state
  const [userToBlock, setUserToBlock] = createSignal<NetworkUser | null>(null);
  const [userToUnblock, setUserToUnblock] = createSignal<NetworkUser | null>(
    null
  );
  const [userToDelete, setUserToDelete] = createSignal<NetworkUser | null>(
    null
  );
  const [blockingUser, setBlockingUser] = createSignal(false);
  const [deletingUser, setDeletingUser] = createSignal(false);
  const [blockUserReason, setBlockUserReason] = createSignal('');

  // Invitation state
  const [invitationToDelete, setInvitationToDelete] =
    createSignal<NetworkInvitation | null>(null);
  const [deletingInvitation, setDeletingInvitation] = createSignal(false);
  const [loadingInvitations, setLoadingInvitations] = createSignal(false);

  // Invite user state
  const [showInviteModal, setShowInviteModal] = createSignal(false);
  const [inviteEmail, setInviteEmail] = createSignal('');
  const [selectedInviteOrg, setSelectedInviteOrg] = createSignal<
    Organization | undefined
  >(undefined);
  const [inviteRole, setInviteRole] = createSignal<'admin' | 'member'>('admin');
  const [inviting, setInviting] = createSignal(false);
  const [inviteError, setInviteError] = createSignal<string | null>(null);

  // Form state for settings
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

  // Form state for new organization
  const [newOrgName, setNewOrgName] = createSignal('');
  const [creatingOrg, setCreatingOrg] = createSignal(false);

  // Track if form has been modified
  const [isModified, setIsModified] = createSignal(false);

  // Validation
  const [emailError, setEmailError] = createSignal<string | null>(null);

  // Email validation helper
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

  // Check if user is network admin
  const isNetworkAdmin = () => store.network?.isAdmin ?? false;

  onMount(async () => {
    await loadNetworkData();
  });

  const loadNetworkData = async () => {
    setLoading(true);
    setError(null);

    try {
      // First check if user is network admin
      if (!isNetworkAdmin()) {
        setError('not_admin');
        setLoading(false);
        return;
      }

      // Load settings, stats, organizations, users and invitations in parallel
      const [settingsData, statsData, orgsData, usersData, invitationsData] =
        await Promise.all([
          NetworkService.getSettings(),
          NetworkService.getStats(),
          NetworkService.listOrganizations({
            page: 1,
            pageSize: orgPageSize(),
          }),
          NetworkService.listUsers(),
          NetworkService.listInvitations(),
        ]);

      setSettings(settingsData);
      setStats(statsData);
      setOrganizations(orgsData.data);
      setOrgTotalCount(orgsData.pagination.total_count);
      setOrgTotalPages(orgsData.pagination.total_pages);
      setOrgPage(orgsData.pagination.page);
      setUsers(usersData);
      setInvitations(invitationsData);

      // Initialize form with current values
      setName(settingsData.name || '');
      setEmail(settingsData.email || '');
      setLogo(settingsData.logo || '');
      setCopyright(settingsData.copyright || '');
      setPrivacyPolicyUrl(settingsData.privacy_policy_url || '');
      setDefaultLocale(settingsData.default_locale || 'en');
      setInvitationOnly(settingsData.invitation_only);
      setInvitationOnlyOrgAdmins(settingsData.invitation_only_org_admins);

      // Initialize social links from meta
      const socialLinks = settingsData.meta?.social_links || {};
      setSocialGithub(socialLinks.github || '');
      setSocialTwitter(socialLinks.twitter || '');
      setSocialLinkedin(socialLinks.linkedin || '');
      setSocialFacebook(socialLinks.facebook || '');
    } catch (err) {
      console.error('Failed to load network data:', err);
      setError(
        err instanceof Error ? err.message : 'Failed to load network data'
      );
    } finally {
      setLoading(false);
    }
  };

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
      invitationOnly() !== current.invitation_only ||
      invitationOnlyOrgAdmins() !== current.invitation_only_org_admins ||
      socialGithub() !== (currentSocialLinks.github || '') ||
      socialTwitter() !== (currentSocialLinks.twitter || '') ||
      socialLinkedin() !== (currentSocialLinks.linkedin || '') ||
      socialFacebook() !== (currentSocialLinks.facebook || '');

    setIsModified(modified);
  });

  const handleSave = async () => {
    // Validate email before saving
    const emailValidationError = validateEmail(email());
    if (emailValidationError) {
      setEmailError(emailValidationError);
      return;
    }
    setEmailError(null);

    setSaving(true);

    try {
      // Build social_links object, only including non-empty values
      const socialLinks: Record<string, string> = {};
      if (socialGithub()) socialLinks.github = socialGithub();
      if (socialTwitter()) socialLinks.twitter = socialTwitter();
      if (socialLinkedin()) socialLinks.linkedin = socialLinkedin();
      if (socialFacebook()) socialLinks.facebook = socialFacebook();

      // Preserve existing meta and update social_links
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

    setName(current.name || '');
    setEmail(current.email || '');
    setEmailError(null);
    setLogo(current.logo || '');
    setCopyright(current.copyright || '');
    setPrivacyPolicyUrl(current.privacy_policy_url || '');
    setInvitationOnly(current.invitation_only);
    setInvitationOnlyOrgAdmins(current.invitation_only_org_admins);

    // Reset social links
    const socialLinks = current.meta?.social_links || {};
    setSocialGithub(socialLinks.github || '');
    setSocialTwitter(socialLinks.twitter || '');
    setSocialLinkedin(socialLinks.linkedin || '');
    setSocialFacebook(socialLinks.facebook || '');

    setIsModified(false);
  };

  const handleCreateOrganization = async () => {
    const orgName = newOrgName().trim();
    if (!orgName) {
      toast.error(t('network.organizations.nameRequired'));
      return;
    }

    setCreatingOrg(true);
    try {
      const newOrg = await NetworkService.createOrganization(orgName);
      setNewOrgName('');
      // Update stats
      const currentStats = stats();
      if (currentStats) {
        setStats({
          ...currentStats,
          organizations_count: currentStats.organizations_count + 1,
        });
      }
      // Reload organizations list to show the new one
      await loadOrganizations();
      toast.success(t('network.organizations.createSuccess'));
    } catch (err) {
      console.error('Failed to create organization:', err);
      toast.error(
        err instanceof Error
          ? err.message
          : t('network.organizations.createError')
      );
    } finally {
      setCreatingOrg(false);
    }
  };

  // Load organizations with search and pagination
  const loadOrganizations = async () => {
    setLoadingOrgs(true);
    try {
      const result = await NetworkService.listOrganizations({
        page: orgPage(),
        pageSize: orgPageSize(),
        search: orgSearch() || undefined,
      });
      setOrganizations(result.data);
      setOrgTotalCount(result.pagination.total_count);
      setOrgTotalPages(result.pagination.total_pages);
    } catch (err) {
      console.error('Failed to load organizations:', err);
      toast.error(t('network.organizations.loadError'));
    } finally {
      setLoadingOrgs(false);
    }
  };

  // Handle search - ToolBar has built-in debouncing
  const handleOrgSearch = (value: string) => {
    setOrgSearch(value);
    setOrgPage(1); // Reset to first page on search
    loadOrganizations();
  };

  // Handle page change
  const handleOrgPageChange = (page: number) => {
    setOrgPage(page);
    loadOrganizations();
  };

  // Handle delete organization
  const handleDeleteOrganization = async () => {
    const org = orgToDelete();
    if (!org) return;

    setDeletingOrg(true);
    try {
      await NetworkService.deleteOrganization(org.id);
      // Update stats
      const currentStats = stats();
      if (currentStats) {
        setStats({
          ...currentStats,
          organizations_count: Math.max(
            0,
            currentStats.organizations_count - 1
          ),
        });
      }
      // Reload organizations list
      await loadOrganizations();
      toast.success(t('network.organizations.deleteSuccess'));
    } catch (err) {
      console.error('Failed to delete organization:', err);
      toast.error(
        err instanceof Error
          ? err.message
          : t('network.organizations.deleteError')
      );
    } finally {
      setDeletingOrg(false);
      setOrgToDelete(null);
    }
  };

  // Handle block organization
  const handleBlockOrganization = async () => {
    const org = orgToBlock();
    if (!org) return;

    setBlockingOrg(true);
    try {
      const result = await NetworkService.blockOrganization(
        org.id,
        blockOrgReason()
      );
      // Update the organization in the list
      setOrganizations((orgs) =>
        orgs.map((o) =>
          o.id === org.id
            ? {
                ...o,
                blocked_at: result.organization.blocked_at,
                blocked_reason: result.organization.blocked_reason,
              }
            : o
        )
      );
      toast.success(t('network.organizations.blockSuccess'));
    } catch (err) {
      console.error('Failed to block organization:', err);
      toast.error(
        err instanceof Error
          ? err.message
          : t('network.organizations.blockError')
      );
    } finally {
      setBlockingOrg(false);
      setOrgToBlock(null);
      setBlockOrgReason('');
    }
  };

  // Handle unblock organization
  const handleUnblockOrganization = async () => {
    const org = orgToUnblock();
    if (!org) return;

    setBlockingOrg(true);
    try {
      const result = await NetworkService.unblockOrganization(org.id);
      // Update the organization in the list
      setOrganizations((orgs) =>
        orgs.map((o) =>
          o.id === org.id
            ? {
                ...o,
                blocked_at: result.organization.blocked_at,
                blocked_reason: result.organization.blocked_reason,
              }
            : o
        )
      );
      toast.success(t('network.organizations.unblockSuccess'));
    } catch (err) {
      console.error('Failed to unblock organization:', err);
      toast.error(
        err instanceof Error
          ? err.message
          : t('network.organizations.unblockError')
      );
    } finally {
      setBlockingOrg(false);
      setOrgToUnblock(null);
    }
  };

  // Handle block user
  const handleBlockUser = async () => {
    const user = userToBlock();
    if (!user) return;

    setBlockingUser(true);
    try {
      const result = await NetworkService.blockUser(user.id, blockUserReason());
      // Update the user in the list
      setUsers((currentUsers) =>
        currentUsers.map((u) =>
          u.id === user.id
            ? {
                ...u,
                blocked_at: result.user.blocked_at,
                blocked_reason: result.user.blocked_reason,
              }
            : u
        )
      );
      toast.success(t('network.users.blockSuccess'));
    } catch (err) {
      console.error('Failed to block user:', err);
      toast.error(
        err instanceof Error ? err.message : t('network.users.blockError')
      );
    } finally {
      setBlockingUser(false);
      setUserToBlock(null);
      setBlockUserReason('');
    }
  };

  // Handle unblock user
  const handleUnblockUser = async () => {
    const user = userToUnblock();
    if (!user) return;

    setBlockingUser(true);
    try {
      const result = await NetworkService.unblockUser(user.id);
      // Update the user in the list
      setUsers((currentUsers) =>
        currentUsers.map((u) =>
          u.id === user.id
            ? {
                ...u,
                blocked_at: result.user.blocked_at,
                blocked_reason: result.user.blocked_reason,
              }
            : u
        )
      );
      toast.success(t('network.users.unblockSuccess'));
    } catch (err) {
      console.error('Failed to unblock user:', err);
      toast.error(
        err instanceof Error ? err.message : t('network.users.unblockError')
      );
    } finally {
      setBlockingUser(false);
      setUserToUnblock(null);
    }
  };

  // Handle delete user
  const handleDeleteUser = async () => {
    const user = userToDelete();
    if (!user) return;

    setDeletingUser(true);
    try {
      await NetworkService.deleteUser(user.id);
      // Update stats
      const currentStats = stats();
      if (currentStats) {
        setStats({
          ...currentStats,
          users_count: Math.max(0, currentStats.users_count - 1),
        });
      }
      // Remove user from list
      setUsers((currentUsers) => currentUsers.filter((u) => u.id !== user.id));
      toast.success(t('network.users.deleteSuccess'));
    } catch (err) {
      console.error('Failed to delete user:', err);
      toast.error(
        err instanceof Error ? err.message : t('network.users.deleteError')
      );
    } finally {
      setDeletingUser(false);
      setUserToDelete(null);
    }
  };

  // Handle invite user to organization
  const handleInviteUser = async () => {
    const org = selectedInviteOrg();
    if (!inviteEmail().trim() || !org) {
      setInviteError(t('network.users.inviteEmailRequired'));
      return;
    }

    if (!isValidEmail(inviteEmail())) {
      setInviteError(t('network.users.inviteEmailInvalid'));
      return;
    }

    setInviting(true);
    setInviteError(null);

    try {
      await NetworkService.inviteUserToOrganization(
        org.id,
        inviteEmail(),
        inviteRole()
      );
      toast.success(t('network.users.inviteSuccess'));
      // Reset form and close modal
      setInviteEmail('');
      setSelectedInviteOrg(undefined);
      setInviteRole('admin');
      setShowInviteModal(false);
    } catch (err) {
      console.error('Failed to invite user:', err);
      const errorMessage =
        err instanceof Error ? err.message : t('network.users.inviteError');
      setInviteError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setInviting(false);
    }
  };

  // Reload invitations
  const reloadInvitations = async () => {
    setLoadingInvitations(true);
    try {
      const data = await NetworkService.listInvitations();
      setInvitations(data);
    } catch (err) {
      console.error('Failed to reload invitations:', err);
      toast.error(t('network.invitations.loadError'));
    } finally {
      setLoadingInvitations(false);
    }
  };

  // Handle delete invitation
  const handleDeleteInvitation = async () => {
    const invitation = invitationToDelete();
    if (!invitation) return;

    setDeletingInvitation(true);

    try {
      await NetworkService.deleteInvitation(invitation.id);
      toast.success(t('network.invitations.deleteSuccess'));
      setInvitationToDelete(null);
      // Reload invitations
      await reloadInvitations();
    } catch (err) {
      console.error('Failed to delete invitation:', err);
      toast.error(
        err instanceof Error
          ? err.message
          : t('network.invitations.deleteError')
      );
    } finally {
      setDeletingInvitation(false);
    }
  };

  // Fetch organizations for the invite combobox
  const fetchOrganizationsForInvite = async (
    page: number,
    pageSize: number,
    searchQuery: string
  ): Promise<{ count: number; data: Organization[] }> => {
    try {
      const result = await NetworkService.listOrganizations({
        page,
        pageSize,
        search: searchQuery,
      });
      return {
        count: result.pagination.total_count,
        data: result.data,
      };
    } catch (error) {
      console.error('Failed to fetch organizations for invite:', error);
      return { count: 0, data: [] };
    }
  };

  // Define tabs for the network page
  const networkTabs: TabItem[] = [
    {
      title: () => t('network.tabs.settings'),
      content: () => renderSettingsTab(),
    },
    {
      title: () => t('network.tabs.organizations'),
      content: () => renderOrganizationsTab(),
    },
    {
      title: () => t('network.tabs.users'),
      content: () => renderUsersTab(),
    },
    {
      title: () => t('network.tabs.invitations'),
      content: () => renderInvitationsTab(),
    },
  ];

  const renderSettingsTab = () => (
    <>
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
              // Clear error on valid input
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
    </>
  );

  const renderOrganizationsTab = () => (
    <div class={styles['organizations-tab']}>
      {/* Create Organization Form */}
      <div class={styles['create-org-form']}>
        <h3>{t('network.organizations.createTitle')}</h3>
        <p>{t('network.organizations.createDescription')}</p>
        <div class={styles['create-org-row']}>
          <FormItem
            label={t('network.organizations.name')}
            id="new-org-name"
            value={newOrgName()}
            placeholder={t('network.organizations.namePlaceholder')}
            onInput={(value) => setNewOrgName(value as string)}
          >
            <></>
          </FormItem>
          <Button
            label={creatingOrg() ? t('common.creating') : t('common.create')}
            onClick={handleCreateOrganization}
            disabled={creatingOrg() || !newOrgName().trim()}
            icon={BsPlusLg}
            color="primary"
          />
        </div>
      </div>

      {/* Organizations List */}
      <div class={styles['org-list']}>
        <ToolBar onSearch={handleOrgSearch} initialSearchText={orgSearch()} />

        <Show when={loadingOrgs()}>
          <div class={styles['loading-overlay']}>{t('common.loading')}</div>
        </Show>

        <Show
          when={organizations().length > 0}
          fallback={
            <div class={styles['empty-list']}>
              {orgSearch()
                ? t('network.organizations.noSearchResults')
                : t('network.organizations.noOrganizations')}
            </div>
          }
        >
          <table class={styles['data-table']}>
            <thead>
              <tr>
                <th>{t('network.organizations.name')}</th>
                <th>{t('common.status')}</th>
                <th>{t('common.created')}</th>
                <th class={styles['actions-column']}>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              <For each={organizations()}>
                {(org) => (
                  <tr class={org.blocked_at ? styles['blocked-row'] : ''}>
                    <td>{org.name}</td>
                    <td>
                      <Show
                        when={org.blocked_at}
                        fallback={
                          <span class={styles['status-active']}>
                            {t('network.status.active')}
                          </span>
                        }
                      >
                        <span
                          class={styles['status-blocked']}
                          title={org.blocked_reason || ''}
                        >
                          {t('network.status.blocked')}
                        </span>
                      </Show>
                    </td>
                    <td>{new Date(org.inserted_at).toLocaleDateString()}</td>
                    <td>
                      <div class={styles['actions-row']}>
                        <Show
                          when={org.blocked_at}
                          fallback={
                            <Button
                              label=""
                              icon={BsSlashCircle}
                              color="warning"
                              onClick={() => setOrgToBlock(org)}
                              title={t('network.organizations.block')}
                            />
                          }
                        >
                          <Button
                            label=""
                            icon={BsUnlock}
                            color="success"
                            onClick={() => setOrgToUnblock(org)}
                            title={t('network.organizations.unblock')}
                          />
                        </Show>
                        <Button
                          label=""
                          icon={BsTrash}
                          color="danger"
                          onClick={() => setOrgToDelete(org)}
                          title={t('common.delete')}
                        />
                      </div>
                    </td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>

          {/* Pagination */}
          <Show when={orgTotalPages() > 1}>
            <div class={styles['pagination-container']}>
              <Pagination
                currentPage={orgPage()}
                totalItems={orgTotalCount()}
                itemsPerPage={orgPageSize()}
                onPageChange={handleOrgPageChange}
              />
              <span class={styles['pagination-info']}>
                {t('network.organizations.showingOf', {
                  showing: organizations().length,
                  total: orgTotalCount(),
                })}
              </span>
            </div>
          </Show>
        </Show>
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmDialog
        show={!!orgToDelete()}
        title={t('network.organizations.deleteTitle')}
        message={t('network.organizations.deleteConfirmation', {
          name: orgToDelete()?.name || '',
        })}
        onConfirm={handleDeleteOrganization}
        onClose={() => setOrgToDelete(null)}
      />

      {/* Block Organization Modal */}
      <Show when={orgToBlock()}>
        <Modal
          title={t('network.organizations.blockTitle')}
          description={t('network.organizations.blockConfirmation', {
            name: orgToBlock()?.name || '',
          })}
          onClose={() => {
            setOrgToBlock(null);
            setBlockOrgReason('');
          }}
        >
          <div class={styles['block-form']}>
            <FormItem
              label={t('network.blockReason')}
              id="block-org-reason"
              value={blockOrgReason()}
              placeholder={t('network.blockReasonPlaceholder')}
              onInput={(value) => setBlockOrgReason(value as string)}
            >
              <></>
            </FormItem>
            <div class={styles['modal-actions']}>
              <Button
                label={
                  blockingOrg()
                    ? t('common.blocking')
                    : t('network.organizations.block')
                }
                onClick={handleBlockOrganization}
                disabled={blockingOrg()}
                color="warning"
              />
              <Button
                label={t('common.cancel')}
                onClick={() => {
                  setOrgToBlock(null);
                  setBlockOrgReason('');
                }}
              />
            </div>
          </div>
        </Modal>
      </Show>

      {/* Unblock Organization Modal */}
      <ConfirmDialog
        show={!!orgToUnblock()}
        title={t('network.organizations.unblockTitle')}
        message={t('network.organizations.unblockConfirmation', {
          name: orgToUnblock()?.name || '',
        })}
        onConfirm={handleUnblockOrganization}
        onClose={() => setOrgToUnblock(null)}
      />
    </div>
  );

  const renderUsersTab = () => (
    <div class={styles['users-tab']}>
      {/* Invite User Section */}
      <div class={styles['invite-section']}>
        <h3>{t('network.users.inviteTitle')}</h3>
        <p>{t('network.users.inviteDescription')}</p>
        <Button
          label={t('network.users.inviteButton')}
          onClick={() => setShowInviteModal(true)}
          icon={BsPlusLg}
          color="primary"
          disabled={organizations().length === 0}
        />
      </div>

      {/* Users List */}
      <div class={styles['users-list']}>
        <h3>{t('network.users.listTitle')}</h3>
        <Show
          when={users().length > 0}
          fallback={
            <div class={styles['empty-list']}>{t('network.users.noUsers')}</div>
          }
        >
          <table class={styles['data-table']}>
            <thead>
              <tr>
                <th>{t('network.users.name')}</th>
                <th>{t('network.users.email')}</th>
                <th>{t('common.status')}</th>
                <th>{t('common.created')}</th>
                <th class={styles['actions-column']}>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              <For each={users()}>
                {(user) => (
                  <tr class={user.blocked_at ? styles['blocked-row'] : ''}>
                    <td>{user.name}</td>
                    <td>{user.email}</td>
                    <td>
                      <Show
                        when={user.blocked_at}
                        fallback={
                          <span class={styles['status-active']}>
                            {t('network.status.active')}
                          </span>
                        }
                      >
                        <span
                          class={styles['status-blocked']}
                          title={user.blocked_reason || ''}
                        >
                          {t('network.status.blocked')}
                        </span>
                      </Show>
                    </td>
                    <td>{new Date(user.inserted_at).toLocaleDateString()}</td>
                    <td>
                      <div class={styles['actions-row']}>
                        <Show
                          when={user.blocked_at}
                          fallback={
                            <Button
                              label=""
                              icon={BsSlashCircle}
                              color="warning"
                              onClick={() => setUserToBlock(user)}
                              title={t('network.users.block')}
                            />
                          }
                        >
                          <Button
                            label=""
                            icon={BsUnlock}
                            color="success"
                            onClick={() => setUserToUnblock(user)}
                            title={t('network.users.unblock')}
                          />
                        </Show>
                        <Button
                          label=""
                          icon={BsTrash}
                          color="danger"
                          onClick={() => setUserToDelete(user)}
                          title={t('common.delete')}
                        />
                      </div>
                    </td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </Show>
      </div>

      {/* Invite Modal */}
      <Show when={showInviteModal()}>
        <Modal
          title={t('network.users.inviteModalTitle')}
          description={t('network.users.inviteDescription')}
          onClose={() => {
            setShowInviteModal(false);
            setInviteEmail('');
            setSelectedInviteOrg(undefined);
            setInviteRole('admin');
            setInviteError(null);
          }}
        >
          <div class={styles['invite-form']}>
            <ComboBox<Organization>
              id="invite-org-selector"
              label={t('network.users.selectOrganization')}
              placeholder={t('network.users.selectOrganizationPlaceholder')}
              value={selectedInviteOrg()}
              fetchItems={fetchOrganizationsForInvite}
              renderItem={(org: Organization) => (
                <div class={styles['org-combobox-item']}>
                  <div class={styles['org-name']}>{org.name}</div>
                </div>
              )}
              onSelect={(org: Organization) => setSelectedInviteOrg(org)}
              clearable={true}
              clearLabel={t('common.clear')}
              onClear={() => setSelectedInviteOrg(undefined)}
            />

            <div style="margin-top: 1em;">
              <FormItem
                label={t('network.users.inviteEmailLabel')}
                id="invite-email"
                value={inviteEmail()}
                placeholder={t('network.users.inviteEmailPlaceholder')}
                type="email"
                onInput={(value) => setInviteEmail(String(value))}
              >
                <></>
              </FormItem>
            </div>

            <div style="margin-top: 1em;">
              <Dropdown
                id="invite-role"
                name="role"
                label={t('network.users.roleLabel')}
                items={[
                  {
                    name: t('network.users.roleAdmin'),
                    value: 'admin',
                  },
                  {
                    name: t('network.users.roleMember'),
                    value: 'member',
                  },
                ]}
                defaultValue={inviteRole()}
                onSelectChange={(value: string | null) => {
                  if (value) {
                    setInviteRole(value as 'admin' | 'member');
                  }
                }}
              />
            </div>

            <Show when={inviteError()}>
              <div class={styles['error-message']}>{inviteError()}</div>
            </Show>

            <div class={styles['modal-actions']}>
              <Button
                label={
                  inviting()
                    ? t('common.sending')
                    : t('network.users.sendInvite')
                }
                onClick={handleInviteUser}
                disabled={
                  inviting() || !inviteEmail().trim() || !selectedInviteOrg()
                }
                color="primary"
              />
              <Button
                label={t('common.cancel')}
                onClick={() => {
                  setShowInviteModal(false);
                  setInviteEmail('');
                  setSelectedInviteOrg(undefined);
                  setInviteRole('admin');
                  setInviteError(null);
                }}
              />
            </div>
          </div>
        </Modal>
      </Show>

      {/* Block User Modal */}
      <Show when={userToBlock()}>
        <Modal
          title={t('network.users.blockTitle')}
          description={t('network.users.blockConfirmation', {
            name: userToBlock()?.name || '',
          })}
          onClose={() => {
            setUserToBlock(null);
            setBlockUserReason('');
          }}
        >
          <div class={styles['block-form']}>
            <FormItem
              label={t('network.blockReason')}
              id="block-user-reason"
              value={blockUserReason()}
              placeholder={t('network.blockReasonPlaceholder')}
              onInput={(value) => setBlockUserReason(value as string)}
            >
              <></>
            </FormItem>
            <div class={styles['modal-actions']}>
              <Button
                label={
                  blockingUser()
                    ? t('common.blocking')
                    : t('network.users.block')
                }
                onClick={handleBlockUser}
                disabled={blockingUser()}
                color="warning"
              />
              <Button
                label={t('common.cancel')}
                onClick={() => {
                  setUserToBlock(null);
                  setBlockUserReason('');
                }}
              />
            </div>
          </div>
        </Modal>
      </Show>

      {/* Unblock User Modal */}
      <ConfirmDialog
        show={!!userToUnblock()}
        title={t('network.users.unblockTitle')}
        message={t('network.users.unblockConfirmation', {
          name: userToUnblock()?.name || '',
        })}
        onConfirm={handleUnblockUser}
        onClose={() => setUserToUnblock(null)}
      />

      {/* Delete User Modal */}
      <ConfirmDialog
        show={!!userToDelete()}
        title={t('network.users.deleteTitle')}
        message={t('network.users.deleteConfirmation', {
          name: userToDelete()?.name || '',
        })}
        onConfirm={handleDeleteUser}
        onClose={() => setUserToDelete(null)}
      />
    </div>
  );

  const renderInvitationsTab = () => (
    <div class={styles['invitations-tab']}>
      <div class={styles['invitations-header']}>
        <h3>{t('network.invitations.title')}</h3>
        <p>{t('network.invitations.description')}</p>
      </div>

      {/* Invitations List */}
      <div class={styles['invitations-list']}>
        <Show
          when={!loadingInvitations()}
          fallback={
            <div class={styles['loading-invitations']}>
              {t('common.loading')}
            </div>
          }
        >
          <Show
            when={invitations().length > 0}
            fallback={
              <div class={styles['empty-list']}>
                {t('network.invitations.noInvitations')}
              </div>
            }
          >
            <table class={styles['data-table']}>
              <thead>
                <tr>
                  <th>{t('common.email')}</th>
                  <th>{t('network.invitations.organizationName')}</th>
                  <th>{t('common.status')}</th>
                  <th>{t('common.created')}</th>
                  <th>{t('network.invitations.expires')}</th>
                  <th class={styles['actions-column']}>
                    {t('common.actions')}
                  </th>
                </tr>
              </thead>
              <tbody>
                <For each={invitations()}>
                  {(invitation) => (
                    <tr>
                      <td>{invitation.email}</td>
                      <td>{invitation.organization_name}</td>
                      <td>
                        <span class={styles['status-pending']}>
                          {invitation.status}
                        </span>
                      </td>
                      <td>
                        {new Date(invitation.inserted_at).toLocaleDateString()}
                      </td>
                      <td>
                        {new Date(invitation.expires_at).toLocaleDateString()}
                      </td>
                      <td>
                        <div class={styles['actions-row']}>
                          <Button
                            label=""
                            icon={BsTrash}
                            color="danger"
                            onClick={() => setInvitationToDelete(invitation)}
                            title={t('common.delete')}
                          />
                        </div>
                      </td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </Show>
        </Show>
      </div>

      {/* Delete Invitation Modal */}
      <ConfirmDialog
        show={!!invitationToDelete()}
        title={t('network.invitations.deleteTitle')}
        message={t('network.invitations.deleteConfirmation', {
          email: invitationToDelete()?.email || '',
        })}
        onConfirm={handleDeleteInvitation}
        onClose={() => setInvitationToDelete(null)}
      />
    </div>
  );

  return (
    <div class={styles['network-page']}>
      {/* Loading State */}
      <Show when={loading()}>
        <div class={styles['loading-container']}>
          <div class={styles['loading-text']}>{t('common.loading')}</div>
        </div>
      </Show>

      {/* Error State */}
      <Show when={!loading() && error() && error() !== 'not_admin'}>
        <div class={styles['error-container']}>
          <div class={styles['error-icon']}>⚠️</div>
          <div class={styles['error-message']}>{error()}</div>
          <div class={styles['error-hint']}>{t('network.errorHint')}</div>
          <Button onClick={loadNetworkData}>{t('common.retry')}</Button>
        </div>
      </Show>

      {/* Not Admin State */}
      <Show when={!loading() && error() === 'not_admin'}>
        <div class={styles['not-admin-container']}>
          <div class={styles['not-admin-icon']}>
            <BsShieldLock />
          </div>
          <div class={styles['not-admin-title']}>
            {t('network.accessDenied')}
          </div>
          <div class={styles['not-admin-message']}>
            {t('network.accessDeniedMessage')}
          </div>
        </div>
      </Show>

      {/* Main Content */}
      <Show when={!loading() && !error() && settings()}>
        {/* Header */}
        <div class={styles['page-header']}>
          <h1>{t('network.title')}</h1>
          <span class={styles['network-badge']}>
            <BsShieldLock />
            {t('network.adminBadge')}
          </span>
        </div>

        {/* Stats Grid */}
        <Show when={stats()}>
          <div class={styles['stats-grid']}>
            <div class={styles['stat-card']}>
              <div class={styles['stat-value']}>
                {stats()!.organizations_count}
              </div>
              <div class={styles['stat-label']}>
                <BsBuilding style={{ 'margin-right': '0.5em' }} />
                {t('network.stats.organizations')}
              </div>
            </div>
            <div class={styles['stat-card']}>
              <div class={styles['stat-value']}>{stats()!.users_count}</div>
              <div class={styles['stat-label']}>
                <IoPersonOutline style={{ 'margin-right': '0.5em' }} />
                {t('network.stats.users')}
              </div>
            </div>
            <div class={styles['stat-card']}>
              <div class={styles['stat-value']}>{stats()!.devices_count}</div>
              <div class={styles['stat-label']}>
                <IoHardwareChipOutline style={{ 'margin-right': '0.5em' }} />
                {t('network.stats.devices')}
              </div>
            </div>
            <div class={styles['stat-card']}>
              <div class={styles['stat-value']}>{stats()!.teams_count}</div>
              <div class={styles['stat-label']}>
                <AiOutlineTeam style={{ 'margin-right': '0.5em' }} />
                {t('network.stats.teams')}
              </div>
            </div>
            <div class={styles['stat-card']}>
              <div class={styles['stat-value']}>
                {formatBytes(stats()!.total_storage_bytes)}
              </div>
              <div class={styles['stat-label']}>
                <FiDatabase style={{ 'margin-right': '0.5em' }} />
                {t('network.stats.storage')}
              </div>
            </div>
          </div>
        </Show>

        {/* Tabs */}
        <Tabs tabs={networkTabs} initialIndex={0} />
      </Show>
    </div>
  );
};

export default NetworkPage;
