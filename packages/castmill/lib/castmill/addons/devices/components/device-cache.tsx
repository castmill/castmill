import { Component, createSignal, For, Show } from 'solid-js';
import { AiOutlineDelete } from 'solid-icons/ai';
import {
  BsArrowClockwise,
  BsDatabase,
  BsTrash3,
  BsXCircle,
} from 'solid-icons/bs';

import {
  TableView,
  TableViewRef,
  SortOptions,
  Column,
  ConfirmDialog,
  useToast,
  formatBytes,
} from '@castmill/ui-common';

import { Device } from '../interfaces/device.interface';

import { DevicesService } from '../services/devices.service';
import {
  DeviceCardHeader,
  DeviceIconButton,
  DeviceNotice,
} from './device-section';
import './device-cache.scss';

type CacheType = 'data' | 'code' | 'media';
const CACHE_TYPES: readonly CacheType[] = ['data', 'code', 'media'];

interface DeviceTableCacheItem {
  timestamp: string;
  url: string;
  size: number;
  accessed: number;
  mimeType: string;
}

export const DeviceCache: Component<{
  baseUrl: string;
  device: Device;
  t?: (key: string, params?: Record<string, any>) => string;
}> = (props) => {
  const t = props.t || ((key: string) => key);
  const toast = useToast();

  // Helper function to format timestamp to local timezone
  const formatTimestamp = (timestamp: number): string => {
    return new Date(timestamp).toLocaleString();
  };

  const columns = [
    {
      key: 'timestamp',
      title: t('common.timestamp'),
      sortable: true,
      render: (item: DeviceTableCacheItem) => (
        <span>{formatTimestamp(item.timestamp)}</span>
      ),
    },
    {
      key: 'url',
      title: t('common.url'),
      sortable: true,
      render: (item: DeviceTableCacheItem) => (
        <span class="device-cache-url" title={item.url}>
          {item.url}
        </span>
      ),
    },
    {
      key: 'size',
      title: t('common.size'),
      sortable: false,
      render: (item: DeviceTableCacheItem) => (
        <span>{formatBytes(item.size)}</span>
      ),
    },
    { key: 'accessed', title: t('common.accessed'), sortable: false },
    { key: 'mimeType', title: t('common.mimeType'), sortable: false },
  ] as Column<DeviceTableCacheItem>[];

  const [selectedItems, setSelectedItems] = createSignal(new Set<string>());
  const [currentType, setCurrentType] = createSignal<CacheType>('data');
  const [showConfirmDialog, setShowConfirmDialog] = createSignal<
    DeviceTableCacheItem | undefined
  >();
  const [showConfirmDialogMultiple, setShowConfirmDialogMultiple] =
    createSignal(false);
  const [showConfirmClearAll, setShowConfirmClearAll] = createSignal(false);
  const [loadingDelete, setLoadingDelete] = createSignal(false);
  const [loadingClearAll, setLoadingClearAll] = createSignal(false);
  const [loadingRefresh, setLoadingRefresh] = createSignal(false);

  const itemsPerPage = 10; // Number of items to show per page

  const fetchCachePage = async (
    type: CacheType,
    {
      page,
      sortOptions,
      search,
      filters,
    }: {
      page: { num: number; size: number };
      sortOptions: SortOptions;
      search?: string;
      filters?: Record<string, string | boolean>;
    }
  ) => {
    return DevicesService.getDeviceCache(props.baseUrl, props.device.id, {
      type,
      page: page.num,
      page_size: page.size,
      sortOptions,
    });
  };

  const onRowSelect = (rowsSelected: Set<string>) => {
    setSelectedItems(rowsSelected);
  };

  const [tableViewRef, setTableViewRef] = createSignal<TableViewRef | null>(
    null
  );

  const refreshData = async () => {
    const ref = tableViewRef();
    if (ref) {
      setLoadingRefresh(true);
      try {
        await ref.reloadData();
      } finally {
        setLoadingRefresh(false);
      }
    }
  };

  const deleteCacheEntry = async (item: DeviceTableCacheItem) => {
    setShowConfirmDialog(undefined);
    setLoadingDelete(true);
    try {
      await DevicesService.deleteDeviceCache(
        props.baseUrl,
        props.device.id,
        currentType(),
        [item.url]
      );
      toast.success(t('devices.cache.deleteSuccess'));
      refreshData();
    } catch (error) {
      toast.error(t('devices.cache.deleteError', { error: String(error) }));
    } finally {
      setLoadingDelete(false);
    }
  };

  const deleteMultipleCacheEntries = async () => {
    setShowConfirmDialogMultiple(false);
    setLoadingDelete(true);
    try {
      const urls = Array.from(selectedItems());
      await DevicesService.deleteDeviceCache(
        props.baseUrl,
        props.device.id,
        currentType(),
        urls
      );
      toast.success(
        t('devices.cache.deleteMultipleSuccess', { count: urls.length })
      );
      setSelectedItems(new Set<string>());
      refreshData();
    } catch (error) {
      toast.error(t('devices.cache.deleteError', { error: String(error) }));
    } finally {
      setLoadingDelete(false);
    }
  };

  const clearAllCache = async () => {
    setShowConfirmClearAll(false);
    setLoadingClearAll(true);
    try {
      await DevicesService.deleteDeviceCache(
        props.baseUrl,
        props.device.id,
        'all',
        []
      );
      toast.success(t('devices.cache.clearAllSuccess'));
      setSelectedItems(new Set<string>());
    } catch (error) {
      toast.error(t('devices.cache.deleteError', { error: String(error) }));
    } finally {
      setLoadingClearAll(false);
    }
  };

  const actions = [
    {
      icon: AiOutlineDelete,
      handler: (item: DeviceTableCacheItem) => {
        setShowConfirmDialog(item);
      },
      label: t('common.delete'),
    },
  ];

  const selectType = (type: CacheType) => {
    if (type === currentType()) return;
    setSelectedItems(new Set<string>());
    setCurrentType(type);
  };

  const typeLabel = (type: CacheType) => t(`devices.cache.${type}Tab`);
  const tabId = (type: CacheType) => `device-cache-${props.device.id}-${type}`;

  return (
    <>
      <Show
        when={props.device.online}
        fallback={
          <DeviceNotice tone="offline">
            <p>{t('devices.cache.offlineWarning')}</p>
          </DeviceNotice>
        }
      >
        <section class="device-card device-cache">
          <DeviceCardHeader
            icon={BsDatabase}
            title={t('devices.cache.title')}
            description={t('devices.cache.description')}
            actions={
              <button
                type="button"
                class="device-text-button danger"
                disabled={loadingClearAll()}
                onClick={() => setShowConfirmClearAll(true)}
              >
                <BsXCircle aria-hidden="true" />
                {t('devices.cache.clearAll')}
              </button>
            }
          />

          <div class="device-cache-toolbar">
            <div
              class="device-segmented"
              role="tablist"
              aria-label={t('devices.cache.title')}
            >
              <For each={CACHE_TYPES}>
                {(type) => (
                  <button
                    type="button"
                    role="tab"
                    id={tabId(type)}
                    aria-selected={currentType() === type}
                    onClick={() => selectType(type)}
                  >
                    {typeLabel(type)}
                  </button>
                )}
              </For>
            </div>
            <div class="device-card-actions">
              <DeviceIconButton
                icon={BsArrowClockwise}
                label={t('common.refresh')}
                disabled={loadingRefresh()}
                onClick={refreshData}
              />
              <DeviceIconButton
                icon={BsTrash3}
                tone="danger"
                label={t('devices.cache.deleteSelected')}
                disabled={selectedItems().size === 0 || loadingDelete()}
                onClick={() => setShowConfirmDialogMultiple(true)}
              />
            </div>
          </div>

          <div
            class="device-table-scroll"
            role="tabpanel"
            aria-labelledby={tabId(currentType())}
          >
            <Show when={currentType()} keyed>
              {(type) => (
                <TableView
                  title={typeLabel(type)}
                  resource={t('devices.cache.items')}
                  itemIdKey="url"
                  fetchData={(opts: any) => fetchCachePage(type, opts)}
                  ref={setTableViewRef}
                  initialSortOptions={{
                    key: 'timestamp',
                    direction: 'descending',
                  }}
                  table={{
                    columns,
                    actions,
                    onRowSelect,
                  }}
                  pagination={{ itemsPerPage }}
                />
              )}
            </Show>
          </div>
        </section>
      </Show>

      {/* Confirm dialog for single item deletion */}
      <ConfirmDialog
        show={!!showConfirmDialog()}
        onConfirm={() => deleteCacheEntry(showConfirmDialog()!)}
        onClose={() => setShowConfirmDialog(undefined)}
        title={t('devices.cache.confirmDelete')}
        message={t('devices.cache.confirmDeleteMessage', {
          url: showConfirmDialog()?.url,
        })}
      />

      {/* Confirm dialog for multiple items deletion */}
      <ConfirmDialog
        show={showConfirmDialogMultiple()}
        onConfirm={deleteMultipleCacheEntries}
        onClose={() => setShowConfirmDialogMultiple(false)}
        title={t('devices.cache.confirmDeleteMultiple')}
        message={t('devices.cache.confirmDeleteMultipleMessage', {
          count: selectedItems().size,
        })}
      />

      {/* Confirm dialog for clearing all cache */}
      <ConfirmDialog
        show={showConfirmClearAll()}
        onConfirm={clearAllCache}
        onClose={() => setShowConfirmClearAll(false)}
        title={t('devices.cache.confirmClearAll')}
        message={t('devices.cache.confirmClearAllMessage')}
      />
    </>
  );
};
