import { Component, Show, createEffect, createSignal } from 'solid-js';
import './topbar.scss';

import { checkAuth, getUser, resetSession } from '../auth';
import { useNavigate } from '@solidjs/router';
import TopbarLink from '../topbar-link/topbar-link';
import Search from '../search/search';

// Find any icon here: https://solid-icons.vercel.app/search/settings
import { FaRegularBell } from 'solid-icons/fa';
import { TbHelpCircle } from 'solid-icons/tb';

import logo from '../../assets/castmill-logo-topbar.png';
import DropdownMenu from '../dropdown-menu/dropdown-menu';
import LanguageSelector from '../language-selector/language-selector';
import { LoadingProgressBar } from '../loading-progress-bar/loading-progress-bar';

import { baseUrl } from '../../env';
import { useI18n } from '../../i18n';
import { store } from '../../store/store';

const Topbar: Component = () => {
  const [triggerLogout, setTriggerLogout] = createSignal(false);
  const [orgLogoUrl, setOrgLogoUrl] = createSignal<string | null>(null);
  const { t } = useI18n();

  const navigate = useNavigate();

  const logout = async () => {
    // Log the user out
    const result = await fetch(`${baseUrl}/sessions`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    if (result.status === 200) {
      // Reset the user's session
      resetSession();
      navigate('/login');
    }
  };

  // Fetch organization logo when selected organization changes
  createEffect(async () => {
    const selectedOrg = store.organizations.data.find(
      (org) => org.id === store.organizations.selectedId
    );
    
    if (selectedOrg?.logo_media_id) {
      try {
        const response = await fetch(
          `${baseUrl}/dashboard/organizations/${selectedOrg.id}/medias/${selectedOrg.logo_media_id}`,
          {
            method: 'GET',
            credentials: 'include',
          }
        );
        
        if (response.ok) {
          const media = await response.json();
          const fileUrl = media.files?.thumbnail?.uri || media.files?.main?.uri;
          if (fileUrl) {
            setOrgLogoUrl(fileUrl);
          } else {
            setOrgLogoUrl(null);
          }
        } else {
          setOrgLogoUrl(null);
        }
      } catch (error) {
        console.error('Error fetching organization logo:', error);
        setOrgLogoUrl(null);
      }
    } else {
      setOrgLogoUrl(null);
    }
  });

  createEffect(async () => {
    if (triggerLogout()) {
      await logout();
    }
  });

  return (
    <>
      <LoadingProgressBar loading={store.loadingAddons} />
      <header class="castmill-header">
        <nav class="main">
          <a href="/">
            <img src={logo} alt="Castmill" />
          </a>
          <Show when={orgLogoUrl()}>
            <div class="org-logo-separator" />
            <div class="org-logo-container">
              <img src={orgLogoUrl()!} alt={store.organizations.selectedName} class="org-logo" />
            </div>
          </Show>
        </nav>

        <nav class="right">
          <Show when={checkAuth()}>
            <Search />

            <TopbarLink
              to="/help"
              icon={TbHelpCircle}
              text={t('topbar.help')}
            ></TopbarLink>

            {/* Implement the Alert icon + Alerts page */}
            <div style="margin: 0 1rem; margin: 0 1rem; display: flex; flex-direction: row; justify-content: center; align-items: center;">
              <FaRegularBell />
            </div>

            <div class="topbar-dropdowns">
              <LanguageSelector />
              <DropdownMenu
                ButtonComponent={() => <div>{getUser().name} </div>}
              >
                <a href="/profile">{t('common.profile')}</a>
                <a href="/settings">{t('common.settings')}</a>
                <button class="logout" onClick={() => setTriggerLogout(true)}>
                  {t('common.logout')}
                </button>
              </DropdownMenu>
            </div>
          </Show>
        </nav>
      </header>
    </>
  );
};

export default Topbar;
