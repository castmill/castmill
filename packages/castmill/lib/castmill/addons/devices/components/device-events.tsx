import { Component, createSignal } from 'solid-js';
import { BsTrash } from 'solid-icons/bs';

import {
  TableView,
  TableViewRef,
  SortOptions,
  Column,
  Filter,
  ConfirmDialog,
  useToast,
  Button,
} from '@castmill/ui-common';

import { Device } from '../interfaces/device.interface';

import { DevicesService } from '../services/devices.service';

interface DeviceTableLogItem {
  id: string;
  timestamp: string;
  type: string;
  type_name: string;
  msg?: string;
}

export const DeviceLogs: Component<{
  baseUrl: string;
  device: Device;
  t?: (key: string, params?: Record<string, any>) => string;
}> = (props) => {
  const t = props.t || ((key: string) => key);
  const toast = useToast();

  const columns = [
    { key: 'timestamp', title: t('common.time'), sortable: true },
    { key: 'type_name', title: t('common.type'), sortable: true },
    { key: 'msg', title: t('common.message'), sortable: false },
  ] as Column<DeviceTableLogItem>[];

  // Filters for event types
  const eventFilters: Filter[] = [
    { key: 'e', name: t('devices.events.filterError'), isActive: true },
    { key: 'w', name: t('devices.events.filterWarning'), isActive: true },
    { key: 'i', name: t('devices.events.filterInfo'), isActive: true },
    { key: 'o', name: t('devices.events.filterOnline'), isActive: true },
    { key: 'x', name: t('devices.events.filterOffline'), isActive: true },
  ];

  const [showConfirmClearAll, setShowConfirmClearAll] = createSignal(false);

  const itemsPerPage = 10; // Number of items to show per page

  const fetchLogs = async ({
    page,
    sortOptions,
    search,
    filters,
  }: {
    page: { num: number; size: number };
    sortOptions: SortOptions;
    search?: string;
    filters?: Record<string, string | boolean>;
  }) => {
    // Extract active filter keys (event types)
    const filterTypes = filters
      ? Object.keys(filters).filter((key) => filters[key])
      : [];

    return DevicesService.getDeviceEvents(
      props.baseUrl,
      props.device.id,
      page.num,
      page.size,
      sortOptions,
      filterTypes
    );
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

  const clearAllEvents = async () => {
    try {
      const result = await DevicesService.deleteDeviceEvents(
        props.baseUrl,
        props.device.id
      );
      toast.success(
        t('devices.events.clearAllSuccess', { count: result.deleted })
      );
      refreshData();
    } catch (error) {
      toast.error(t('devices.events.deleteError', { error: String(error) }));
    }
    setShowConfirmClearAll(false);
  };

  return (
    <>
      <TableView
        title={t('devices.events.title')}
        resource={t('devices.events.items')}
        fetchData={fetchLogs}
        ref={setRef}
        table={{
          columns,
          hideCheckboxes: true,
        }}
        toolbar={{
          filters: eventFilters,
          requireOneActiveFilter: false,
          hideSearch: true,
          hideTitle: true,
        }}
        pagination={{ itemsPerPage }}
      ></TableView>

      <div style="display: flex; justify-content: flex-end; margin-top: 1em;">
        <Button
          onClick={() => setShowConfirmClearAll(true)}
          icon={BsTrash}
          label={t('devices.events.clearAll')}
          color="danger"
        />
      </div>

      {/* Confirm dialog for clearing all events */}
      <ConfirmDialog
        show={showConfirmClearAll()}
        onConfirm={clearAllEvents}
        onClose={() => setShowConfirmClearAll(false)}
        title={t('devices.events.confirmClearAll')}
        message={t('devices.events.confirmClearAllMessage')}
      />
    </>
  );
};
