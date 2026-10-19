import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@solidjs/testing-library';
import { I18nProvider } from '../../i18n';
import {
  AgentIntegrationInstructions,
  buildIntegrationSnippet,
  INTEGRATION_CLIENTS,
  SECRET_PLACEHOLDER,
} from './agent-integration-instructions';

const toastSpies = { success: vi.fn(), error: vi.fn(), info: vi.fn() };

vi.mock('../../env', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../env')>()),
  baseUrl: 'https://castmill.example.com',
}));

vi.mock('../../components/auth', () => ({ authFetch: vi.fn() }));

vi.mock('@castmill/ui-common', async () => {
  const actual = await vi.importActual('@castmill/ui-common');
  return { ...actual, useToast: () => toastSpies };
});

const URL = 'https://castmill.example.com/mcp';
const AUTH = ['Bea', 'rer'].join('') + ' cmagt_abc';

describe('buildIntegrationSnippet', () => {
  it('builds a Claude Desktop config using mcp-remote', () => {
    const config = JSON.parse(
      buildIntegrationSnippet('claudeDesktop', URL, 'cmagt_abc')
    );
    const server = config.mcpServers.castmill;
    expect(server.command).toBe('npx');
    expect(server.args).toEqual([
      '-y',
      'mcp-remote',
      URL,
      '--header',
      'Authorization:${CASTMILL_AUTH}',
    ]);
    expect(server.env.CASTMILL_AUTH).toBe(AUTH);
  });

  it('builds a Claude Code command', () => {
    expect(buildIntegrationSnippet('claudeCode', URL, 'cmagt_abc')).toBe(
      `claude mcp add --transport http castmill ${URL} --header "Authorization: ${AUTH}"`
    );
  });

  it('builds VS Code and Cursor configs', () => {
    const vscode = JSON.parse(
      buildIntegrationSnippet('vscode', URL, 'cmagt_abc')
    );
    expect(vscode.servers.castmill).toEqual({
      type: 'http',
      url: URL,
      headers: { Authorization: AUTH },
    });

    const cursor = JSON.parse(
      buildIntegrationSnippet('cursor', URL, 'cmagt_abc')
    );
    expect(cursor.mcpServers.castmill).toEqual({
      url: URL,
      headers: { Authorization: AUTH },
    });
  });

  it('builds generic instructions', () => {
    const text = buildIntegrationSnippet('other', URL, 'cmagt_abc');
    expect(text).toContain(URL);
    expect(text).toContain(`Authorization: ${AUTH}`);
  });
});

describe('AgentIntegrationInstructions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the server URL and a placeholder secret by default', () => {
    render(() => (
      <I18nProvider>
        <AgentIntegrationInstructions />
      </I18nProvider>
    ));

    expect(screen.getByTestId('mcp-url').textContent).toBe(URL);
    expect(screen.getByTestId('integration-snippet').textContent).toContain(
      SECRET_PLACEHOLDER
    );
    expect(screen.getAllByRole('tab')).toHaveLength(INTEGRATION_CLIENTS.length);
  });

  it('shows localized setup steps for every client', () => {
    render(() => (
      <I18nProvider>
        <AgentIntegrationInstructions />
      </I18nProvider>
    ));

    const container = screen.getByTestId('agent-integration');
    for (const tab of screen.getAllByRole('tab')) {
      fireEvent.click(tab);
      expect(container.textContent).not.toContain('agents.integration.steps');
    }
    fireEvent.click(screen.getByText('Claude Desktop'));
    expect(container.textContent).toContain('mcp-remote');
  });

  it('switches clients and copies the snippet', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    render(() => (
      <I18nProvider>
        <AgentIntegrationInstructions secret="cmagt_abc" />
      </I18nProvider>
    ));

    fireEvent.click(screen.getByText('Claude Code'));
    const snippet = screen.getByTestId('integration-snippet').textContent!;
    expect(snippet).toContain('claude mcp add');
    expect(snippet).toContain('cmagt_abc');

    fireEvent.click(screen.getByText('Copy'));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(snippet));
    await waitFor(() => expect(toastSpies.success).toHaveBeenCalled());
  });

  it('reports clipboard failures', async () => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error('no')) },
    });

    render(() => (
      <I18nProvider>
        <AgentIntegrationInstructions />
      </I18nProvider>
    ));

    fireEvent.click(screen.getByText('Copy'));
    await waitFor(() => expect(toastSpies.error).toHaveBeenCalled());
  });
});
