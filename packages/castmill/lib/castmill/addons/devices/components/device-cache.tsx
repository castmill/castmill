import { Component, createSignal } from 'solid-js';
import { AiOutlineDelete } from 'solid-icons/ai';

import {
  Tabs,
  TableView,
  TableViewRef,
  SortOptions,
  Column,
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

const columns = [
  { key: 'timestamp', title: 'Timestamp', sortable: true },
  { key: 'url', title: 'Url', sortable: true },
  { key: 'size', title: 'Size', sortable: false },
  { key: 'accessed', title: 'Accessed', sortable: false },
  { key: 'mimeType', title: 'Mime Type', sortable: false },
] as Column<DeviceTableCacheItem>[];

export const DeviceCache: Component<{ baseUrl: string; device: Device }> = (
  props
) => {
  const [selectedItems, setSelectedItems] = createSignal(new Set<string>());

  const itemsPerPage = 10; // Number of items to show per page

  const fetchCachePage = async (
    type: 'data' | 'code' | 'medias',
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

  let tableViewRef: TableViewRef;

  const setRef = (ref: TableViewRef) => {
    tableViewRef = ref;
  };

  const refreshData = () => {
    if (tableViewRef) {
      tableViewRef.reloadData();
    }
  };

  const actions = [
    {
      icon: AiOutlineDelete,
      handler: (item: DeviceTableCacheItem) => {
        console.log('Delete device', item);
      },
    },
  ];

  const tabs = [
    {
      title: 'Data',
      content: () => (
        <TableView
          title="Device Cache"
          resource="cache items"
          fetchData={(opts: any) => fetchCachePage('data', opts)}
          ref={setRef}
          table={{
            columns,
            actions,
            onRowSelect,
          }}
          pagination={{ itemsPerPage }}
        ></TableView>
      ),
    },
    {
      title: 'Code',
      content: () => (
        <TableView
          title="Device Cache"
          resource="cache items"
          fetchData={(opts: any) => fetchCachePage('code', opts)}
          ref={setRef}
          table={{
            columns,
            actions,
            onRowSelect,
          }}
          pagination={{ itemsPerPage }}
        ></TableView>
      ),
    },
    {
      title: 'Medias',
      content: () => (
        <TableView
          title="Device Cache"
          resource="cache items"
          fetchData={(opts: any) => fetchCachePage('medias', opts)}
          ref={setRef}
          table={{
            columns,
            actions,
            onRowSelect,
          }}
          pagination={{ itemsPerPage }}
        ></TableView>
      ),
    },
  ];

  return <Tabs tabs={tabs} />;
};
