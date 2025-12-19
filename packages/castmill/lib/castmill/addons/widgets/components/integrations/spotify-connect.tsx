import { Component, createSignal, onMount, Show, createEffect } from 'solid-js';
import { Button, useToast } from '@castmill/ui-common';
import { BsSpotify } from 'solid-icons/bs';
import { AddonStore } from '../../../common/interfaces/addon-store';

import './spotify-connect.scss';

/**
 * Props for the SpotifyConnect component
 */
interface SpotifyConnectProps {
  /** The addon store containing organization info and i18n */
  store: AddonStore;
  /** The widget configuration ID to associate with the OAuth flow */
  widgetConfigId: string;
  /** The base URL for API calls */
  baseUrl: string;
  /** Callback when connection status changes */
  onConnectionChange?: (connected: boolean) => void;
}

/**
 * Integration status from the API
 */
interface IntegrationCredential {
  id: string;
  is_valid: boolean;
  validated_at: string;
  metadata?: {
    scope?: string;
    connected_at?: string;
  };
}

/**
 * SpotifyConnect component for initiating and managing Spotify OAuth connection.
 *
 * This component:
 * - Shows connection status (connected/disconnected)
 * - Initiates OAuth flow when clicking "Connect to Spotify"
 * - Handles OAuth callback parameters from URL
 * - Allows disconnecting (removing credentials)
 *
 * @example
 * ```tsx
 * <SpotifyConnect
 *   store={props.store}
 *   widgetConfigId="widget-123"
 *   baseUrl="/dashboard"
 *   onConnectionChange={(connected) => console.log('Connected:', connected)}
 * />
 * ```
 */
export const SpotifyConnect: Component<SpotifyConnectProps> = (props) => {
  const toast = useToast();

  const [isConnected, setIsConnected] = createSignal(false);
  const [isLoading, setIsLoading] = createSignal(true);
  const [connectionInfo, setConnectionInfo] =
    createSignal<IntegrationCredential | null>(null);

  // Get i18n functions from store
  const t = (key: string, params?: Record<string, any>) =>
    props.store.i18n?.t(key, params) || key;

  /**
   * Check for OAuth callback result in URL parameters
   */
  const checkOAuthCallback = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const spotifyAuth = urlParams.get('spotify_auth');
    const errorMessage = urlParams.get('error_message');

    if (spotifyAuth === 'success') {
      toast?.show({
        message: t('widgets.spotify.connectionSuccess'),
        type: 'success',
        duration: 5000,
      });
      // Clean up URL parameters
      cleanUrlParams();
      // Refresh connection status
      checkConnectionStatus();
    } else if (spotifyAuth === 'error') {
      toast?.show({
        message: errorMessage || t('widgets.spotify.connectionFailed'),
        type: 'error',
        duration: 5000,
      });
      cleanUrlParams();
    }
  };

  /**
   * Remove OAuth-related parameters from URL
   */
  const cleanUrlParams = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete('spotify_auth');
    url.searchParams.delete('error_message');
    url.searchParams.delete('widget_config_id');
    window.history.replaceState({}, '', url.toString());
  };

  /**
   * Check if the organization has valid Spotify credentials
   */
  const checkConnectionStatus = async () => {
    setIsLoading(true);
    try {
      const organizationId = props.store.organizations.selectedId;

      // Fetch Spotify integration for the organization
      const response = await fetch(
        `${props.baseUrl}/organizations/${organizationId}/widgets/spotify-now-playing/integrations`,
        {
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
        }
      );

      if (!response.ok) {
        throw new Error(
          `Failed to fetch integration status: ${response.status}`
        );
      }

      const data = await response.json();
      const integrations = data.data || [];

      // Find the Spotify integration
      const spotifyIntegration = integrations.find(
        (i: any) => i.name === 'spotify'
      );

      if (spotifyIntegration) {
        // Check if we have valid credentials for this organization
        const credResponse = await fetch(
          `${props.baseUrl}/organizations/${organizationId}/widget-integrations/${spotifyIntegration.id}`,
          {
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
          }
        );

        if (credResponse.ok) {
          const credData = await credResponse.json();
          const integration = credData.data;

          // Check if credentials are valid
          // The integration may include credential info in the response
          if (integration?.credential?.is_valid) {
            setIsConnected(true);
            setConnectionInfo(integration.credential);
            props.onConnectionChange?.(true);
          } else {
            setIsConnected(false);
            setConnectionInfo(null);
            props.onConnectionChange?.(false);
          }
        }
      }
    } catch (error) {
      console.error('Error checking Spotify connection status:', error);
      setIsConnected(false);
      setConnectionInfo(null);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Initiate Spotify OAuth flow
   */
  const connectToSpotify = () => {
    const organizationId = props.store.organizations.selectedId;
    const redirectUrl = window.location.href;

    // Redirect to OAuth endpoint
    const authUrl =
      `/auth/spotify/authorize?` +
      new URLSearchParams({
        widget_config_id: props.widgetConfigId,
        organization_id: organizationId,
        redirect_url: redirectUrl,
      }).toString();

    window.location.href = authUrl;
  };

  /**
   * Disconnect Spotify (placeholder - would need API support)
   */
  const disconnectSpotify = async () => {
    // Note: This would require an API endpoint to delete credentials
    // For now, just show a message
    toast?.show({
      message: t('widgets.spotify.disconnectNotSupported'),
      type: 'info',
      duration: 3000,
    });
  };

  /**
   * Format the connected date for display
   */
  const formatConnectedDate = () => {
    const info = connectionInfo();
    if (!info?.metadata?.connected_at) return '';

    const date = new Date(info.metadata.connected_at);
    return props.store.i18n?.formatDate(date) || date.toLocaleDateString();
  };

  // Check OAuth callback and connection status on mount
  onMount(() => {
    checkOAuthCallback();
    checkConnectionStatus();
  });

  // Notify parent when connection status changes
  createEffect(() => {
    const connected = isConnected();
    props.onConnectionChange?.(connected);
  });

  return (
    <div class="spotify-connect">
      <div class="spotify-header">
        <BsSpotify size={24} class="spotify-icon" />
        <h3 class="spotify-title">{t('widgets.spotify.title')}</h3>
      </div>

      <Show
        when={!isLoading()}
        fallback={<div class="spotify-loading">{t('common.loading')}</div>}
      >
        <Show
          when={isConnected()}
          fallback={
            <div class="spotify-disconnected">
              <p class="spotify-description">
                {t('widgets.spotify.connectDescription')}
              </p>
              <Button
                label={t('widgets.spotify.connectButton')}
                onClick={connectToSpotify}
                class="spotify-connect-button"
              />
            </div>
          }
        >
          <div class="spotify-connected">
            <div class="spotify-status">
              <span class="status-badge connected">
                {t('widgets.spotify.connected')}
              </span>
              <Show when={formatConnectedDate()}>
                <span class="connected-date">
                  {t('widgets.spotify.connectedSince', {
                    date: formatConnectedDate(),
                  })}
                </span>
              </Show>
            </div>
            <Button
              label={t('widgets.spotify.disconnectButton')}
              onClick={disconnectSpotify}
              class="spotify-disconnect-button"
            />
          </div>
        </Show>
      </Show>
    </div>
  );
};

export default SpotifyConnect;
