import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MediasService } from './medias.service';
import { HttpError } from '@castmill/ui-common';

describe('MediasService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  describe('removeMedia', () => {
    const baseUrl = 'http://localhost:4000';
    const organizationId = 'org-123';
    const mediaId = '456';

    it('should successfully delete media and resolve', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        status: 204,
        ok: true,
      } as Response);

      await expect(
        MediasService.removeMedia(baseUrl, organizationId, mediaId)
      ).resolves.toBeUndefined();

      expect(global.fetch).toHaveBeenCalledWith(
        `${baseUrl}/dashboard/organizations/${organizationId}/medias/${mediaId}`,
        {
          method: 'DELETE',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    });

    it('should throw HttpError with 409 status when media is in use', async () => {
      const conflictResponse = {
        status: 409,
        ok: false,
        statusText: 'Conflict',
        json: vi.fn().mockResolvedValue({
          error:
            'Cannot delete media that is being used as an organization logo',
        }),
      } as unknown as Response;

      vi.mocked(global.fetch).mockResolvedValue(conflictResponse);

      await expect(
        MediasService.removeMedia(baseUrl, organizationId, mediaId)
      ).rejects.toThrow(HttpError);

      await expect(
        MediasService.removeMedia(baseUrl, organizationId, mediaId)
      ).rejects.toMatchObject({
        status: 409,
      });
    });

    it('should throw HttpError for other server errors', async () => {
      const serverErrorResponse = {
        status: 500,
        ok: false,
        statusText: 'Internal Server Error',
        json: vi.fn().mockResolvedValue({
          errors: { detail: 'Database connection failed' },
        }),
      } as unknown as Response;

      vi.mocked(global.fetch).mockResolvedValue(serverErrorResponse);

      await expect(
        MediasService.removeMedia(baseUrl, organizationId, mediaId)
      ).rejects.toThrow(HttpError);

      await expect(
        MediasService.removeMedia(baseUrl, organizationId, mediaId)
      ).rejects.toMatchObject({
        status: 500,
      });
    });

    it('should throw HttpError for 404 not found', async () => {
      const notFoundResponse = {
        status: 404,
        ok: false,
        statusText: 'Not Found',
        json: vi.fn().mockResolvedValue({
          errors: { detail: 'Media not found' },
        }),
      } as unknown as Response;

      vi.mocked(global.fetch).mockResolvedValue(notFoundResponse);

      await expect(
        MediasService.removeMedia(baseUrl, organizationId, mediaId)
      ).rejects.toThrow(HttpError);

      await expect(
        MediasService.removeMedia(baseUrl, organizationId, mediaId)
      ).rejects.toMatchObject({
        status: 404,
      });
    });
  });

  describe('updateMedia', () => {
    const baseUrl = 'http://localhost:4000';
    const organizationId = 'org-123';
    const mediaId = '456';

    it('should successfully update media', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        status: 200,
        ok: true,
      } as Response);

      await expect(
        MediasService.updateMedia(baseUrl, organizationId, mediaId, {
          name: 'Updated Media',
          description: 'New description',
        })
      ).resolves.toBeUndefined();

      expect(global.fetch).toHaveBeenCalledWith(
        `${baseUrl}/dashboard/organizations/${organizationId}/medias/${mediaId}`,
        {
          method: 'PATCH',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            update: {
              name: 'Updated Media',
              description: 'New description',
            },
          }),
        }
      );
    });

    it('should throw HttpError on update failure', async () => {
      const errorResponse = {
        status: 422,
        ok: false,
        statusText: 'Unprocessable Entity',
        json: vi.fn().mockResolvedValue({
          errors: { detail: 'Invalid media data' },
        }),
      } as unknown as Response;

      vi.mocked(global.fetch).mockResolvedValue(errorResponse);

      await expect(
        MediasService.updateMedia(baseUrl, organizationId, mediaId, {
          name: '',
          description: '',
        })
      ).rejects.toThrow(HttpError);
    });
  });
});
