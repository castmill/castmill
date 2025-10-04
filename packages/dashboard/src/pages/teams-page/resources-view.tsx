import {
  Button,
  ConfirmDialog,
  IconButton,
  Modal,
  TableView,
  TableViewRef,
  useToast,
} from '@castmill/ui-common';
import { AiOutlineDelete } from 'solid-icons/ai';
import { BsCheckLg, BsEye } from 'solid-icons/bs';
import { createSignal, Show, onMount } from 'solid-js';
import {
  FetchOptions,
  TeamResource,
  TeamsService,
} from '../../services/teams.service';
import { ResourceChooser } from './resource-chooser';
import { QuotaIndicator } from '../../components/quota-indicator';
import { QuotasService, ResourceQuota } from '../../services/quotas.service';

const itemsPerPage = 10;

const [currentResource, setCurrentResource] = createSignal<TeamResource>();
const [showAddResourceDialog, setShowAddResourceDialog] = createSignal(false);
const [showConfirmDialog, setShowConfirmDialog] = createSignal(false);
const [showConfirmDialogMultiple, setShowConfirmDialogMultiple] =
  createSignal(false);

const [selectedResources, setSelectedResources] = createSignal(
  new Set<string | number>()
);

const [isFormValid, setIsFormValid] = createSignal(false);

const [data, setData] = createSignal<TeamResource[]>([]);

const onRowSelect = (rowsSelected: Set<string | number>) => {
  setSelectedResources(rowsSelected);
};

const openModal = () => {
  // TODO: Implement view modal
  console.log('View modal not yet implemented');
};

const actions = [
  {
    icon: BsEye,
    handler: openModal,
    label: 'View',
  },
  {
    icon: AiOutlineDelete,
    handler: (item: any) => {
      setCurrentResource(item);
      setShowConfirmDialog(true);
    },
    label: 'Remove',
  },
];

const addResource = () => {
  setShowAddResourceDialog(true);
};

