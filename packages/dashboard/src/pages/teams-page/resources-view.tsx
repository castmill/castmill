import {
  Button,
  ConfirmDialog,
  IconButton,
  Modal,
  TableView,
  TableViewRef,
} from '@castmill/ui-common';
import { AiOutlineDelete } from 'solid-icons/ai';
import { BsCheckLg, BsEye } from 'solid-icons/bs';
import { createSignal, Show } from 'solid-js';
import {
  FetchOptions,
  TeamResource,
  TeamsService,
} from '../../services/teams.service';
import { ResourceChooser } from './resource-chooser';

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
  alert('open view modal');
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
  const resourceKey = `${props.resourceName.toLowerCase()}`;
  const itemIdKey = `${props.resourceName.toLocaleLowerCase()}_id`;

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
      setShowConfirmDialog(false);
    } catch (error) {
      alert(`Error removing resource from team: ${error}`);
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
      setShowConfirmDialogMultiple(false);
    } catch (error) {
      alert(`Error removing resources from team: ${error}`);
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
            <Button
              label={`Add ${props.resourceName}`}
              onClick={addResource}
              icon={BsCheckLg}
              color="primary"
            />
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
        }}
        pagination={{ itemsPerPage }}
      ></TableView>
    </>
  );
};
