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
import NotificationBell from '../notification-bell/notification-bell';

import { baseUrl } from '../../env';
import { useI18n } from '../../i18n';
import { store } from '../../store/store';

const Topbar: Component = () => {
  const [triggerLogout, setTriggerLogout] = createSignal(false);
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
        </nav>

        <nav class="right">
          <Show when={checkAuth()}>
            <Search />

            <TopbarLink
              to="/help"
              icon={TbHelpCircle}
              text={t('topbar.help')}
            ></TopbarLink>

            {/* Notification Bell */}
            <NotificationBell />

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
