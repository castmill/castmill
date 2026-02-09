import { Component, createSignal, Show } from 'solid-js';
import { AiOutlineDelete } from 'solid-icons/ai';
import { BsTrash } from 'solid-icons/bs';
import { IoReload } from 'solid-icons/io';

import {
  Tabs,
  TableView,
  TableViewRef,
  SortOptions,
  Column,
  IconButton,
  ConfirmDialog,
  useToast,
  Button,
  formatBytes,
} from '@castmill/ui-common';

import { Device } from '../interfaces/device.interface';

import { DevicesService } from '../services/devices.service';

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
    { key: 'url', title: t('common.url'), sortable: true },
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
  const [currentType, setCurrentType] = createSignal<'data' | 'code' | 'media'>(
    'data'
  );
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
    type: 'data' | 'code' | 'media',
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
    setCurrentType(type);
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
        currentType(),
        []
      );
      toast.success(t('devices.cache.clearAllSuccess'));
      setSelectedItems(new Set<string>());
      refreshData();
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

  const createTab = (type: 'data' | 'code' | 'media', title: string) => ({
    title,
    content: () => (
      <TableView
        title={t('devices.cache.title')}
        resource={t('devices.cache.items')}
        fetchData={(opts: any) => fetchCachePage(type, opts)}
        ref={setTableViewRef}
        table={{
          columns,
          actions,
          onRowSelect,
        }}
        toolbar={{
          hideTitle: true,
          hideSearch: true,
          actions: () => (
            <div style="display: flex; gap: 1rem; align-items: center;">
              <IconButton
                onClick={refreshData}
                icon={IoReload}
                color="primary"
                title={t('common.refresh')}
                loading={loadingRefresh()}
              />
              <IconButton
                onClick={() => setShowConfirmDialogMultiple(true)}
                icon={AiOutlineDelete}
                color="primary"
                disabled={selectedItems().size === 0 || loadingDelete()}
                title={t('devices.cache.deleteSelected')}
              />
              <Button
                onClick={() => setShowConfirmClearAll(true)}
                icon={BsTrash}
                label={t('devices.cache.clearAll')}
                color="danger"
                loading={loadingClearAll()}
              />
            </div>
          ),
        }}
        pagination={{ itemsPerPage }}
      ></TableView>
    ),
  });

  const tabs = [
    createTab('data', t('devices.cache.dataTab')),
    createTab('code', t('devices.cache.codeTab')),
    createTab('media', t('devices.cache.mediaTab')),
  ];

  return (
    <>
      <Show
        when={props.device.online}
        fallback={
          <div style="background-color: #3d3d3d; border-left: 4px solid #f0ad4e; padding: 0.8em 1em; border-radius: 4px;">
            <p style="margin: 0; color: #f0ad4e;">
              {t('devices.cache.offlineWarning')}
            </p>
          </div>
        }
      >
        <Tabs tabs={tabs} />
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
        message={t('devices.cache.confirmClearAllMessage', {
          type: currentType(),
        })}
      />
    </>
  );
};
