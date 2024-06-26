import { Socket, Channel } from 'phoenix';
import { Component, createSignal, onCleanup, Show } from 'solid-js';

import {
  Button,
  IconButton,
  ConfirmDialog,
  Modal,
  Column,
  SortOptions,
  TableView,
  TableViewRef,
} from '@castmill/ui-common';

import { BsCheckLg } from 'solid-icons/bs';
import { BsEye } from 'solid-icons/bs';
import { AiOutlineDelete } from 'solid-icons/ai';

import { Device } from '../interfaces/device.interface';
import DeviceView from './device-view';
import './devices.module.scss';

import RegisterDevice from './register-device';
import { DevicesService } from '../services/devices.service';

interface DeviceTableItem extends Device {
  location: string;
  city: string;
  country: string;
}

const DevicesPage: Component<{
  store: { organizations: { selectedId: string }; socket: Socket };
  params: any; //typeof useSearchParams;
}> = (props) => {
  const [currentPage, setCurrentPage] = createSignal(1);
  const [totalItems, setTotalItems] = createSignal(0);

  const itemsPerPage = 2; // Number of items to show per page

  const [data, setData] = createSignal<DeviceTableItem[]>([], {
    equals: false,
  });

  const [loading, setLoading] = createSignal(false);
  const [loadingSuccess, setLoadingSuccess] = createSignal('');

  const [pincode, setPincode] = createSignal('');

  const [showModal, setShowModal] = createSignal(false);
  const [showRegisterModal, setShowRegisterModal] = createSignal(false);

  const [registerError, setRegisterError] = createSignal('');

  const [currentDevice, setCurrentDevice] = createSignal<DeviceTableItem>();

  const [selectedDevices, setSelectedDevices] = createSignal(new Set<string>());

  const [searchParams, setSearchParams] = props.params;

  const channels: Record<string, Channel> = {};

  // We want to show this modal directly, if for example the user did arrive to the registration page
  // via a link embedded in a QR-Code. The registration code is then passed as a URL parameter.
  if (searchParams.registrationCode) {
    setShowRegisterModal(true);
    setPincode(searchParams.registrationCode);
  }

  const handleDeviceRegistrationSubmit = async (registrationData: {
    name: string;
    pincode: string;
  }) => {
    try {
      setLoading(true);
      const device = await DevicesService.registerDevice(
        props.store.organizations.selectedId,
        registrationData.name,
        registrationData.pincode
      );

      refreshData();
      setLoadingSuccess('Device registered successfully');

      // Update total items
      setTotalItems(totalItems() + 1);
    } catch (error) {
      setRegisterError(`Error registering device: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  // Function to open the modal
  const openModal = (item: DeviceTableItem) => {
    setCurrentDevice(item);
    setShowModal(true);
  };

  // Function to close the modal and remove blur
  const closeModal = () => {
    setShowModal(false);
  };

  // Function to open the register modal
  const openRegisterModal = () => {
    setShowRegisterModal(true);
  };

  const columns = [
    { key: 'name', title: 'Name', sortable: true },
    {
      key: 'online',
      title: 'Online',
      sortable: true,
      render: (item: DeviceTableItem) => (
        <svg
          width="16"
          height="16"
          fill={item.online ? 'green' : 'red'}
          viewBox="0 0 16 16"
        >
          <circle cx="8" cy="8" r="6" />
        </svg>
      ),
    },
    { key: 'timezone', title: 'TZ', sortable: true },
    { key: 'version', title: 'Version', sortable: true },
    { key: 'last_ip', title: 'IP', sortable: true },
    { key: 'id', title: 'ID', sortable: true },
  ] as Column<DeviceTableItem>[];

  const actions = [
    /*
    // Example of action with custom props based on the item
    {
      icon: BsEye,
      props: (item: DeviceTableItem) => ({
        color: item.online ? 'green' : 'red',
      }),
      handler: openModal,
    },
    */
    {
      icon: BsEye,
      handler: openModal,
    },
    {
      icon: AiOutlineDelete,
      handler: (item: DeviceTableItem) => {
        setCurrentDevice(item);
        setShowConfirmDialog(true);
      },
    },
  ];

  const updateDeviceStatus = (deviceId: string, newOnlineStatus: boolean) => {
    updateItem(deviceId, { online: newOnlineStatus } as DeviceTableItem);
  };

  const fetchData = async ({
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
    const result = await DevicesService.fetchDevices(
      props.store.organizations.selectedId,
      {
        page: page.num,
        page_size: page.size,
        sortOptions,
        search,
        filters,
      }
    );

    const newDeviceIds = new Set(result.data?.map((device) => device.id));

    // Clean all the old unused channel subscriptions
    Object.keys(channels).forEach((deviceId) => {
      if (!newDeviceIds.has(deviceId)) {
        const channel = channels[deviceId];
        channel.off('device:status');
        channel.leave();
        delete channels[deviceId];
      }
    });

    // Join to every new device channel to get the online status
    result.data?.forEach((device) => {
      if (channels[device.id]) {
        return;
      } else {
        const topic = `device_updates:${device.id}`;
        const channel = props.store.socket.channel(topic);
        channels[device.id] = channel;
        channel.join();
        channel.on('device:status', ({ online }: { online: boolean }) => {
          updateDeviceStatus(device.id, online);
        });
      }
    });

    return result;
  };

  onCleanup(() => {
    Object.values(channels).forEach((channel) => {
      channel.leave();
    });
  });

  const [showConfirmDialog, setShowConfirmDialog] = createSignal(false);
  const [showConfirmDialogMultiple, setShowConfirmDialogMultiple] =
    createSignal(false);

  const confirmRemoveDevice = async (device: DeviceTableItem | undefined) => {
    if (!device) {
      return;
    }
    try {
      await DevicesService.removeDevice(
        props.store.organizations.selectedId,
        device.id
      );

      refreshData();
    } catch (error) {
      alert(`Error removing device ${device.name}: ${error}`);
    }
    setShowConfirmDialog(false);
  };

  const confirmRemoveMultipleDevices = async () => {
    try {
      await Promise.all(
        Array.from(selectedDevices()).map((deviceId) =>
          DevicesService.removeDevice(
            props.store.organizations.selectedId,
            deviceId
          )
        )
      );

      refreshData();
    } catch (error) {
      alert(`Error removing devices: ${error}`);
    }
    setShowConfirmDialogMultiple(false);
  };

  const onRowSelect = (rowsSelected: Set<string>) => {
    console.log('Selected rows:', rowsSelected);
    setSelectedDevices(rowsSelected);
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

  const updateItem = (itemId: string, item: Partial<DeviceTableItem>) => {
    if (tableViewRef) {
      tableViewRef.updateItem(itemId, item);
    }
  };

  return (
    <div class="devices-page">
      <Show when={showRegisterModal()}>
        <Modal
          title="Register device"
          description="And start displaying content on it"
          onClose={() => setShowRegisterModal(false)}
          successMessage={loadingSuccess()}
          errorMessage={registerError()}
          loading={loading()}
        >
          <RegisterDevice
            pincode={pincode()}
            onSubmit={handleDeviceRegistrationSubmit}
            onCancel={() => setShowRegisterModal(false)}
          />
        </Modal>
      </Show>
      <Show when={showModal()}>
        <Modal
          title={`Device "${currentDevice()?.name}"`}
          description="Details of your device"
          onClose={closeModal}
        >
          <DeviceView
            organization_id={props.store.organizations.selectedId}
            device={currentDevice()!}
            onChange={(device) => {
              updateItem(device.id, device);
            }}
          />
        </Modal>
      </Show>

      <ConfirmDialog
        show={showConfirmDialog()}
        title="Remove Device"
        message={`Are you sure you want to remove device "${currentDevice()?.name}"?`}
        onClose={() => setShowConfirmDialog(false)}
        onConfirm={() => confirmRemoveDevice(currentDevice())}
      />

      <ConfirmDialog
        show={showConfirmDialogMultiple()}
        title="Remove Devices"
        message={'Are you sure you want to remove the following devices?'}
        onClose={() => setShowConfirmDialogMultiple(false)}
        onConfirm={() => confirmRemoveMultipleDevices()}
      >
        <div style="margin: 1.5em; line-height: 1.5em;">
          {Array.from(selectedDevices()).map((deviceId) => {
            const device = data().find((d) => d.id === deviceId);
            return <div>{`- ${device?.name}`}</div>;
          })}
        </div>
      </ConfirmDialog>

      <TableView
        title="Devices"
        resource="devices"
        params={props.params}
        fetchData={fetchData}
        ref={setRef}
        toolbar={{
          filters: [
            { name: 'Online', key: 'online', isActive: true },
            { name: 'Offline', key: 'offline', isActive: true },
          ],
          mainAction: (
            <Button
              label="Add Device"
              onClick={openRegisterModal}
              icon={BsCheckLg}
              color="primary"
            />
          ),
          actions: (
            <div>
              <IconButton
                title="Remove"
                onClick={() => setShowConfirmDialogMultiple(true)}
                icon={AiOutlineDelete}
                color="primary"
                disabled={selectedDevices().size === 0}
              />
            </div>
          ),
        }}
        table={{
          columns,
          actions,
          onRowSelect,
        }}
        pagination={{ itemsPerPage }}
      ></TableView>
    </div>
  );
};

export default DevicesPage;
