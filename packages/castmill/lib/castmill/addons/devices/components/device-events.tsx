import { Component, createSignal } from 'solid-js';

import {
  TableView,
  TableViewRef,
  SortOptions,
  Column,
} from '@castmill/ui-common';

import { Device } from '../interfaces/device.interface';

import { DevicesService } from '../services/devices.service';

interface DeviceTableLogItem {
  timestamp: string;
  type_name: string;
  msg?: string;
}

export const DeviceLogs: Component<{
  baseUrl: string;
  device: Device;
  t?: (key: string, params?: Record<string, any>) => string;
}> = (props) => {
  const t = props.t || ((key: string) => key);

  const columns = [
    { key: 'timestamp', title: t('common.time'), sortable: true },
    { key: 'type_name', title: t('common.type'), sortable: true },
    { key: 'msg', title: t('common.message'), sortable: false },
  ] as Column<DeviceTableLogItem>[];

  const [selectedItems, setSelectedItems] = createSignal(new Set<string>());

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
    return DevicesService.getDeviceEvents(
      props.baseUrl,
      props.device.id,
      page.num,
      page.size,
      sortOptions
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

  const onRowSelect = (rowsSelected: Set<string>) => {
    setSelectedItems(rowsSelected);
  };

  return (
    <div>
      <TableView
        title="Device's Events"
        resource="events"
        fetchData={fetchLogs}
        ref={setRef}
        table={{
          columns,
          onRowSelect,
        }}
        pagination={{ itemsPerPage }}
      ></TableView>
    </div>
  );
};
