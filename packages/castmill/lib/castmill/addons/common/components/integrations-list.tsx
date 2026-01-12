import { Component, createSignal, For, Show, onMount, batch } from 'solid-js';
import { AddonStore } from '../interfaces/addon-store';
import {
  CredentialConfig,
  WidgetIntegration,
  CredentialSchema,
} from './credential-config';

import './integrations-list.scss';

/**
 * Extended widget integration with credential info for list display
 */
interface WidgetIntegrationWithCredential extends WidgetIntegration {
  credential?: {
    id: string;
    is_valid: boolean;
    validated_at?: string;
    metadata?: Record<string, any>;
  };
}

/**
 * Props for the IntegrationsList component
 */
interface IntegrationsListProps {
  /** The addon store containing organization info and i18n */
  store: AddonStore;
  /** The widget ID to fetch integrations for */
  widgetId: number;
  /** The widget slug (used in API calls) */
  widgetSlug: string;
  /** Optional widget config ID for widget-scoped credentials */
  widgetConfigId?: string;
  /** The base URL for API calls */
  baseUrl: string;
  /** Callback when any integration's credential status changes */
  onIntegrationChange?: (
    integrations: WidgetIntegrationWithCredential[]
  ) => void;
}

/**
 * IntegrationsList component for displaying and managing widget integrations.
 *
 * Shows all integrations for a widget with their connection status
 * and allows configuring credentials for each.
 *
 * @example
 * ```tsx
 * <IntegrationsList
 *   store={props.store}
 *   widgetId={123}
 *   widgetSlug="spotify-now-playing"
 *   baseUrl="/api"
 * />
 * ```
 */
export const IntegrationsList: Component<IntegrationsListProps> = (props) => {
  const [integrations, setIntegrations] = createSignal<
    WidgetIntegrationWithCredential[]
  >([]);
  const [isLoading, setIsLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);
  const [expandedId, setExpandedId] = createSignal<number | null>(null);

  // Track if we've already fetched to prevent duplicate calls
  let hasFetched = false;

  // Get i18n functions from store
  const t = (key: string, params?: Record<string, any>) =>
    props.store.i18n?.t(key, params) || key;

  /**
   * Fetch integrations for the widget
   */
  const fetchIntegrations = async () => {
    // Prevent duplicate fetches
    if (hasFetched) return;
    hasFetched = true;

    setIsLoading(true);
    setError(null);
    try {
      const organizationId = props.store.organizations.selectedId;
      const response = await fetch(
        `${props.baseUrl}/dashboard/organizations/${organizationId}/widgets/${props.widgetSlug}/integrations`,
        {
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch integrations: ${response.status}`);
      }

      const data = await response.json();
      const integrationsData = data.data || [];

      // Fetch credential status for each integration and update in batch
      const integrationsWithCredentials = await Promise.all(
        integrationsData.map(
          async (integration: WidgetIntegrationWithCredential) => {
            try {
              const credResponse = await fetch(
                `${props.baseUrl}/dashboard/organizations/${organizationId}/widget-integrations/${integration.id}`,
                {
                  headers: { 'Content-Type': 'application/json' },
                  credentials: 'include',
                }
              );
              if (credResponse.ok) {
                const credData = await credResponse.json();
                return {
                  ...integration,
                  credential: credData.data?.credential,
                };
              }
            } catch (err) {
              console.error(
                `Error fetching credential for integration ${integration.id}:`,
                err
              );
            }
            return integration;
          }
        )
      );

      // Set all integrations at once to avoid multiple renders
      batch(() => {
        setIntegrations(integrationsWithCredentials);
        setIsLoading(false);
      });

      props.onIntegrationChange?.(integrationsWithCredentials);
    } catch (err: any) {
      console.error('Error fetching integrations:', err);
      batch(() => {
        setError(err.message);
        setIsLoading(false);
      });
    }
  };

  /**
   * Toggle expansion of an integration
   */
  const toggleExpanded = (id: number) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  /**
   * Handle credential change for an integration
   * Uses batch to prevent cascading updates
   */
  const handleCredentialChange = (integrationId: number, valid: boolean) => {
    batch(() => {
      setIntegrations((prev) =>
        prev.map((i) =>
          i.id === integrationId
            ? { ...i, credential: { ...i.credential, is_valid: valid } as any }
            : i
        )
      );
    });
    // Notify parent outside of batch to avoid loops
    const currentIntegrations = integrations();
    props.onIntegrationChange?.(currentIntegrations);
  };

  /**
   * Get status label for an integration
   */
  const getStatusLabel = (
    integration: WidgetIntegrationWithCredential
  ): string => {
    if (integration.credential?.is_valid) {
      return t('widgets.integrations.configured');
    }
    if (integration.credential_schema?.auth_type) {
      return t('widgets.integrations.notConfigured');
    }
    return t('widgets.integrations.notConfigured');
  };

  /**
   * Get status class for an integration
   */
  const getStatusClass = (
    integration: WidgetIntegrationWithCredential
  ): string => {
    if (integration.credential?.is_valid) {
      return 'configured';
    }
    return 'not-configured';
  };

  /**
   * Check if integration requires configuration
   */
  const requiresConfiguration = (
    integration: WidgetIntegrationWithCredential
  ): boolean => {
    const schema = integration.credential_schema;
    if (!schema) return false;

    // Has OAuth config or credential fields
    return (
      !!schema.oauth2 ||
      (!!schema.fields && Object.keys(schema.fields).length > 0)
    );
  };

  // Fetch integrations on mount
  onMount(() => {
    fetchIntegrations();
  });

  return (
    <div class="integrations-list">
      <Show when={isLoading()}>
        <div class="loading">{t('common.loading')}</div>
      </Show>

      <Show when={error()}>
        <div class="error">{error()}</div>
      </Show>

      <Show when={!isLoading() && !error()}>
        <Show
          when={integrations().length > 0}
          fallback={
            <div class="no-integrations">
              {t('widgets.integrations.noIntegrations')}
            </div>
          }
        >
          <div class="integrations">
            <For each={integrations()}>
              {(integration) => (
                <div
                  class={`integration-item ${expandedId() === integration.id ? 'expanded' : ''}`}
                >
                  <div
                    class="integration-header"
                    onClick={() =>
                      requiresConfiguration(integration) &&
                      toggleExpanded(integration.id)
                    }
                  >
                    <div class="integration-info">
                      <span class="integration-name">
                        {integration.name.charAt(0).toUpperCase() +
                          integration.name.slice(1)}
                      </span>
                      <Show when={integration.description}>
                        <span class="integration-description">
                          {integration.description}
                        </span>
                      </Show>
                    </div>
                    <div class="integration-status">
                      <span
                        class={`status-badge ${getStatusClass(integration)}`}
                      >
                        {getStatusLabel(integration)}
                      </span>
                      <Show when={requiresConfiguration(integration)}>
                        <span class="expand-icon">
                          {expandedId() === integration.id ? '▲' : '▼'}
                        </span>
                      </Show>
                    </div>
                  </div>

                  <Show when={expandedId() === integration.id}>
                    <div class="integration-content">
                      <CredentialConfig
                        store={props.store}
                        integration={integration}
                        widgetConfigId={props.widgetConfigId}
                        baseUrl={props.baseUrl}
                        onCredentialsChange={(valid) =>
                          handleCredentialChange(integration.id, valid)
                        }
                      />
                    </div>
                  </Show>
                </div>
              )}
            </For>
          </div>
        </Show>
      </Show>
    </div>
  );
};

export default IntegrationsList;
