import { Component, createSignal, Show, createEffect } from 'solid-js';
import { Button, useToast, MediaPicker } from '@castmill/ui-common';
import { JsonMedia } from '@castmill/player';
import { OrganizationsService } from '../../services/organizations.service';
import { store, setStore } from '../../store';
import { useI18n } from '../../i18n';

import './logo-settings.scss';

interface LogoSettingsProps {
  organizationId: string;
  currentLogoMediaId?: number;
  onLogoUpdate: (logoMediaId: number | null) => void;
  disabled?: boolean;
}

export const LogoSettings: Component<LogoSettingsProps> = (props) => {
  const { t } = useI18n();
  const toast = useToast();

  const [showMediaPicker, setShowMediaPicker] = createSignal(false);
  const [selectedMediaId, setSelectedMediaId] = createSignal<number | null>(
    props.currentLogoMediaId || null
  );
  const [logoUrl, setLogoUrl] = createSignal<string | null>(null);

  // Update selected media when prop changes
  createEffect(() => {
    const newMediaId = props.currentLogoMediaId || null;
    setSelectedMediaId(newMediaId);
  });

  // Fetch the logo URL when logo media ID changes
  createEffect(() => {
    const mediaId = selectedMediaId();

    if (mediaId) {
      // Async operation inside effect
      (async () => {
        try {
          const url = `${store.env.baseUrl}/dashboard/organizations/${props.organizationId}/medias/${mediaId}`;
          const response = await fetch(url, {
            method: 'GET',
            credentials: 'include',
          });

          if (response.ok) {
            const payload = await response.json();
            const media = payload?.data;

            if (media?.files) {
              const files = media.files as Record<string, { uri?: string }>;
              const preferredOrder = ['thumbnail', 'main', 'default'];

              const preferredUrl = preferredOrder
                .map((key) => files[key]?.uri)
                .find((uri) => Boolean(uri));

              const fallbackUrl = preferredUrl
                ? preferredUrl
                : Object.values(files)
                    .map((file) => file?.uri)
                    .find(Boolean);

              if (fallbackUrl) {
                setLogoUrl(fallbackUrl);
                return;
              }
            }

            setLogoUrl(null);
          } else {
            console.error(
              'Failed to fetch media for logo preview. Status:',
              response.status
            );
            setLogoUrl(null);
          }
        } catch (error) {
          console.error('Error fetching logo media:', error);
          setLogoUrl(null);
        }
      })();
    } else {
      setLogoUrl(null);
    }
  });

  // Fetch function for MediaPicker
  const fetchMedia = async (
    page: number,
    pageSize: number,
    search?: string
  ): Promise<{
    data: {
      id: number;
      mimetype?: string;
      name: string;
      files?: { [context: string]: { url: string } };
    }[];
    count: number;
  }> => {
    const queryParams = new URLSearchParams({
      page: page.toString(),
      page_size: pageSize.toString(),
      key: 'name',
      direction: 'ascending',
    });

    if (search) {
      queryParams.set('search', search);
    }

    const response = await fetch(
      `${store.env.baseUrl}/dashboard/organizations/${props.organizationId}/medias?${queryParams}`,
      {
        method: 'GET',
        credentials: 'include',
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch medias');
    }

    const result: { data: JsonMedia[]; count: number } = await response.json();

    // Transform JsonMedia to MediaItem format (uri -> url)
    return {
      ...result,
      data: result.data.map((media) => ({
        ...media,
        files: media.files
          ? Object.fromEntries(
              Object.entries(media.files).map(([context, file]) => [
                context,
                { ...file, url: file.uri },
              ])
            )
          : undefined,
      })),
    };
  };

  const handleMediaSelect = async (mediaId: number) => {
    try {
      const updatedOrg = await OrganizationsService.update(
        props.organizationId,
        {
          logo_media_id: mediaId,
        }
      );

      setSelectedMediaId(mediaId);
      props.onLogoUpdate(mediaId);

      // Update store with the returned organization data
      const updatedLogoId = updatedOrg?.data?.logo_media_id ?? mediaId;
      setStore('organizations', 'data', (orgs) =>
        orgs.map((org) =>
          org.id === props.organizationId
            ? { ...org, logo_media_id: updatedLogoId }
            : org
        )
      );

      toast.success(t('organization.logoUpdated'));
      setShowMediaPicker(false);
    } catch (error: any) {
      // Extract validation errors from backend response
      let errorMessage = t('organization.errors.updateOrganization', {
        error: String(error),
      });

      if (error?.data?.errors) {
        const validationErrors = error.data.errors;

        // Handle logo_media_id specific errors
        if (validationErrors.logo_media_id) {
          const logoErrors = Array.isArray(validationErrors.logo_media_id)
            ? validationErrors.logo_media_id.join(', ')
            : validationErrors.logo_media_id;
          errorMessage = `Logo: ${logoErrors}`;
        } else {
          // Format all validation errors
          const errorMessages = Object.entries(validationErrors)
            .map(([field, messages]) => {
              const msgs = Array.isArray(messages)
                ? messages.join(', ')
                : messages;
              return `${field}: ${msgs}`;
            })
            .join('; ');
          errorMessage = errorMessages || errorMessage;
        }
      }

      toast.error(errorMessage);
    }
  };

  const handleRemoveLogo = async () => {
    try {
      const updatedOrg = await OrganizationsService.update(
        props.organizationId,
        {
          logo_media_id: null,
        }
      );

      setSelectedMediaId(null);
      props.onLogoUpdate(null);

      // Update store with the returned organization data
      const updatedLogoId = updatedOrg?.data?.logo_media_id ?? null;
      setStore('organizations', 'data', (orgs) =>
        orgs.map((org) =>
          org.id === props.organizationId
            ? { ...org, logo_media_id: updatedLogoId }
            : org
        )
      );

      setStore('organizations', 'logos', props.organizationId, {
        mediaId: null,
        url: null,
        loading: false,
        error: false,
      });

      toast.success(t('organization.logoRemoved'));
    } catch (error: any) {
      // Extract validation errors from backend response
      let errorMessage = t('organization.errors.updateOrganization', {
        error: String(error),
      });

      if (error?.data?.errors) {
        const validationErrors = error.data.errors;

        // Format all validation errors
        const errorMessages = Object.entries(validationErrors)
          .map(([field, messages]) => {
            const msgs = Array.isArray(messages)
              ? messages.join(', ')
              : messages;
            return `${field}: ${msgs}`;
          })
          .join('; ');
        errorMessage = errorMessages || errorMessage;
      }

      const status = error?.status ?? error?.response?.status;
      if (status === 409) {
        toast.error(t('organization.errors.mediaInUseAsLogo'));
        return;
      }

      toast.error(errorMessage);
    }
  };

  return (
    <div class="logo-settings">
      <h3>{t('organization.logoSettings')}</h3>
      <p class="logo-description">{t('organization.logoDescription')}</p>

      <div class="logo-preview-container">
        <Show
          when={logoUrl()}
          fallback={
            <div class="logo-placeholder">
              <span>{t('organization.noLogo')}</span>
            </div>
          }
        >
          <img src={logoUrl()!} alt="Organization Logo" class="logo-preview" />
        </Show>
      </div>

      <div class="logo-actions">
        <Button
          label={t('organization.selectLogo')}
          onClick={() => setShowMediaPicker(true)}
          color="primary"
          disabled={props.disabled}
        />
        <Show when={selectedMediaId()}>
          <Button
            label={t('organization.removeLogo')}
            onClick={handleRemoveLogo}
            color="secondary"
            disabled={props.disabled}
          />
        </Show>
      </div>

      <MediaPicker
        show={showMediaPicker()}
        onClose={() => setShowMediaPicker(false)}
        onSelect={handleMediaSelect}
        fetchMedia={fetchMedia}
        selectedMediaId={selectedMediaId() || undefined}
        title={t('organization.selectLogo')}
        description={t('organization.selectLogoDescription')}
        searchPlaceholder={t('common.search')}
        loadingText={t('common.loading')}
        noMediaText={t('organization.noMediasAvailable')}
        cancelLabel={t('common.cancel')}
        selectLabel={t('common.save')}
        filterFn={(media) => media.mimetype?.startsWith('image/') ?? false}
        pageSize={30}
      />
    </div>
  );
};
