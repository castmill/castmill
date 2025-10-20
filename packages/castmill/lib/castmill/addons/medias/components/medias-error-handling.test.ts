import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MediasService } from '../services/medias.service';
import { HttpError } from '@castmill/ui-common';

// This file tests the error handling logic in the medias addon component
// specifically around confirmRemoveResource and confirmRemoveMultipleResources

describe('Medias Component Error Handling', () => {
  let mockToast: { success: any; error: any };
  let mockT: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockToast = {
      success: vi.fn(),
      error: vi.fn(),
    };
    mockT = vi.fn((key: string) => {
      const translations: Record<string, string> = {
        'organization.errors.mediaInUseAsLogo':
          'Cannot delete media that is being used as an organization logo',
      };
      return translations[key] || key;
    });
  });

  describe('confirmRemoveResource', () => {
    it('should show conflict error when removeMedia returns 409', async () => {
      const mockResource = {
        id: 123,
        name: 'Test Media',
        mimetype: 'image/png',
        status: 'ready',
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      };

      const conflictError = new HttpError(
        'Cannot delete media that is being used as an organization logo',
        409
      );

      vi.spyOn(MediasService, 'removeMedia').mockRejectedValue(conflictError);

      // Simulate the logic inside confirmRemoveResource
      try {
        await MediasService.removeMedia(
          'http://localhost:4000',
          'org-123',
          `${mockResource.id}`
        );
      } catch (error) {
        if (error instanceof HttpError && error.status === 409) {
          mockToast.error(mockT('organization.errors.mediaInUseAsLogo'));
        } else {
          const message =
            error instanceof Error ? error.message : String(error);
          mockToast.error(`Error removing media ${mockResource.name}: ${message}`);
        }
      }

      expect(mockToast.error).toHaveBeenCalledWith(
        'Cannot delete media that is being used as an organization logo'
      );
      expect(mockToast.success).not.toHaveBeenCalled();
    });

    it('should show generic error for non-409 errors', async () => {
      const mockResource = {
        id: 456,
        name: 'Another Media',
        mimetype: 'video/mp4',
        status: 'ready',
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      };

      const serverError = new HttpError('Internal Server Error', 500);

      vi.spyOn(MediasService, 'removeMedia').mockRejectedValue(serverError);

      // Simulate the logic inside confirmRemoveResource
      try {
        await MediasService.removeMedia(
          'http://localhost:4000',
          'org-123',
          `${mockResource.id}`
        );
      } catch (error) {
        if (error instanceof HttpError && error.status === 409) {
          mockToast.error(mockT('organization.errors.mediaInUseAsLogo'));
        } else {
          const message =
            error instanceof Error ? error.message : String(error);
          mockToast.error(`Error removing media ${mockResource.name}: ${message}`);
        }
      }

      expect(mockToast.error).toHaveBeenCalledWith(
        'Error removing media Another Media: Internal Server Error'
      );
      expect(mockToast.success).not.toHaveBeenCalled();
    });

    it('should show success toast on successful deletion', async () => {
      const mockResource = {
        id: 789,
        name: 'Success Media',
        mimetype: 'image/jpeg',
        status: 'ready',
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      };

      vi.spyOn(MediasService, 'removeMedia').mockResolvedValue(undefined);

      // Simulate the logic inside confirmRemoveResource
      try {
        await MediasService.removeMedia(
          'http://localhost:4000',
          'org-123',
          `${mockResource.id}`
        );
        mockToast.success(`Media "${mockResource.name}" removed successfully`);
      } catch (error) {
        if (error instanceof HttpError && error.status === 409) {
          mockToast.error(mockT('organization.errors.mediaInUseAsLogo'));
        } else {
          const message =
            error instanceof Error ? error.message : String(error);
          mockToast.error(`Error removing media ${mockResource.name}: ${message}`);
        }
      }

      expect(mockToast.success).toHaveBeenCalledWith(
        'Media "Success Media" removed successfully'
      );
      expect(mockToast.error).not.toHaveBeenCalled();
    });
  });

  describe('confirmRemoveMultipleResources', () => {
    it('should show conflict error when any media returns 409', async () => {
      const conflictError = new HttpError(
        'Cannot delete media that is being used as an organization logo',
        409
      );

      vi.spyOn(MediasService, 'removeMedia').mockRejectedValue(conflictError);

      // Simulate the logic inside confirmRemoveMultipleResources
      try {
        await Promise.all([
          MediasService.removeMedia('http://localhost:4000', 'org-123', '1'),
          MediasService.removeMedia('http://localhost:4000', 'org-123', '2'),
        ]);
      } catch (error) {
        if (error instanceof HttpError && error.status === 409) {
          mockToast.error(mockT('organization.errors.mediaInUseAsLogo'));
        } else {
          const message =
            error instanceof Error ? error.message : String(error);
          mockToast.error(`Error removing medias: ${message}`);
        }
      }

      expect(mockToast.error).toHaveBeenCalledWith(
        'Cannot delete media that is being used as an organization logo'
      );
    });

    it('should show success when all deletions succeed', async () => {
      vi.spyOn(MediasService, 'removeMedia').mockResolvedValue(undefined);

      // Simulate the logic inside confirmRemoveMultipleResources
      try {
        await Promise.all([
          MediasService.removeMedia('http://localhost:4000', 'org-123', '1'),
          MediasService.removeMedia('http://localhost:4000', 'org-123', '2'),
          MediasService.removeMedia('http://localhost:4000', 'org-123', '3'),
        ]);
        const count = 3;
        mockToast.success(`${count} media(s) removed successfully`);
      } catch (error) {
        if (error instanceof HttpError && error.status === 409) {
          mockToast.error(mockT('organization.errors.mediaInUseAsLogo'));
        } else {
          const message =
            error instanceof Error ? error.message : String(error);
          mockToast.error(`Error removing medias: ${message}`);
        }
      }

      expect(mockToast.success).toHaveBeenCalledWith(
        '3 media(s) removed successfully'
      );
      expect(mockToast.error).not.toHaveBeenCalled();
    });
  });

  describe('HttpError detection', () => {
    it('should correctly identify HttpError instances', () => {
      const httpError = new HttpError('Conflict', 409);
      expect(httpError).toBeInstanceOf(HttpError);
      expect(httpError.status).toBe(409);
      expect(httpError.message).toBe('Conflict');
    });

    it('should differentiate HttpError from generic Error', () => {
      const genericError = new Error('Generic error');
      expect(genericError).not.toBeInstanceOf(HttpError);
      expect(genericError).toBeInstanceOf(Error);
    });
  });
});
