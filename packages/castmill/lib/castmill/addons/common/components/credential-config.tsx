import {
  Component,
  createSignal,
  createEffect,
  Show,
  For,
  onMount,
} from 'solid-js';
import { Button } from '@castmill/ui-common';
import { AddonStore } from '../interfaces/addon-store';

import './credential-config.scss';

/**
 * OAuth 2.0 configuration from credential_schema.oauth2
 */
interface OAuth2Config {
  authorization_url: string;
  token_url: string;
  scopes?: string[];
  pkce?: boolean;
  client_auth?: 'basic' | 'post';
  refresh_margin_seconds?: number;
}

/**
 * Field definition from credential_schema.fields
 */
interface CredentialField {
  type: 'string' | 'number' | 'boolean';
  label?: string | Record<string, string>;
  description?: string | Record<string, string>;
  required?: boolean;
  sensitive?: boolean;
  secret?: boolean;
  input_type?: 'text' | 'password' | 'url' | 'email';
  default?: any;
  placeholder?: string | Record<string, string>;
}

/**
 * Credential schema structure
 */
export interface CredentialSchema {
  auth_type:
    | 'oauth2'
    | 'oauth2_client_credentials'
    | 'api_key'
    | 'basic'
    | 'custom';
  oauth2?: OAuth2Config;
  fields?: Record<string, CredentialField>;
}

/**
 * Integration definition
 */
export interface WidgetIntegration {
  id: number;
  widget_id: number;
  name: string;
  description?: string;
  integration_type: 'pull' | 'push' | 'both';
  credential_scope: 'organization' | 'widget';
  credential_schema?: CredentialSchema;
  config_schema?: Record<string, any>;
  pull_endpoint?: string;
  pull_interval_seconds?: number;
  pull_config?: Record<string, any>;
  push_webhook_path?: string;
  push_config?: Record<string, any>;
  is_active: boolean;
  /** Credential info if already fetched by parent */
  credential?: CredentialInfo;
  /** Whether network-level credentials are configured (users don't need to enter client_id/secret) */
  has_network_credentials?: boolean;
}

/**
 * Credential info from API
 */
interface CredentialInfo {
  id: string;
  is_valid: boolean;
  validated_at?: string;
  metadata?: Record<string, any>;
}

/**
 * Message type for inline notifications
 */
interface Message {
  text: string;
  type: 'success' | 'error' | 'info';
}

/**
 * Props for the CredentialConfig component
 */
interface CredentialConfigProps {
  /** The addon store containing organization info and i18n */
  store: AddonStore;
  /** The widget integration to configure */
  integration: WidgetIntegration;
  /** Optional widget config ID for widget-scoped credentials */
  widgetConfigId?: string;
  /** The base URL for API calls */
  baseUrl: string;
  /** Callback when credentials change */
  onCredentialsChange?: (valid: boolean) => void;
}

/**
 * Generic credential configuration component.
 *
 * Renders a configuration form based on the integration's credential_schema.
 * Supports OAuth 2.0, API keys, and custom credential types.
 *
 * @example
 * ```tsx
 * <CredentialConfig
 *   store={props.store}
 *   integration={integration}
 *   baseUrl="/api"
 *   onCredentialsChange={(valid) => console.log('Valid:', valid)}
 * />
 * ```
 */
