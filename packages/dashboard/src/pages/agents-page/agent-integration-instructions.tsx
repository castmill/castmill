import { Component, createSignal, For } from 'solid-js';
import { useToast } from '@castmill/ui-common';

import { useI18n } from '../../i18n';
import { getMcpServerUrl } from '../../services/agents.service';

import styles from './agents-page.module.scss';

const AUTH_SCHEME = 'Bearer';
export const SECRET_PLACEHOLDER = '<AGENT_SECRET>';

export type IntegrationClient =
  | 'claudeDesktop'
  | 'claudeCode'
  | 'vscode'
  | 'cursor'
  | 'other';

// Product names are proper nouns and are therefore not translated.
const CLIENT_PRODUCT_NAMES: Partial<Record<IntegrationClient, string>> = {
  claudeDesktop: 'Claude Desktop',
  claudeCode: 'Claude Code',
  vscode: 'VS Code',
  cursor: 'Cursor',
};

// Config file names shown above the snippet; also proper nouns.
const CLIENT_CONFIG_FILES: Partial<Record<IntegrationClient, string>> = {
  claudeDesktop: 'claude_desktop_config.json',
  vscode: '.vscode/mcp.json',
  cursor: '.cursor/mcp.json',
};

export const INTEGRATION_CLIENTS: IntegrationClient[] = [
  'claudeDesktop',
  'claudeCode',
  'vscode',
  'cursor',
  'other',
];

/**
 * Builds the configuration snippet to connect an MCP client to Castmill.
 */
export const buildIntegrationSnippet = (
  client: IntegrationClient,
  url: string,
  secret: string
): string => {
  const authorization = `${AUTH_SCHEME} ${secret}`;

  switch (client) {
    case 'claudeDesktop':
      return JSON.stringify(
        {
          mcpServers: {
            castmill: {
              command: 'npx',
              args: [
                '-y',
                'mcp-remote',
                url,
                '--header',
                'Authorization:${CASTMILL_AUTH}',
              ],
              env: { CASTMILL_AUTH: authorization },
            },
          },
        },
        null,
        2
      );
    case 'claudeCode':
      return `claude mcp add --transport http castmill ${url} --header "Authorization: ${authorization}"`;
    case 'vscode':
      return JSON.stringify(
        {
          servers: {
            castmill: {
              type: 'http',
              url,
              headers: { Authorization: authorization },
            },
          },
        },
        null,
        2
      );
    case 'cursor':
      return JSON.stringify(
        {
          mcpServers: {
            castmill: {
              url,
              headers: { Authorization: authorization },
            },
          },
        },
        null,
        2
      );
    default:
      return `URL: ${url}\nTransport: Streamable HTTP\nHeader: Authorization: ${authorization}`;
  }
};

export const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
};

export const AgentIntegrationInstructions: Component<{ secret?: string }> = (
  props
) => {
  const { t } = useI18n();
  const toast = useToast();
  const [client, setClient] = createSignal<IntegrationClient>('claudeDesktop');

  const url = () => getMcpServerUrl();
  const snippet = () =>
    buildIntegrationSnippet(
      client(),
      url(),
      props.secret || SECRET_PLACEHOLDER
    );

  const copySnippet = async () => {
    if (await copyToClipboard(snippet())) {
      toast.success(t('agents.copied'));
    } else {
      toast.error(t('agents.errors.copyFailed'));
    }
  };

  const clientLabel = (item: IntegrationClient) =>
    CLIENT_PRODUCT_NAMES[item] ?? t('agents.integration.clients.other');

  return (
    <div class={styles.instructions} data-testid="agent-integration">
      <p class={styles.muted}>{t('agents.integration.intro')}</p>

      <section class={styles.section}>
        <h3 class={styles.sectionTitle}>{t('agents.integration.serverUrl')}</h3>
        <div class={styles.urlField}>
          <code data-testid="mcp-url">{url()}</code>
        </div>
      </section>

      <section class={styles.section}>
        <div class={styles.clientTabs} role="tablist">
          <For each={INTEGRATION_CLIENTS}>
            {(item) => (
              <button
                type="button"
                role="tab"
                aria-selected={client() === item}
                class={`${styles.clientTab} ${client() === item ? styles.clientTabActive : ''}`}
                onClick={() => setClient(item)}
              >
                {clientLabel(item)}
              </button>
            )}
          </For>
        </div>
        <p class={styles.muted}>{t(`agents.integration.steps.${client()}`)}</p>
        <div class={styles.snippet}>
          <div class={styles.snippetHeader}>
            <code>{CLIENT_CONFIG_FILES[client()] ?? ''}</code>
            <button
              type="button"
              class={styles.copyButton}
              onClick={copySnippet}
              aria-label={t('agents.copy')}
            >
              {t('agents.copy')}
            </button>
          </div>
          <pre data-testid="integration-snippet">{snippet()}</pre>
        </div>
      </section>

      <p class={styles.securityNote}>{t('agents.integration.securityNote')}</p>
    </div>
  );
};
