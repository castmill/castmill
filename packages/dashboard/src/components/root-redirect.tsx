import { Component, createEffect, JSX, Show } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import { useNavigate, useSearchParams } from '@solidjs/router';
import { Button } from '@castmill/ui-common';
import { store } from '../store/store';
import { useI18n } from '../i18n';

type Layout = Component<{ children: JSX.Element }>;

interface RootRedirectProps {
  /** Wraps the "no organizations" message, e.g. in the dashboard layout. */
  layout?: Layout;
}

const PlainLayout: Layout = (props) => <>{props.children}</>;

const NoOrganizations: Component = () => {
  const navigate = useNavigate();
  const { t } = useI18n();

  return (
    <div
      data-testid="no-organizations"
      style={{
        display: 'flex',
        'flex-direction': 'column',
        'align-items': 'center',
        'justify-content': 'center',
        flex: '1',
        gap: '1em',
        padding: '2em',
        'text-align': 'center',
      }}
    >
      <h2>{t('dashboard.noOrganizations.title')}</h2>
      <p style={{ 'max-width': '30em', color: 'var(--cm-text-tertiary)' }}>
        {store.network.isAdmin
          ? t('dashboard.noOrganizations.networkAdminDescription')
          : t('dashboard.noOrganizations.description')}
      </p>
      <Show when={store.network.isAdmin}>
        <Button
          label={t('dashboard.noOrganizations.manageOrganizations')}
          onClick={() => navigate('/network/organizations')}
          color="primary"
        />
      </Show>
    </div>
  );
};

const RootRedirect: Component<RootRedirectProps> = (props) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

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
      <Dynamic component={props.layout ?? PlainLayout}>
        <NoOrganizations />
      </Dynamic>
    </Show>
  );
};

export default RootRedirect;
