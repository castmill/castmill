import { Component, createSignal, Show } from 'solid-js';
import { BsTrash } from 'solid-icons/bs';

import {
  TableView,
  TableViewRef,
  SortOptions,
  Column,
  Filter,
  ConfirmDialog,
  Modal,
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
  category?: string;
  code?: string;
  stack?: string;
  context?: Record<string, string | number>;
  occurrence_count?: number;
  first_occurred_at?: string;
  last_occurred_at?: string;
}

export const DeviceLogs: Component<{
  baseUrl: string;
  device: Device;
  t?: (key: string, params?: Record<string, any>) => string;
}> = (props) => {
  const t = props.t || ((key: string) => key);
  const toast = useToast();

  const typeNameMap: Record<string, string> = {
    e: t('devices.events.filterError'),
    w: t('devices.events.filterWarning'),
    i: t('devices.events.filterInfo'),
    o: t('devices.events.filterOnline'),
    x: t('devices.events.filterOffline'),
  };
  const [showConfirmClearAll, setShowConfirmClearAll] = createSignal(false);
  const [selectedEvent, setSelectedEvent] = createSignal<DeviceTableLogItem>();

  const columns = [
    {
      key: 'timestamp',
      title: t('devices.events.lastSeen'),
      sortable: true,
      render: (item: DeviceTableLogItem) => (
        <span>
          {new Date(item.last_occurred_at || item.timestamp).toLocaleString()}
        </span>
      ),
    },
    {
      key: 'type',
      title: t('common.type'),
      sortable: true,
      render: (item: DeviceTableLogItem) => (
        <span>{typeNameMap[item.type] || item.type}</span>
      ),
    },
    { key: 'msg', title: t('common.message'), sortable: false },
    {
      key: 'occurrence_count',
      title: t('devices.events.occurrences'),
      sortable: false,
      render: (item: DeviceTableLogItem) => (
        <span>{item.occurrence_count || 1}</span>
      ),
    },
    {
      key: 'details',
      title: t('devices.events.details'),
      sortable: false,
      render: (item: DeviceTableLogItem) =>
        item.stack || item.context ? (
          <button onClick={() => setSelectedEvent(item)}>
            {t('devices.events.details')}
          </button>
        ) : null,
    },
  ] as Column<DeviceTableLogItem>[];

  // Filters for event types
  const eventFilters: Filter[] = [
    { key: 'e', name: t('devices.events.filterError'), isActive: true },
    { key: 'w', name: t('devices.events.filterWarning'), isActive: true },
    { key: 'i', name: t('devices.events.filterInfo'), isActive: true },
    { key: 'o', name: t('devices.events.filterOnline'), isActive: true },
    { key: 'x', name: t('devices.events.filterOffline'), isActive: true },
  ];

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
        initialSortOptions={{ key: 'timestamp', direction: 'descending' }}
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

      <Show when={selectedEvent()}>
        {(event) => (
          <Modal
            title={t('devices.events.detailsTitle')}
            description={event().category || t('devices.events.errorDetails')}
            onClose={() => setSelectedEvent(undefined)}
          >
            <div style="max-width: 48em; overflow-wrap: anywhere;">
              <Show when={event().first_occurred_at}>
                <p>
                  <strong>{t('devices.events.firstSeen')}:</strong>{' '}
                  {new Date(event().first_occurred_at!).toLocaleString()}
                </p>
              </Show>
              <Show
                when={event().context && Object.keys(event().context!).length}
              >
                <pre style="white-space: pre-wrap;">
                  {JSON.stringify(event().context, null, 2)}
                </pre>
              </Show>
              <Show when={event().stack}>
                <pre style="white-space: pre-wrap;">{event().stack}</pre>
              </Show>
            </div>
          </Modal>
        )}
      </Show>
    </>
  );
};
