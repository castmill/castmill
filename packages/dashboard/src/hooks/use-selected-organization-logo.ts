import { Accessor, createEffect, createSignal } from 'solid-js';
import { store, setStore } from '../store/store';
import { OrganizationsService } from '../services/organizations.service';
import { extractMediaFileUrl } from '../utils/media';

interface UseSelectedOrganizationLogoResult {
  logoUrl: Accessor<string | null>;
  loading: Accessor<boolean>;
}

export const useSelectedOrganizationLogo =
  (): UseSelectedOrganizationLogoResult => {
    const [logoUrl, setLogoUrl] = createSignal<string | null>(null);
    const [loading, setLoading] = createSignal(false);

    let fetchCounter = 0;

    createEffect(() => {
      const selectedId = store.organizations.selectedId;
      const organization = store.organizations.data.find(
        (org) => org.id === selectedId
      );
      const mediaId = organization?.logo_media_id ?? null;

      fetchCounter += 1;
      const currentRun = fetchCounter;

      if (!selectedId || !mediaId) {
        setLogoUrl(null);
        setLoading(false);
        if (selectedId) {
          setStore('organizations', 'logos', selectedId, {
            mediaId: null,
            url: null,
            loading: false,
            error: false,
          });
        }
        return;
      }

      const cached = store.organizations.logos[selectedId];

      if (cached && cached.mediaId === mediaId && cached.url !== undefined) {
        setLogoUrl(cached.url ?? null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setLogoUrl(null);
      setStore('organizations', 'logos', selectedId, {
        mediaId,
        url: undefined,
        loading: true,
        error: false,
      });

      OrganizationsService.fetchMedia(selectedId, mediaId)
        .then((payload: unknown) => {
          if (currentRun !== fetchCounter) return;
          const url = extractMediaFileUrl(payload);
          setLogoUrl(url ?? null);
          setLoading(false);
          setStore('organizations', 'logos', selectedId, {
            mediaId,
            url: url ?? null,
            loading: false,
            error: false,
          });
        })
        .catch((error: unknown) => {
          if (currentRun !== fetchCounter) return;
          console.error('Failed to fetch organization logo media:', error);
          setLogoUrl(null);
          setLoading(false);
          setStore('organizations', 'logos', selectedId, {
            mediaId,
            url: null,
            loading: false,
            error: true,
          });
        });
    });

    return {
      logoUrl,
      loading,
    };
  };
