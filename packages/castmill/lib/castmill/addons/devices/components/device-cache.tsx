import { Component, createSignal } from 'solid-js';
import { AiOutlineDelete } from 'solid-icons/ai';
import { BsTrash } from 'solid-icons/bs';

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

  const columns = [
    { key: 'timestamp', title: t('common.timestamp'), sortable: true },
    { key: 'url', title: t('common.url'), sortable: true },
    { key: 'size', title: t('common.size'), sortable: false },
    { key: 'accessed', title: t('common.accessed'), sortable: false },
    { key: 'mimeType', title: t('common.mimeType'), sortable: false },
  ] as Column<DeviceTableCacheItem>[];

  const [selectedItems, setSelectedItems] = createSignal(new Set<string>());
  const [currentType, setCurrentType] = createSignal<'data' | 'code' | 'media'>('data');
  const [showConfirmDialog, setShowConfirmDialog] = createSignal<DeviceTableCacheItem | undefined>();
  const [showConfirmDialogMultiple, setShowConfirmDialogMultiple] = createSignal(false);
  const [showConfirmClearAll, setShowConfirmClearAll] = createSignal(false);

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

  let tableViewRef: TableViewRef;

  const setRef = (ref: TableViewRef) => {
    tableViewRef = ref;
  };

  const refreshData = () => {
    if (tableViewRef) {
      tableViewRef.reloadData();
    }
  };

  const deleteCacheEntry = async (item: DeviceTableCacheItem) => {
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
    }
    setShowConfirmDialog(undefined);
  };

  const deleteMultipleCacheEntries = async () => {
    try {
      const urls = Array.from(selectedItems());
      await DevicesService.deleteDeviceCache(
        props.baseUrl,
        props.device.id,
        currentType(),
        urls
      );
      toast.success(t('devices.cache.deleteMultipleSuccess', { count: urls.length }));
      setSelectedItems(new Set<string>());
      refreshData();
    } catch (error) {
      toast.error(t('devices.cache.deleteError', { error: String(error) }));
    }
    setShowConfirmDialogMultiple(false);
  };

  const clearAllCache = async () => {
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
    }
    setShowConfirmClearAll(false);
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
        ref={setRef}
        table={{
          columns,
          actions,
          onRowSelect,
        }}
        toolbar={{
          actions: (
            <div style="display: flex; gap: 1rem; align-items: center;">
              <IconButton
                onClick={() => setShowConfirmDialogMultiple(true)}
                icon={AiOutlineDelete}
                color="primary"
                disabled={selectedItems().size === 0}
                title={t('devices.cache.deleteSelected')}
              />
              <Button
                onClick={() => setShowConfirmClearAll(true)}
                variant="outlined"
                color="error"
              >
                <BsTrash /> {t('devices.cache.clearAll')}
              </Button>
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
      <Tabs tabs={tabs} />
      
      {/* Confirm dialog for single item deletion */}
      <ConfirmDialog
        isOpen={!!showConfirmDialog()}
        onConfirm={() => deleteCacheEntry(showConfirmDialog()!)}
        onCancel={() => setShowConfirmDialog(undefined)}
        title={t('devices.cache.confirmDelete')}
        message={t('devices.cache.confirmDeleteMessage', { url: showConfirmDialog()?.url })}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
      />

      {/* Confirm dialog for multiple items deletion */}
      <ConfirmDialog
        isOpen={showConfirmDialogMultiple()}
        onConfirm={deleteMultipleCacheEntries}
        onCancel={() => setShowConfirmDialogMultiple(false)}
        title={t('devices.cache.confirmDeleteMultiple')}
        message={t('devices.cache.confirmDeleteMultipleMessage', { count: selectedItems().size })}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
      />

      {/* Confirm dialog for clearing all cache */}
      <ConfirmDialog
        isOpen={showConfirmClearAll()}
        onConfirm={clearAllCache}
        onCancel={() => setShowConfirmClearAll(false)}
        title={t('devices.cache.confirmClearAll')}
        message={t('devices.cache.confirmClearAllMessage', { type: currentType() })}
        confirmText={t('devices.cache.clearAll')}
        cancelText={t('common.cancel')}
      />
    </>
  );
};
