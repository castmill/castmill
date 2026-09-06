import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, waitFor } from '@solidjs/testing-library';
import * as QRCode from 'qrcode';
import type { Device } from '../src/classes';
import { RegisterComponent } from '../src/components/register.component';

vi.mock('qrcode', () => ({
  toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,test'),
}));

describe('registration QR code', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('VITE_DASHBOARD_URL', '');
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
  });

  it('links to the current dashboard with the registration code', async () => {
    const { getByAltText } = render(() => (
      <RegisterComponent device={{} as Device} pincode="XUFUG53BKL" />
    ));

    await waitFor(() => {
      expect(QRCode.toDataURL).toHaveBeenCalledWith(
        'https://app.castmill.dev/?registrationCode=XUFUG53BKL',
        expect.any(Object)
      );
      expect(
        getByAltText('QR Code for device registration').getAttribute('src')
      ).toBe('data:image/png;base64,test');
    });
  });

  it.each(['https://signage.example.com', 'https://signage.example.com/'])(
    'supports a configured dashboard URL: %s',
    async (url) => {
      vi.stubEnv('VITE_DASHBOARD_URL', url);
      render(() => (
        <RegisterComponent device={{} as Device} pincode="code&other=value" />
      ));

      await waitFor(() =>
        expect(QRCode.toDataURL).toHaveBeenCalledWith(
          'https://signage.example.com/?registrationCode=code%26other%3Dvalue',
          expect.any(Object)
        )
      );
    }
  );
});
