import {
  Component,
  createEffect,
  createSignal,
  onCleanup,
  onMount,
  Show,
  on,
} from 'solid-js';

import {
  Button,
  IconButton,
  ConfirmDialog,
  Modal,
  Column,
  TableView,
  TableViewRef,
  TableAction,
  ResourcesObserver,
  TeamFilter,
  FetchDataOptions,
  ToastProvider,
  useToast,
} from '@castmill/ui-common';

import { BsCheckLg } from 'solid-icons/bs';
import { BsEye } from 'solid-icons/bs';
import { AiOutlineDelete } from 'solid-icons/ai';

import { Device } from '../interfaces/device.interface';
import DeviceView from './device-view';
import styles from './devices.module.scss';

import RegisterDevice from './register-device';
import { DevicesService } from '../services/devices.service';
import { AddonComponentProps } from '../../common/interfaces/addon-store';
import { useTeamFilter, useModalFromUrl } from '../../common/hooks';

import { QuotaIndicator } from '../../common/components/quota-indicator';
import {
  QuotasService,
  ResourceQuota,
} from '../../common/services/quotas.service';

interface DeviceTableItem extends Device {
  location: string;
  city: string;
  country: string;
}

const DevicesPage: Component<AddonComponentProps> = (props) => {
  // Get i18n functions from store
  const t = (key: string, params?: Record<string, any>) => {
    const result = props.store.i18n?.t(key, params) || key;
    return result;
  };
  const toast = useToast();

  // Helper function to check permissions
  const canPerformAction = (resource: string, action: string): boolean => {
    if (!props.store.permissions?.matrix) return false;
    const allowedActions =
      props.store.permissions.matrix[
        resource as keyof typeof props.store.permissions.matrix
      ];
    return allowedActions?.includes(action as any) ?? false;
  };

  const [totalItems, setTotalItems] = createSignal(0);

  const { teams, selectedTeamId, setSelectedTeamId } = useTeamFilter({
    baseUrl: props.store.env.baseUrl,
    organizationId: props.store.organizations.selectedId,
    params: props.params, // Pass URL search params for shareable filtered views
  });

  const itemsPerPage = 10; // Number of items to show per page

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

  const [quota, setQuota] = createSignal<ResourceQuota | null>(null);
  const [quotaLoading, setQuotaLoading] = createSignal(false);
  const [showLoadingIndicator, setShowLoadingIndicator] = createSignal(false);

  const quotasService = new QuotasService(props.store.env.baseUrl);

  let loadingTimeout: ReturnType<typeof setTimeout> | undefined;

  const loadQuota = async () => {
    try {
      setQuotaLoading(true);

      // Only show loading indicator if request takes more than 1 second
      loadingTimeout = setTimeout(() => {
        if (quotaLoading()) {
          setShowLoadingIndicator(true);
        }
      }, 1000);

      const quotaData = await quotasService.getResourceQuota(
        props.store.organizations.selectedId,
        'devices'
      );
      setQuota(quotaData);
    } catch (error) {
      console.error('Failed to load quota:', error);
    } finally {
      if (loadingTimeout) {
        clearTimeout(loadingTimeout);
      }
      setQuotaLoading(false);
      setShowLoadingIndicator(false);
    }
  };

  onMount(() => {
    loadQuota();

    // Register actions for generic shortcuts
    // The shortcuts themselves are already registered globally in GlobalShortcuts
    const { registerShortcutAction } = props.store.keyboardShortcuts || {};
    if (registerShortcutAction) {
      // Register create action
      registerShortcutAction(
        'generic-create',
        () => {
          if (canPerformAction('devices', 'create') && !isQuotaReached()) {
            openRegisterModal();
          }
        },
        () =>
          window.location.pathname.includes('/devices') &&
          canPerformAction('devices', 'create') &&
          !isQuotaReached()
      );

      // Register search action
      registerShortcutAction(
        'generic-search',
        () => {
          if (tableViewRef) {
            tableViewRef.focusSearch();
          }
        },
        () => window.location.pathname.includes('/devices')
      );

      // Register delete action
      registerShortcutAction(
        'generic-delete',
        () => {
          if (
            selectedDevices().size > 0 &&
            canPerformAction('devices', 'delete')
          ) {
            setShowConfirmDialogMultiple(true);
          }
        },
        () =>
          window.location.pathname.includes('/devices') &&
          selectedDevices().size > 0 &&
          canPerformAction('devices', 'delete')
      );
    }
  });

  onCleanup(() => {
    // Unregister actions when leaving this addon
    const { unregisterShortcutAction } = props.store.keyboardShortcuts || {};
    if (unregisterShortcutAction) {
      unregisterShortcutAction('generic-create');
      unregisterShortcutAction('generic-search');
      unregisterShortcutAction('generic-delete');
    }
  });

  // Reload data when organization changes (using on() to defer execution)
  createEffect(
    on(
      () => props.store.organizations.selectedId,
      (orgId, prevOrgId) => {
        // Only reload when org actually changes (not on first run when prevOrgId is undefined)
        if (prevOrgId !== undefined && orgId !== prevOrgId) {
          loadQuota();
          if (tableViewRef) {
            tableViewRef.reloadData();
          }
        }
      }
    )
  );

  // Function to close the modal and update URL
  const closeModalAndClearUrl = () => {
    // Clear URL FIRST (before animation starts) for immediate feedback
    if (props.params) {
      const [, setSearchParams] = props.params;
      setSearchParams({ itemId: undefined }, { replace: true });
    }

    // Then close modal (triggers 300ms animation)
    setShowModal(false);
  };

  // Sync modal state with URL itemId parameter
  useModalFromUrl({
    getItemIdFromUrl: () => props.params?.[0]?.itemId,
    isModalOpen: () => showModal(),
    closeModal: closeModalAndClearUrl,
    openModal: (itemId) => {
      const device = data().find((d) => String(d.id) === String(itemId));
      if (device) {
        setCurrentDevice(device);
        setShowModal(true);
      }
    },
  });

  const isQuotaReached = () => {
    const currentQuota = quota();
    if (!currentQuota) return false;
    return currentQuota.used >= currentQuota.total;
  };

  const [searchParams, setSearchParams] = props.params;

  const resourcesObserver = new ResourcesObserver<DeviceTableItem>(
    props.store.socket,
    'device:status',
    /* onJoin */
    (resource: DeviceTableItem) => {
      return `device_updates:${resource.id}`;
    },
    /* onUpdate */
    (resource: DeviceTableItem, { online }: { online: boolean }) => {
      updateDeviceStatus(resource.id, online);
    }
  );

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
        props.store.env.baseUrl,
        props.store.organizations.selectedId,
        registrationData.name,
        registrationData.pincode
      );

      refreshData();
      loadQuota(); // Reload quota after registration
      setLoadingSuccess(t('devices.deviceRegisteredSuccess'));

      // Update total items
      setTotalItems(totalItems() + 1);

      // Complete the onboarding step for device registration
      props.store.onboarding?.completeStep?.('register_device');
    } catch (error) {
      setRegisterError(
        t('devices.errorRegisteringDevice', { error: String(error) })
      );
    } finally {
      setLoading(false);
    }
  };

  // Function to open the modal
  const openModal = (item: DeviceTableItem) => {
    // Open modal immediately
    setCurrentDevice(item);
    setShowModal(true);

    // Also update URL for shareability (use replace to avoid polluting browser history)
    if (props.params) {
      const [, setSearchParams] = props.params;
      setSearchParams({ itemId: String(item.id) }, { replace: true });
    }
  };

  const [showConfirmDialog, setShowConfirmDialog] = createSignal(false);

  // Function to open the register modal
  const openRegisterModal = () => {
    setShowRegisterModal(true);
  };

  // Function to reset the registration form for "Register Another"
  const handleRegisterAnother = () => {
    setLoadingSuccess('');
    setRegisterError('');
    setPincode('');
  };

  // Use function to make columns reactive to i18n changes
  const columns = () =>
    [
      { key: 'name', title: t('common.name'), sortable: true },
      {
        key: 'online',
        title: t('common.online'),
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
      { key: 'timezone', title: t('common.timezone'), sortable: true },
      { key: 'version', title: t('common.version'), sortable: true },
      { key: 'last_ip', title: t('common.ip'), sortable: true },
      { key: 'id', title: t('common.id'), sortable: true },
    ] as Column<DeviceTableItem>[];

  // Use function to make actions reactive to i18n changes
  const actions = (): TableAction<DeviceTableItem>[] => [
    {
      icon: BsEye,
      handler: openModal,
      label: t('common.view'),
    },
    {
      icon: AiOutlineDelete,
      handler: (item: DeviceTableItem) => {
        if (!canPerformAction('devices', 'delete')) {
          toast.error(
            t('permissions.noDeleteDevices') ||
              "You don't have permission to delete devices"
          );
          return;
        }
        setCurrentDevice(item);
        setShowConfirmDialog(true);
      },
      label: t('common.remove'),
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
  }: FetchDataOptions) => {
    const result = await DevicesService.fetchDevices(
      props.store.env.baseUrl,
      props.store.organizations.selectedId,
      {
        page: page.num,
        page_size: page.size,
        sortOptions,
        search,
        filters,
        team_id: selectedTeamId(),
      }
    );

    resourcesObserver.observe(result.data);

    setData(result.data);

    return result;
  };

  onCleanup(() => {
    resourcesObserver.cleanup();
  });

  const [showConfirmDialogMultiple, setShowConfirmDialogMultiple] =
    createSignal(false);

  const confirmRemoveDevice = async (device: DeviceTableItem | undefined) => {
    if (!device) {
      return;
    }
    try {
      await DevicesService.removeDevice(
        props.store.env.baseUrl,
        props.store.organizations.selectedId,
        device.id
      );

      refreshData();
      toast.success(t('devices.deviceRemovedSuccess', { name: device.name }));
      loadQuota(); // Reload quota after deletion
    } catch (error) {
      toast.error(
        t('devices.errorRemovingDevice', {
          name: device.name,
          error: String(error),
        })
      );
    }
    setShowConfirmDialog(false);
  };

  const confirmRemoveMultipleDevices = async () => {
    try {
      await Promise.all(
        Array.from(selectedDevices()).map((deviceId) =>
          DevicesService.removeDevice(
            props.store.env.baseUrl,
            props.store.organizations.selectedId,
            deviceId
          )
        )
      );

      refreshData();
      toast.success(
        t('devices.devicesRemovedSuccess', { count: selectedDevices().size })
      );
      loadQuota(); // Reload quota after deletion
    } catch (error) {
      toast.error(t('devices.errorRemovingDevices', { error: String(error) }));
    }
    setShowConfirmDialogMultiple(false);
  };

  const onRowSelect = (rowsSelected: Set<string>) => {
    setSelectedDevices(rowsSelected);
  };

  let tableViewRef: TableViewRef<string, DeviceTableItem>;

  const setRef = (ref: TableViewRef<string, DeviceTableItem>) => {
    tableViewRef = ref;
  };

  const refreshData = () => {
    if (tableViewRef) {
      tableViewRef.reloadData();
    }
  };

  const handleTeamChange = (teamId: number | null) => {
    setSelectedTeamId(teamId);
    refreshData();
  };

  const updateItem = (itemId: string, item: Partial<DeviceTableItem>) => {
    if (tableViewRef) {
      tableViewRef.updateItem(itemId, item);
    }
  };

  return (
    <div class={`${styles.devicesPage}`}>
      <Show when={showRegisterModal()}>
        <Modal
          title={t('devices.registerDevice')}
          description={t('devices.registerDescription')}
          onClose={() => setShowRegisterModal(false)}
          successMessage={loadingSuccess()}
          errorMessage={registerError()}
          loading={loading()}
        >
          <RegisterDevice
            store={props.store}
            pincode={pincode()}
            success={!!loadingSuccess()}
            onSubmit={handleDeviceRegistrationSubmit}
            onCancel={() => setShowRegisterModal(false)}
            onRegisterAnother={handleRegisterAnother}
          />
        </Modal>
      </Show>
      <Show when={showModal()}>
        <Modal
          title={`Device "${currentDevice()?.name}"`}
          description={t('devices.deviceDetails')}
          onClose={closeModalAndClearUrl}
        >
          <DeviceView
            baseUrl={props.store.env.baseUrl}
            organization_id={props.store.organizations.selectedId}
            device={currentDevice()!}
            store={props.store}
            onChange={(device) => {
              updateItem(device.id, device);
            }}
            t={t}
          />
        </Modal>
      </Show>

      <ConfirmDialog
        show={showConfirmDialog()}
        title={t('devices.removeDevice')}
        message={t('devices.confirmRemove', {
          name: currentDevice()?.name || '',
        })}
        onClose={() => setShowConfirmDialog(false)}
        onConfirm={() => confirmRemoveDevice(currentDevice())}
      />

      <ConfirmDialog
        show={showConfirmDialogMultiple()}
        title={t('devices.removeDevices')}
        message={t('devices.confirmRemoveMultiple')}
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
        title={t('devices.title')}
        resource="devices"
        params={props.params}
        fetchData={fetchData}
        ref={setRef}
        toolbar={{
          filters: [
            { name: t('common.online'), key: 'online', isActive: true },
            { name: t('common.offline'), key: 'offline', isActive: true },
          ],
          mainAction: (
            <div style="display: flex; align-items: center; gap: 1rem;">
              <Show when={quota()}>
                <QuotaIndicator
                  used={quota()!.used}
                  total={quota()!.total}
                  resourceName={t('devices.title')}
                  compact
                  isLoading={showLoadingIndicator()}
                />
              </Show>
              <Button
                label={t('devices.addDevice')}
                onClick={openRegisterModal}
                icon={BsCheckLg}
                color="primary"
                disabled={
                  isQuotaReached() || !canPerformAction('devices', 'create')
                }
              />
            </div>
          ),
          actions: (
            <div style="display: flex; gap: 1rem; align-items: center;">
              <TeamFilter
                teams={teams()}
                selectedTeamId={selectedTeamId()}
                onTeamChange={handleTeamChange}
                label={t('filters.teamLabel')}
                placeholder={t('filters.teamPlaceholder')}
                clearLabel={t('filters.teamClear')}
              />
              <IconButton
                onClick={() => setShowConfirmDialogMultiple(true)}
                icon={AiOutlineDelete}
                color="primary"
                disabled={
                  selectedDevices().size === 0 ||
                  !canPerformAction('devices', 'delete')
                }
              />
            </div>
          ),
        }}
        table={{
          columns,
          actions,
          actionsLabel: t('common.actions'),
          onRowSelect,
          defaultRowAction: {
            icon: BsEye,
            handler: (item: DeviceTableItem) => {
              openModal(item);
            },
            label: t('common.view'),
          },
        }}
        pagination={{ itemsPerPage }}
      ></TableView>
    </div>
  );
};

export default (props: any) => (
  <ToastProvider>
    <DevicesPage {...props} />
  </ToastProvider>
);
