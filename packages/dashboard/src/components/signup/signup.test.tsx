import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, screen } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';

import SignUp from './signup';

// Mock external dependencies
vi.mock('@solidjs/router', () => ({
  useNavigate: vi.fn(),
  useSearchParams: vi.fn(() => [
    createSignal({
      email: 'test@example.com',
      signup_id: '12345',
      challenge: 'abcde',
    }),
  ]),
}));

vi.mock('../utils', () => ({
  arrayBufferToBase64: vi.fn(),
}));

vi.stubGlobal(
  'fetch',
  vi.fn(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({}),
    })
  )
);

vi.stubGlobal('navigator.credentials.create', vi.fn());

// Utility function to mock passkey support
const mockPasskeySupport = (
  supportsConditional: any,
  supportsUserVerifying: any
) => {
  vi.stubGlobal('PublicKeyCredential', {
    isConditionalMediationAvailable: vi.fn(() =>
      Promise.resolve(supportsConditional)
    ),
    isUserVerifyingPlatformAuthenticatorAvailable: vi.fn(() =>
      Promise.resolve(supportsUserVerifying)
    ),
  });
};

// Skipping as either Vitest or @solidjs/testing-library are too buggy to run this test
describe.skip('SignUp Component', () => {
  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();
  });

  it('renders and checks for passkey support', async () => {
    mockPasskeySupport(true, true); // Mock that the browser supports passkeys
    render(() => <SignUp />);

    // Assertions for initial state
    expect(screen.getByText('Status: Ready')).toBeInTheDocument();
    await screen.findByText('Continue with Passkey'); // Async check for button to appear
  });

  /*
  it("displays warning when passkeys are not supported", async () => {
    mockPasskeySupport(false, false); // Mock that the browser does not support passkeys
    render(SignUp);

    // Assertions for passkey support warning
    await screen.findByText(
      "Your browser does not support Passkeys. Link here with more info..."
    );
  });

  it("handles sign-up process with a passkey", async () => {
    mockPasskeySupport(true, true); // Ensure passkey support
    global.navigator.credentials.create.mockResolvedValue({
      id: "credential-id",
    }); // Mock credential creation
    render(SignUp);

    const button = await screen.findByText("Continue with Passkey");
    await fireEvent.click(button); // Trigger the sign-up process

    // Assertions to ensure fetch was called to send credential to server
    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: expect.any(String),
      })
    );
  });
*/
  // Add more tests as needed...
});
