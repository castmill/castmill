import { Component, createSignal, Show, For, createEffect } from 'solid-js';
import { Button, Modal, ModalRef, useToast } from '@castmill/ui-common';
import { JsonMedia } from '@castmill/player';
import { OrganizationsService } from '../../services/organizations.service';
import { store, setStore } from '../../store';
import { useI18n } from '../../i18n';

import './logo-settings.scss';

interface LogoSettingsProps {
  organizationId: string;
  currentLogoMediaId?: string;
  onLogoUpdate: (logoMediaId: string | null) => void;
  disabled?: boolean;
}

export const LogoSettings: Component<LogoSettingsProps> = (props) => {
  const { t } = useI18n();
  const toast = useToast();

  let modalRef: ModalRef | undefined;

  const [medias, setMedias] = createSignal<JsonMedia[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [selectedMediaId, setSelectedMediaId] = createSignal<string | null>(
    props.currentLogoMediaId || null
  );
  const [logoUrl, setLogoUrl] = createSignal<string | null>(null);

  // Update selected media when prop changes
  createEffect(() => {
    setSelectedMediaId(props.currentLogoMediaId || null);
  });

  // Fetch the logo URL when logo media ID changes
  createEffect(async () => {
    const mediaId = selectedMediaId();
    if (mediaId) {
      try {
        const response = await fetch(
          `${store.env.baseUrl}/dashboard/organizations/${props.organizationId}/medias/${mediaId}`,
          {
            method: 'GET',
            credentials: 'include',
          }
        );

        if (response.ok) {
          const media = await response.json();
          // Get the thumbnail or main file URL
          const fileUrl = media.files?.thumbnail?.uri || media.files?.main?.uri;
          if (fileUrl) {
            setLogoUrl(fileUrl);
          }
        }
      } catch (error) {
        console.error('Error fetching logo media:', error);
      }
    } else {
      setLogoUrl(null);
    }
  });

  const loadMedias = async () => {
    setLoading(true);
    try {
      // Fetch image medias using the API
      const queryParams = new URLSearchParams({
        page: '1',
        page_size: '50',
        key: 'name',
        direction: 'ascending',
      });

      const response = await fetch(
        `${store.env.baseUrl}/dashboard/organizations/${props.organizationId}/medias?${queryParams}`,
        {
          method: 'GET',
          credentials: 'include',
        }
      );

      if (response.ok) {
        const result = await response.json();
        // Filter for image types only
        const imageMedias = (result.data || []).filter((media: JsonMedia) =>
          media.mimetype?.startsWith('image/')
        );
        setMedias(imageMedias);
      } else {
        toast.error(t('organization.errors.loadMedias'));
      }
    } catch (error) {
      toast.error(t('organization.errors.loadMedias'));
      console.error('Error loading medias:', error);
    } finally {
      setLoading(false);
    }
  };

  const openMediaSelector = async () => {
    await loadMedias();
    modalRef?.open();
  };

  const handleSelectMedia = async () => {
    try {
      const mediaId = selectedMediaId();
      await OrganizationsService.update(props.organizationId, {
        logo_media_id: mediaId || undefined,
      });

      props.onLogoUpdate(mediaId);

      // Update store
      setStore('organizations', 'data', (orgs) =>
        orgs.map((org) =>
          org.id === props.organizationId
            ? { ...org, logo_media_id: mediaId || undefined }
            : org
        )
      );

      toast.success(t('organization.logoUpdated'));
      modalRef?.close();
    } catch (error) {
      toast.error(
        t('organization.errors.updateOrganization', { error: String(error) })
      );
    }
  };

  const handleRemoveLogo = async () => {
    try {
      await OrganizationsService.update(props.organizationId, {
        logo_media_id: undefined,
      });

      setSelectedMediaId(null);
      props.onLogoUpdate(null);

      // Update store
      setStore('organizations', 'data', (orgs) =>
        orgs.map((org) =>
          org.id === props.organizationId
            ? { ...org, logo_media_id: undefined }
            : org
        )
      );

      toast.success(t('organization.logoRemoved'));
    } catch (error) {
      toast.error(
        t('organization.errors.updateOrganization', { error: String(error) })
      );
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
          onClick={openMediaSelector}
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

      <Modal
        ref={(ref) => (modalRef = ref)}
        title={t('organization.selectLogo')}
        size="large"
      >
        <div class="media-selector">
          <Show when={loading()}>
            <div class="loading">{t('common.loading')}</div>
          </Show>

          <Show when={!loading() && medias().length === 0}>
            <div class="no-medias">{t('organization.noMediasAvailable')}</div>
          </Show>

          <div class="media-grid">
            <For each={medias()}>
              {(media) => (
                <div
                  class="media-item"
                  classList={{ selected: selectedMediaId() === media.id }}
                  onClick={() => setSelectedMediaId(media.id)}
                >
                  <div class="media-thumbnail">
                    <Show
                      when={
                        media.files?.thumbnail?.uri || media.files?.main?.uri
                      }
                      fallback={<div class="no-preview">No preview</div>}
                    >
                      <img
                        src={
                          media.files?.thumbnail?.uri || media.files?.main?.uri
                        }
                        alt={media.name}
                      />
                    </Show>
                  </div>
                  <div class="media-name">{media.name}</div>
                </div>
              )}
            </For>
          </div>

          <div class="modal-actions">
            <Button
              label={t('common.cancel')}
              onClick={() => modalRef?.close()}
              color="secondary"
            />
            <Button
              label={t('common.save')}
              onClick={handleSelectMedia}
              color="primary"
              disabled={!selectedMediaId()}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};
