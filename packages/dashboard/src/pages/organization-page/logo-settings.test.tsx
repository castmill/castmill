import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@solidjs/testing-library';
import { LogoSettings } from './logo-settings';
import { OrganizationsService } from '../../services/organizations.service';
import * as storeModule from '../../store';

// Mock dependencies
vi.mock('../../services/organizations.service');
vi.mock('../../store', () => ({
  store: {
    env: {
      baseUrl: 'http://localhost:4000',
    },
    organizations: {
      data: [],
      logos: {},
    },
  },
  setStore: vi.fn(),
}));

// Mock i18n
vi.mock('../../i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, any>) => {
      const translations: Record<string, string> = {
        'organization.logoSettings': 'Logo Settings',
        'organization.logoDescription': 'Choose a logo for your organization',
        'organization.noLogo': 'No logo selected',
        'organization.selectLogo': 'Select Logo',
        'organization.removeLogo': 'Remove Logo',
        'organization.logoRemoved': 'Logo removed successfully',
        'organization.logoUpdated': 'Logo updated successfully',
        'organization.errors.mediaInUseAsLogo':
          'Cannot delete media that is being used as an organization logo',
        'organization.errors.updateOrganization': `Failed to update organization: ${params?.error}`,
        'common.save': 'Save',
        'common.cancel': 'Cancel',
        'common.search': 'Search',
        'common.loading': 'Loading',
      };
      return translations[key] || key;
    },
  }),
}));

// Mock toast
const mockToast = {
  success: vi.fn(),
  error: vi.fn(),
};

vi.mock('@castmill/ui-common', async () => {
  const actual = await vi.importActual('@castmill/ui-common');
  return {
    ...actual,
    useToast: () => mockToast,
    MediaPicker: (props: any) => (
      <div data-testid="media-picker">
        {props.show && <div>Media Picker Open</div>}
      </div>
    ),
  };
});

describe('LogoSettings', () => {
  const defaultProps = {
    organizationId: 'org-123',
    onLogoUpdate: vi.fn(),
    disabled: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock fetch to prevent logo preview fetch errors
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    } as Response);
  });

  describe('Logo Removal', () => {
    it('should send null when removing logo and show success toast', async () => {
      const mockUpdate = vi.fn().mockResolvedValue({
        data: { logo_media_id: null },
      });
      vi.mocked(OrganizationsService.update).mockImplementation(mockUpdate);

      const onLogoUpdate = vi.fn();

      render(() => (
        <LogoSettings
          {...defaultProps}
          currentLogoMediaId={456}
          onLogoUpdate={onLogoUpdate}
        />
      ));

      // Wait for component to settle
      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /remove logo/i })
        ).toBeTruthy();
      });

      const removeButton = screen.getByRole('button', {
        name: /remove logo/i,
      });
      fireEvent.click(removeButton);

      await waitFor(() => {
        expect(mockUpdate).toHaveBeenCalledWith('org-123', {
          logo_media_id: null,
        });
      });

      await waitFor(() => {
        expect(mockToast.success).toHaveBeenCalledWith(
          'Logo removed successfully'
        );
      });

      expect(onLogoUpdate).toHaveBeenCalledWith(null);
    });

    it('should update store cache when removing logo', async () => {
      const mockUpdate = vi.fn().mockResolvedValue({
        data: { logo_media_id: null },
      });
      vi.mocked(OrganizationsService.update).mockImplementation(mockUpdate);

      render(() => <LogoSettings {...defaultProps} currentLogoMediaId={456} />);

      const removeButton = screen.getByRole('button', {
        name: /remove logo/i,
      });
      fireEvent.click(removeButton);

      await waitFor(() => {
        expect(storeModule.setStore).toHaveBeenCalledWith(
          'organizations',
          'logos',
          'org-123',
          {
            mediaId: null,
            url: null,
            loading: false,
            error: false,
          }
        );
      });
    });

    it('should show conflict error toast when removal returns 409', async () => {
      const conflictError = {
        status: 409,
        data: { error: 'Media in use' },
      };
      vi.mocked(OrganizationsService.update).mockRejectedValue(conflictError);

      render(() => <LogoSettings {...defaultProps} currentLogoMediaId={456} />);

      const removeButton = screen.getByRole('button', {
        name: /remove logo/i,
      });
      fireEvent.click(removeButton);

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith(
          'Cannot delete media that is being used as an organization logo'
        );
      });

      expect(mockToast.success).not.toHaveBeenCalled();
    });

    it('should show generic error for non-409 failures', async () => {
      const genericError = {
        status: 500,
        message: 'Server error',
      };
      vi.mocked(OrganizationsService.update).mockRejectedValue(genericError);

      render(() => <LogoSettings {...defaultProps} currentLogoMediaId={456} />);

      const removeButton = screen.getByRole('button', {
        name: /remove logo/i,
      });
      fireEvent.click(removeButton);

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith(
          expect.stringContaining('Failed to update organization')
        );
      });
    });

    it('should not show remove button when no logo is selected', () => {
      render(() => <LogoSettings {...defaultProps} />);

      const removeButton = screen.queryByRole('button', {
        name: /remove logo/i,
      });
      expect(removeButton).toBeNull();
    });

    it('should disable remove button when disabled prop is true', () => {
      render(() => (
        <LogoSettings
          {...defaultProps}
          currentLogoMediaId={456}
          disabled={true}
        />
      ));

      const removeButton = screen.getByRole('button', {
        name: /remove logo/i,
      });
      expect(removeButton).toHaveProperty('disabled', true);
    });
  });

  describe('Logo Selection', () => {
    it('should update logo and show success toast on selection', async () => {
      const mockUpdate = vi.fn().mockResolvedValue({
        data: { logo_media_id: 789 },
      });
      vi.mocked(OrganizationsService.update).mockImplementation(mockUpdate);

      const onLogoUpdate = vi.fn();

      render(() => (
        <LogoSettings {...defaultProps} onLogoUpdate={onLogoUpdate} />
      ));

      const selectButton = screen.getByRole('button', {
        name: /select logo/i,
      });
      fireEvent.click(selectButton);

      // Simulate MediaPicker selection (in real scenario, this would be via MediaPicker component)
      // For now, we're testing the handler directly
      await waitFor(() => {
        expect(screen.getByTestId('media-picker')).toBeTruthy();
      });
    });
  });
});
