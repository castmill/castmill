import { Component, Show } from 'solid-js';
import { checkAuth } from './auth';
import { useLocation, useNavigate } from '@solidjs/router';
import { store } from '../store/store';
import { useI18n } from '../i18n';
import { Button } from '@castmill/ui-common';
import styles from './not-found.module.scss';

const NotFound: Component = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();

  if (!checkAuth()) {
    // Construct the redirect URL with the current path
    const destination = location.search
      ? `${location.pathname}${location.search}`
      : location.pathname;
    const redirectUrl = `/login?redirectTo=${encodeURIComponent(destination)}`;

    // Redirect to login page if not authenticated
    navigate(redirectUrl, {
      replace: true,
      state: { from: location.pathname },
    });
  }

  const goToDashboard = () => {
    // If we have an organization, go to its dashboard
    if (store.organizations.selectedId) {
      navigate(`/org/${store.organizations.selectedId}/`);
    } else {
      // Otherwise go to root which will redirect to first org
      navigate('/');
    }
  };

  return (
    <Show
      when={store.loadedAddons}
      fallback={<div style="min-height: 20em;"></div>}
    >
      <div class={styles.notFound}>
        <div class={styles.content}>
          <h1 class={styles.errorCode}>404</h1>
          <h2 class={styles.errorTitle}>{t('common.notFound')}</h2>
          <p class={styles.errorMessage}>{t('common.pageNotFound')}</p>
          <p class={styles.errorPath}>
            {t('common.requestedPath')}: <code>{location.pathname}</code>
          </p>
          <Button
            label={t('common.goToDashboard')}
            onClick={goToDashboard}
            color="primary"
          />
        </div>
      </div>
    </Show>
  );
};

export default NotFound;