export const ResourcesView = (props: {
  organizationId: string;
  teamId: number;
  resourceType: string;
  resourceName: string;
}) => {
  const toast = useToast();
  const resourceKey = `${props.resourceName.toLowerCase()}`;
  const itemIdKey = `${props.resourceName.toLocaleLowerCase()}_id`;

  const [quota, setQuota] = createSignal<ResourceQuota | null>(null);
  const [quotaLoading, setQuotaLoading] = createSignal(true);

  onMount(async () => {
    try {
      const resourceType = props.resourceType as any;
      const quotaData = await QuotasService.getResourceQuota(
        props.organizationId,
        resourceType
      );
      setQuota(quotaData);
    } catch (error) {
      console.error('Failed to fetch quota:', error);
    } finally {
      setQuotaLoading(false);
    }
  });

  const isQuotaReached = () => {
    const q = quota();
    return q ? q.used >= q.total : false;
  };

  const columns = [
    {
      key: `${resourceKey}.name`,
      title: 'Icon',
      sortable: true,
      render: (item: any) => {
        const style = 'width: 4em; height: 4em;object-fit: contain;';
        const thumbnail = item[resourceKey].files['thumbnail']?.uri;
        return <img style={style} src={thumbnail as string} alt={item.name} />;
      },
    },
    {
      key: `${resourceKey}.name`,
      title: 'Name',
      sortable: true,
    },
    {
      key: 'access',
      title: 'Access',
      sortable: true,
      render: (item: TeamResource) => item.access.join(','),
    },
  ];

  const confirmRemoveResourceFromTeam = async (resource?: TeamResource) => {
    if (!resource) {
      return;
    }
    try {
      const resourceId = resource[itemIdKey];
      await TeamsService.removeResourceFromTeam(
        props.organizationId,
        props.teamId,
        props.resourceType,
        resourceId
      );
      refreshData();
      toast.success('Resource removed from team successfully');
      setShowConfirmDialog(false);
    } catch (error) {
      toast.error(`Error removing resource from team: ${error}`);
    }
  };

  const confirmRemoveMultipleResourcesFromTeam = async () => {
    try {
      await Promise.all(
        Array.from(selectedResources()).map((resourceId) => {
          const resource = data().find((d) => d[itemIdKey] === resourceId);
          if (resource) {
            return TeamsService.removeResourceFromTeam(
              props.organizationId,
              props.teamId,
              props.resourceType,
              resource[itemIdKey]
            );
          }
        })
      );
      refreshData();
      setSelectedResources(new Set<string | number>());
      toast.success('Resources removed from team successfully');
      setShowConfirmDialogMultiple(false);
    } catch (error) {
      toast.error(`Error removing resources from team: ${error}`);
    }
  };

  const fetchResources = async (options: FetchOptions) => {
    const result = await TeamsService.fetchResources(
      props.organizationId,
      props.teamId,
      props.resourceType,
      options
    );

    setData(result.data);
    return result;
  };

  let tableViewRef: TableViewRef<string | number, TeamResource>;

  const setRef = (ref: TableViewRef<string | number, TeamResource>) => {
    tableViewRef = ref;
  };

  const refreshData = () => {
    if (tableViewRef) {
      tableViewRef.reloadData();
    }
  };

  const getName = (resource: TeamResource | undefined) =>
    resource ? resource[resourceKey].name : 'N/A';

  return (
    <>
      <Show when={showAddResourceDialog()}>
        <Modal
          title={`Add ${props.resourceName}`}
          description={`Add a new ${props.resourceName.toLocaleLowerCase()} to the team`}
          onClose={() => setShowAddResourceDialog(false)}
        >
          {/* Adding a new member just requires a valid email address */}
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const resource = currentResource();
              if (isFormValid() && resource) {
                // props.onAdd(resource);
              }
            }}
          >
            <div class="form-input"></div>
            <ResourceChooser
              organizationId={props.organizationId}
              teamId={props.teamId}
              resourceType={props.resourceType}
              resourceName={props.resourceName}
              onSelect={refreshData}
            />
            <div class="form-actions">
              <Button
                label="Add"
                type="submit"
                disabled={!isFormValid()}
                color="primary"
              />
            </div>
          </form>
        </Modal>
      </Show>

      <ConfirmDialog
        show={showConfirmDialog()}
        title={`Remove ${props.resourceName} From Team`}
        message={`Are you sure you want to remove ${props.resourceName} "${getName(currentResource())}" from the team?`}
        onClose={() => setShowConfirmDialog(false)}
        onConfirm={() => confirmRemoveResourceFromTeam(currentResource())}
      />

      <ConfirmDialog
        show={showConfirmDialogMultiple()}
        title={`Remove ${props.resourceName}s From Team`}
        message={`Are you sure you want to remove the following ${props.resourceName}s from the team?`}
        onClose={() => setShowConfirmDialogMultiple(false)}
        onConfirm={() => confirmRemoveMultipleResourcesFromTeam()}
      >
        <div style="margin: 1.5em; line-height: 1.5em;">
          {Array.from(selectedResources()).map((resourceId) => {
            const resource = data().find((d) => d[itemIdKey] === resourceId);
            return <div>{`- ${getName(resource)}`}</div>;
          })}
        </div>
      </ConfirmDialog>

      <TableView<string | number, TeamResource>
        title=""
        resource={props.resourceType}
        itemIdKey={itemIdKey}
        fetchData={fetchResources}
        ref={setRef}
        toolbar={{
          filters: [],
          mainAction: (
            <div style="display: flex; align-items: center; gap: 1rem;">
              <Show when={quota() && !quotaLoading()}>
                <QuotaIndicator
                  used={quota()!.used}
                  total={quota()!.total}
                  resourceName={props.resourceName}
                  compact
                />
              </Show>
              <Button
                label={`Add ${props.resourceName}`}
                onClick={addResource}
                icon={BsCheckLg}
                color="primary"
                disabled={isQuotaReached()}
                title={
                  isQuotaReached()
                    ? `Quota limit reached for ${props.resourceName}. Cannot add more.`
                    : `Add a new ${props.resourceName}`
                }
              />
            </div>
          ),
          actions: (
            <div>
              <IconButton
                onClick={() => setShowConfirmDialogMultiple(true)}
                icon={AiOutlineDelete}
                color="primary"
                disabled={selectedResources().size === 0}
              />
            </div>
          ),
        }}
        table={{
          columns,
          actions,
          onRowSelect,
          defaultRowAction: {
            icon: BsEye,
            handler: openModal,
            label: 'View',
          },
        }}
        pagination={{ itemsPerPage }}
      ></TableView>
    </>
  );
};
