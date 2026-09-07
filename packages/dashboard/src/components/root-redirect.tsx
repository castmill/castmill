import { Component, createEffect, Show } from 'solid-js';
import { useNavigate, useSearchParams } from '@solidjs/router';
import { store } from '../store/store';
import { useI18n } from '../i18n';

const RootRedirect: Component = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useI18n();

  // Wait for the authenticated user's organizations before resolving QR links.
  createEffect(() => {
    if (
      store.organizations.loaded &&
      !store.organizations.loading &&
      store.organizations.data.length > 0
    ) {
      const registrationCode = searchParams.registrationCode;
      const path =
        typeof registrationCode === 'string' && registrationCode
          ? `devices?registrationCode=${encodeURIComponent(registrationCode)}`
          : '';
      navigate(`/org/${store.organizations.data[0].id}/${path}`, {
        replace: true,
      });
    }
  });

  return (
    <Show
      when={store.organizations.loaded && store.organizations.data.length === 0}
      fallback={<div style="min-height: 10em;"></div>}
    >
      <div
        style={{
          display: 'flex',
          'flex-direction': 'column',
          'align-items': 'center',
          'justify-content': 'center',
          flex: '1',
          padding: '2em',
          'text-align': 'center',
        }}
      >
        <h2>{t('dashboard.noOrganizations.title')}</h2>
        <p style={{ 'max-width': '30em', color: '#666' }}>
          {t('dashboard.noOrganizations.description')}
        </p>
      </div>
    </Show>
  );
};

export default RootRedirect;