export const CredentialConfig: Component<CredentialConfigProps> = (props) => {
  const [isLoading, setIsLoading] = createSignal(true);
  const [isSaving, setIsSaving] = createSignal(false);
  const [isTesting, setIsTesting] = createSignal(false);
  const [isDisconnecting, setIsDisconnecting] = createSignal(false);
  const [credentialInfo, setCredentialInfo] =
    createSignal<CredentialInfo | null>(null);
  const [formValues, setFormValues] = createSignal<Record<string, string>>({});
  const [formErrors, setFormErrors] = createSignal<Record<string, string>>({});
  const [message, setMessage] = createSignal<Message | null>(null);

  // Get i18n functions from store
  const t = (key: string, params?: Record<string, any>) =>
    props.store.i18n?.t(key, params) || key;

  const locale = () => props.store.i18n?.locale() || 'en';

  /**
   * Show a message and auto-hide after duration
   */
  const showMessage = (
    text: string,
    type: Message['type'],
    duration: number = 5000
  ) => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), duration);
  };

  /**
   * Get localized text from a field definition
   */
  const getLocalizedText = (
    text: string | Record<string, string> | undefined,
    fallback: string = ''
  ): string => {
    if (!text) return fallback;
    if (typeof text === 'string') return text;
    return text[locale()] || text['en'] || fallback;
  };

  /**
   * Get the auth type from the credential schema
   */
  const authType = () =>
    props.integration.credential_schema?.auth_type || 'custom';

  /**
   * Check if this integration uses OAuth
   */
  const isOAuth = () =>
    authType() === 'oauth2' || authType() === 'oauth2_client_credentials';

  /**
   * Get the fields from the credential schema
   */
  const fields = () => props.integration.credential_schema?.fields || {};

  /**
   * Check if credentials are configured and valid
   */
  const isConfigured = () => credentialInfo()?.is_valid === true;

  /**
   * Format the OAuth provider name for display
   */
  const providerName = () => {
    const name = props.integration.name;
    return name.charAt(0).toUpperCase() + name.slice(1);
  };

  /**
   * Fetch current credential status
   */
  const fetchCredentialStatus = async () => {
    setIsLoading(true);
    try {
      const organizationId = props.store.organizations.selectedId;
      const response = await fetch(
        `${props.baseUrl}/dashboard/organizations/${organizationId}/widget-integrations/${props.integration.id}`,
        {
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        }
      );

      if (response.ok) {
        const data = await response.json();
        const integration = data.data;

        if (integration?.credential) {
          setCredentialInfo(integration.credential);
          props.onCredentialsChange?.(integration.credential.is_valid);
        } else {
          setCredentialInfo(null);
          props.onCredentialsChange?.(false);
        }
      }
    } catch (error) {
      console.error('Error fetching credential status:', error);
      setCredentialInfo(null);
      props.onCredentialsChange?.(false);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Check for OAuth callback in URL
   */
  const checkOAuthCallback = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const oauthStatus = urlParams.get('oauth_status');
    const errorMessage = urlParams.get('error_message');
    const integrationId = urlParams.get('integration_id');

    // Only process if this is for our integration
    if (integrationId && integrationId !== String(props.integration.id)) {
      return;
    }

    if (oauthStatus === 'success') {
      showMessage(t('widgets.integrations.credentialsSaved'), 'success');
      cleanUrlParams();
      fetchCredentialStatus();
    } else if (oauthStatus === 'error') {
      showMessage(
        errorMessage ||
          t('widgets.integrations.credentialsSaveFailed', {
            error: 'Unknown error',
          }),
        'error'
      );
      cleanUrlParams();
    }
  };

  /**
   * Remove OAuth-related parameters from URL
   */
  const cleanUrlParams = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete('oauth_status');
    url.searchParams.delete('error_message');
    url.searchParams.delete('integration_id');
    url.searchParams.delete('widget_config_id');
    window.history.replaceState({}, '', url.toString());
  };

  /**
   * Initiate OAuth flow
   */
  const startOAuthFlow = () => {
    const organizationId = props.store.organizations.selectedId;
    const redirectUrl = window.location.href;

    // Build auth URL - use baseUrl to point to the backend server
    const params = new URLSearchParams({
      organization_id: organizationId,
      redirect_url: redirectUrl,
    });

    if (props.widgetConfigId) {
      params.set('widget_config_id', props.widgetConfigId);
    }

    const authUrl = `${props.baseUrl}/auth/widget-integrations/${props.integration.id}/authorize?${params.toString()}`;
    window.location.href = authUrl;
  };

  /**
   * Validate form fields
   */
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    const values = formValues();
    const fieldDefs = fields();

    for (const [key, field] of Object.entries(fieldDefs)) {
      if (field.required && !values[key]) {
        const label = getLocalizedText(field.label, key);
        errors[key] = t('widgets.integrations.fieldRequired', { field: label });
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  /**
   * Save non-OAuth credentials
   */
  const saveCredentials = async () => {
    if (!validateForm()) return;

    setIsSaving(true);
    try {
      const organizationId = props.store.organizations.selectedId;
      const response = await fetch(
        `${props.baseUrl}/dashboard/organizations/${organizationId}/widget-integrations/${props.integration.id}/credentials`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ credentials: formValues() }),
        }
      );

      if (response.ok) {
        showMessage(
          t('widgets.integrations.credentialsSaved'),
          'success',
          3000
        );
        fetchCredentialStatus();
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save credentials');
      }
    } catch (error: any) {
      showMessage(
        t('widgets.integrations.credentialsSaveFailed', {
          error: error.message,
        }),
        'error'
      );
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Test the integration connection
   */
  const testConnection = async () => {
    setIsTesting(true);
    try {
      const organizationId = props.store.organizations.selectedId;
      const response = await fetch(
        `${props.baseUrl}/dashboard/organizations/${organizationId}/widget-integrations/${props.integration.id}/test`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        }
      );

      if (response.ok) {
        showMessage(t('widgets.integrations.testSuccess'), 'success', 3000);
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Test failed');
      }
    } catch (error: any) {
      showMessage(
        t('widgets.integrations.testFailed', { error: error.message }),
        'error'
      );
    } finally {
      setIsTesting(false);
    }
  };

  /**
   * Disconnect / delete credentials
   */
  const disconnect = async () => {
    if (
      !confirm(
        t('widgets.integrations.confirmDisconnect', {
          provider: providerName(),
        })
      )
    ) {
      return;
    }

    setIsDisconnecting(true);
    try {
      const organizationId = props.store.organizations.selectedId;
      const response = await fetch(
        `${props.baseUrl}/dashboard/organizations/${organizationId}/widget-integrations/${props.integration.id}/credentials`,
        {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        }
      );

      if (response.ok) {
        showMessage(
          t('widgets.integrations.disconnected', { provider: providerName() }),
          'success'
        );
        setCredentialInfo(null);
        setFormValues({});
        props.onCredentialsChange?.(false);
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to disconnect');
      }
    } catch (error: any) {
      showMessage(
        t('widgets.integrations.disconnectFailed', { error: error.message }),
        'error'
      );
    } finally {
      setIsDisconnecting(false);
    }
  };

  /**
   * Update a form field value
   */
  const updateField = (key: string, value: string) => {
    setFormValues((prev) => ({ ...prev, [key]: value }));
    // Clear error when user starts typing
    if (formErrors()[key]) {
      setFormErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  /**
   * Format the last validated date
   */
  const formatValidatedDate = () => {
    const info = credentialInfo();
    if (!info?.validated_at) return '';
    const date = new Date(info.validated_at);
    return props.store.i18n?.formatDate(date) || date.toLocaleDateString();
  };

  // Initialize on mount
  onMount(() => {
    checkOAuthCallback();

    // If credential info is already provided by parent, use it
    if (props.integration.credential) {
      setCredentialInfo(props.integration.credential);
      setIsLoading(false);
    } else {
      // Only fetch if not provided
      fetchCredentialStatus();
    }
  });

  // Note: We intentionally do NOT use createEffect to notify parent of credential changes.
  // The parent is notified through the onCredentialsChange callback in fetchCredentialStatus.
  // Using createEffect here would cause an infinite loop.

  return (
    <div class="credential-config">
      {/* Inline message display */}
      <Show when={message()}>
        <div class={`message message-${message()!.type}`}>
          {message()!.text}
          <button class="message-close" onClick={() => setMessage(null)}>
            ×
          </button>
        </div>
      </Show>

      <div class="credential-header">
        <div class="integration-info">
          <h4 class="integration-name">{providerName()}</h4>
          <Show when={props.integration.description}>
            <p class="integration-description">
              {props.integration.description}
            </p>
          </Show>
        </div>
        <div class="credential-status">
          <Show
            when={isConfigured()}
            fallback={
              <span class="status-badge pending">
                {t('widgets.integrations.pending')}
              </span>
            }
          >
            <span class="status-badge valid">
              {t('widgets.integrations.valid')}
            </span>
          </Show>
        </div>
      </div>

      <Show
        when={!isLoading()}
        fallback={<div class="loading">{t('common.loading')}</div>}
      >
        {/* OAuth flow */}
        <Show when={isOAuth()}>
          <div class="oauth-section">
            {/* 
              Show client credential fields (client_id, client_secret) ONLY if:
              - Network credentials are NOT configured (has_network_credentials is false/undefined)
              - There are fields defined in the credential_schema
            */}
            <Show
              when={
                !props.integration.has_network_credentials &&
                Object.keys(fields()).length > 0
              }
            >
              <div class="credential-form oauth-credentials">
                <p class="form-description">
                  {t('widgets.integrations.enterClientCredentials', {
                    provider: providerName(),
                  })}
                </p>
                <For each={Object.entries(fields())}>
                  {([key, field]) => (
                    <div class="form-field">
                      <label for={key}>
                        {getLocalizedText(field.label, key)}
                        {field.required && <span class="required">*</span>}
                      </label>
                      <input
                        id={key}
                        type={
                          field.sensitive || field.secret
                            ? 'password'
                            : field.input_type || 'text'
                        }
                        value={formValues()[key] || ''}
                        placeholder={getLocalizedText(field.placeholder, '')}
                        onInput={(e) => updateField(key, e.currentTarget.value)}
                      />
                      <Show when={field.description}>
                        <span class="field-description">
                          {getLocalizedText(field.description, '')}
                        </span>
                      </Show>
                      <Show when={formErrors()[key]}>
                        <span class="field-error">{formErrors()[key]}</span>
                      </Show>
                    </div>
                  )}
                </For>
                <div class="form-actions">
                  <Button
                    label={
                      isSaving()
                        ? t('common.saving')
                        : t('widgets.integrations.saveCredentials')
                    }
                    onClick={saveCredentials}
                    disabled={isSaving()}
                    color="primary"
                  />
                </div>
              </div>
            </Show>

            {/* Show info when network credentials are configured */}
            <Show
              when={
                props.integration.has_network_credentials && !isConfigured()
              }
            >
              <div class="network-credentials-info">
                <p class="info-text">
                  {t('widgets.integrations.networkCredentialsConfigured', {
                    provider: providerName(),
                  })}
                </p>
              </div>
            </Show>

            {/* OAuth connect/reconnect button */}
            <Show
              when={isConfigured()}
              fallback={
                <div class="oauth-connect">
                  <Show when={!props.integration.has_network_credentials}>
                    <p class="oauth-description">
                      {t('widgets.integrations.afterSavingCredentials', {
                        provider: providerName(),
                      })}
                    </p>
                  </Show>
                  <Button
                    label={t('widgets.integrations.connectWith', {
                      provider: providerName(),
                    })}
                    onClick={startOAuthFlow}
                    color="primary"
                  />
                </div>
              }
            >
              <div class="oauth-connected">
                <div class="connection-info">
                  <span class="connected-label">
                    {t('widgets.integrations.connectedTo', {
                      provider: providerName(),
                    })}
                  </span>
                  <Show when={formatValidatedDate()}>
                    <span class="validated-date">
                      {t('widgets.integrations.lastValidated', {
                        date: formatValidatedDate(),
                      })}
                    </span>
                  </Show>
                </div>
                <div class="oauth-actions">
                  <Button
                    label={t('widgets.integrations.reconnect')}
                    onClick={startOAuthFlow}
                    color="secondary"
                  />
                  <Show when={props.integration.integration_type !== 'push'}>
                    <Button
                      label={t('widgets.integrations.testConnection')}
                      onClick={testConnection}
                      disabled={isTesting()}
                      color="info"
                    />
                  </Show>
                  <Button
                    label={t('widgets.integrations.disconnect')}
                    onClick={disconnect}
                    disabled={isDisconnecting()}
                    color="danger"
                  />
                </div>
              </div>
            </Show>
          </div>
        </Show>

        {/* Non-OAuth credential form */}
        <Show when={!isOAuth() && Object.keys(fields()).length > 0}>
          <div class="credential-form">
            <For each={Object.entries(fields())}>
              {([key, field]) => (
                <div class="form-field">
                  <label for={`field-${key}`}>
                    {getLocalizedText(field.label, key)}
                    <Show when={field.required}>
                      <span class="required">*</span>
                    </Show>
                  </label>
                  <Show when={field.description}>
                    <p class="field-description">
                      {getLocalizedText(field.description)}
                    </p>
                  </Show>
                  <input
                    id={`field-${key}`}
                    type={
                      field.sensitive || field.secret
                        ? 'password'
                        : field.input_type || 'text'
                    }
                    value={formValues()[key] || ''}
                    placeholder={getLocalizedText(field.placeholder)}
                    onInput={(e) => updateField(key, e.currentTarget.value)}
                    class={formErrors()[key] ? 'error' : ''}
                  />
                  <Show when={formErrors()[key]}>
                    <span class="error-message">{formErrors()[key]}</span>
                  </Show>
                </div>
              )}
            </For>

            <div class="form-actions">
              <Button
                label={t('widgets.integrations.saveCredentials')}
                onClick={saveCredentials}
                disabled={isSaving()}
                color="primary"
              />
              <Show when={isConfigured()}>
                <Button
                  label={t('widgets.integrations.testConnection')}
                  onClick={testConnection}
                  disabled={isTesting()}
                  color="info"
                />
              </Show>
            </div>
          </div>
        </Show>

        {/* Integration metadata */}
        <div class="integration-meta">
          <Show when={props.integration.integration_type === 'pull'}>
            <span class="meta-item">
              {t('widgets.integrations.pullMode')} •{' '}
              {t('widgets.integrations.pullInterval', {
                seconds: props.integration.pull_interval_seconds || 60,
              })}
            </span>
          </Show>
          <Show when={props.integration.integration_type === 'push'}>
            <span class="meta-item">{t('widgets.integrations.pushMode')}</span>
          </Show>
          <span class="meta-item scope">
            {props.integration.credential_scope === 'organization'
              ? t('widgets.integrations.scopeOrganization')
              : t('widgets.integrations.scopeWidget')}
          </span>
        </div>
      </Show>
    </div>
  );
};

export default CredentialConfig;
