import { Component, createSignal, Show, createEffect } from 'solid-js';
import { Button, useToast, MediaPicker } from '@castmill/ui-common';
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
  const [showModal, setShowModal] = createSignal(false);
  const [searchQuery, setSearchQuery] = createSignal('');
  const [isSearching, setIsSearching] = createSignal(false);
  const [selectedMediaId, setSelectedMediaId] = createSignal<number | null>(
    props.currentLogoMediaId ? parseInt(props.currentLogoMediaId, 10) : null
  );
  const [logoUrl, setLogoUrl] = createSignal<string | null>(null);

  // Update selected media when prop changes
  createEffect(() => {
    setSelectedMediaId(
      props.currentLogoMediaId ? parseInt(props.currentLogoMediaId, 10) : null
    );
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

  const loadMedias = async (search?: string) => {
    setLoading(true);
    try {
      // Fetch image medias using the API
      const queryParams = new URLSearchParams({
        page: '1',
        page_size: '100',
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

      if (response.ok) {
        const result = await response.json();
        console.log('Medias API response:', result);
        console.log('Total medias:', result.data?.length || 0);

        // Filter for image types only
        const imageMedias = (result.data || []).filter((media: JsonMedia) =>
          media.mimetype?.startsWith('image/')
        );
        console.log('Image medias after filter:', imageMedias.length);
        console.log('Image medias:', imageMedias);

        setMedias(imageMedias);
      } else {
        console.error('Failed to load medias. Status:', response.status);
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
    setSearchQuery(''); // Reset search when opening
    await loadMedias();
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSearchQuery(''); // Reset search when closing
  };

  // Debounced search - use a ref to store timeout ID
  let searchTimeoutId: number | undefined;

  const handleSearchInput = (value: string | number | boolean) => {
    const searchValue = String(value);
    setSearchQuery(searchValue);

    // Clear existing timeout
    if (searchTimeoutId !== undefined) {
      clearTimeout(searchTimeoutId);
    }

    // Set loading state immediately for UX feedback
    setIsSearching(true);

    // Set new timeout
    searchTimeoutId = window.setTimeout(() => {
      setIsSearching(false);
      loadMedias(searchValue || undefined);
    }, 500); // 500ms debounce for better UX
  };

  const handleSelectMedia = async () => {
    try {
      const mediaId = selectedMediaId();
      const mediaIdStr = mediaId ? String(mediaId) : undefined;

      await OrganizationsService.update(props.organizationId, {
        logo_media_id: mediaIdStr,
      });

      props.onLogoUpdate(mediaIdStr || null);

      // Update store
      setStore('organizations', 'data', (orgs) =>
        orgs.map((org) =>
          org.id === props.organizationId
            ? { ...org, logo_media_id: mediaIdStr }
            : org
        )
      );

      toast.success(t('organization.logoUpdated'));
      closeModal();
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

      <Show when={showModal()}>
        <Modal
          ref={(ref) => (modalRef = ref)}
          title={t('organization.selectLogo')}
          description={t('organization.selectLogoDescription')}
          onClose={closeModal}
        >
          <div class="media-selector">
            <div class="search-container">
              <StyledInput
                id="media-search"
                type="text"
                placeholder={t('common.search')}
                value={searchQuery()}
                onInput={handleSearchInput}
              />
              <Show when={isSearching()}>
                <span class="search-indicator">{t('common.loading')}</span>
              </Show>
            </div>

            <Show when={loading() && !isSearching()}>
              <div class="loading">{t('common.loading')}</div>
            </Show>

            <div class="media-grid-container">
              <Show when={!loading() && medias().length === 0}>
                <div class="no-medias">
                  {t('organization.noMediasAvailable')}
                </div>
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
                            media.files?.thumbnail?.uri ||
                            media.files?.main?.uri
                          }
                          fallback={<div class="no-preview">No preview</div>}
                        >
                          <img
                            src={
                              media.files?.thumbnail?.uri ||
                              media.files?.main?.uri
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
            </div>

            <div class="modal-actions">
              <Button
                label={t('common.cancel')}
                onClick={closeModal}
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
      </Show>
    </div>
  );
};
