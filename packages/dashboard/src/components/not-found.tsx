import { Component, Show } from 'solid-js';
import { checkAuth } from './auth';
import { useLocation, useNavigate } from '@solidjs/router';
import { store, setStore } from '../store/store';
import { useI18n } from '../i18n';

const NotFound: Component = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();

  if (!checkAuth()) {
    // Construct the redirect URL with the current path
    const redirectUrl = `/login?redirectTo=${encodeURIComponent(location.pathname)}`;

    // Redirect to login page if not authenticated
    navigate(redirectUrl, {
      replace: true,
      state: { from: location.pathname },
    });
  } else {
    // Wait for the addons to load
  }

  return (
    <Show when={!store.loadingAddons} fallback={<div>{t('common.loadingAddons')}</div>}>
      <div>
        <h1>{t('common.notFound')}</h1>
        <h2>{t('common.pageNotFound')}</h2>
      </div>
    </Show>
  );
};

export default NotFound;
