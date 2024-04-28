import {
  Component,
  createSignal,
  createEffect,
  onCleanup,
  Show,
} from 'solid-js';
import { useParams } from '@solidjs/router';

import {
  Button,
  Modal,
  CastmillTable,
  Column,
  SortOptions,
} from '@castmill/ui-common'

import { BsCheckLg } from 'solid-icons/bs';

import DeviceView from './device-view';

import { BsEye } from 'solid-icons/bs';
import { AiOutlineDelete } from 'solid-icons/ai';

import './devices.scss';
import RegisterDevice from './register-device';
import { DevicesService } from '../services/devices.service';

interface DeviceTableItem {
  name: string;
  online: boolean;
  location: string;
  city: string;
  country: string;
  ip: string;
  id: string;
}

const DevicesPage: Component<{
  store: { organizations: { selectedId: string } };
}> = (props) => {
  const [data, setData] = createSignal<DeviceTableItem[]>([]);
  const [pincode, setPincode] = createSignal('');

  const [showModal, setShowModal] = createSignal(false);
  const [showRegisterModal, setShowRegisterModal] = createSignal(false);
  const [loading, setLoading] = createSignal(false);
  const [loadingSuccess, setLoadingSuccess] = createSignal('');
  const [registerError, setRegisterError] = createSignal('');
  const [loadingError, setLoadingError] = createSignal('');

  const [currentDevice, setCurrentDevice] = createSignal<DeviceTableItem>();

  /*
  // We want to show this modal directly, if for example the user did arrive to the registration page
  // via a link embedded in a QR-Code. The registration code is then passed as a URL parameter.
  const params = useParams();
  if (params.registrationCode) {
    setShowRegisterModal(true);
    setPincode(params.registrationCode);
  }
  */

  const handleDeviceRegistrationSubmit = async (registrationData: {
    name: string;
    pincode: string;
  }) => {
    console.log(
      'Submitting data:',
      registrationData,
      props.store.organizations
    );

    try {
      setLoading(true);
      const device = await DevicesService.registerDevice(
        props.store.organizations.selectedId,
        registrationData.name,
        registrationData.pincode
      );
      setData([...data(), device]);
      setLoadingSuccess('Device registered successfully');
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
      key: 'last_online',
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
    {
      icon: BsEye,
      props: (item: DeviceTableItem) => ({
        color: item.online ? 'green' : 'red',
      }),
      handler: openModal,
    },
    {
      icon: AiOutlineDelete,
      handler: (item: DeviceTableItem) => console.log('Removing', item),
    },
  ];

  const fetchData = async (sortOptions: SortOptions) => {
    try {
      const result = await DevicesService.fetchDevices(
        props.store.organizations.selectedId,
        0,
        10,
        sortOptions
      );

      console.log({ result });

      setData(result.rows);
    } catch (error) {
      setLoadingError(`Error fetching devices: ${error}`);
    }
  };

  createEffect(async () => {
    // TODO: Show some error if this fetch fails for any reason.
    await fetchData({ key: 'name', direction: 'ascending' }); // Initial fetch
  });

  return (
    <div class="devices-page">
      <div class="devices-bar">
        <h1>Devices</h1>
        <Button
          label="Add Device"
          onClick={openRegisterModal}
          icon={BsCheckLg}
          color="primary"
        />
      </div>
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
          title="Device"
          description="Details of your device"
          onClose={closeModal}
        >
          <DeviceView device={currentDevice()!} />
        </Modal>
      </Show>
      <div class="devices-table">
        <Show
          when={!loadingError()}
          fallback={<div>Loading Error: {loadingError()}</div>}
        >
          <CastmillTable<DeviceTableItem>
            columns={columns}
            data={data()}
            fetchData={fetchData}
            actions={actions}
          />
        </Show>
      </div>
    </div>
  );
};

export default DevicesPage;
