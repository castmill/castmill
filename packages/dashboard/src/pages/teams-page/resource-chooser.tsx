// This is code repetition that comes from devices.service.ts and must be refactored.

import {
  ConfirmDialog,
  FetchDataOptions,
  IconButton,
  TableAction,
  TableView,
} from '@castmill/ui-common';
import { BsEye } from 'solid-icons/bs';
import { createSignal } from 'solid-js';

import { baseUrl } from '../../env';
import { FaSolidFolderPlus } from 'solid-icons/fa';
import { TeamsService } from '../../services/teams.service';
import { AccessSelector } from './access-selector';

type HandleResponseOptions = {
  parse?: boolean;
};

async function handleResponse<T = any>(
  response: Response,
  options: { parse: true }
): Promise<T>;
async function handleResponse<T = any>(
  response: Response,
  options?: { parse?: false }
): Promise<void>;
async function handleResponse<T = any>(
  response: Response,
  options: HandleResponseOptions = {}
): Promise<T | void> {
  if (response.status >= 200 && response.status < 300) {
    if (options.parse) {
      return (await response.json()) as T;
    }
  } else {
    let errMsg = '';
    try {
      const { errors } = await response.json();
      errMsg = `${errors.detail || response.statusText}`;
    } catch (error) {
      errMsg = `${response.statusText}`;
    }
    throw new Error(errMsg);
  }
}

export const ResourceChooser = (props: {
  organizationId: string;
  teamId: number;
  resourceType: string;
  resourceName: string;
  onSelect: (resources: { id: string }[]) => void;
}) => {
  const [data, setData] = createSignal<any[]>([]);
  const [currentResource, setCurrentResource] = createSignal<any>();
  const [selectedResources, setSelectedResources] = createSignal(
    new Set<string>()
  );

  const [showConfirmDialog, setShowConfirmDialog] = createSignal(false);
  const [showConfirmDialogMultiple, setShowConfirmDialogMultiple] =
    createSignal(false);
  const [showModal, setShowModal] = createSignal(false);

  const confirmChooseResource = async (
    resource: { id: string },
    access: AccessType[]
  ) => {
    if (!resource) {
      return;
    }
    try {
      await TeamsService.addResource(
        props.organizationId,
        props.teamId,
        props.resourceType,
        resource.id,
        access
      );

      props.onSelect([resource]);
    } catch (error) {
      alert(`Error adding resource to team: ${error}`);
    }
    setShowConfirmDialog(false);
  };

  const confirmChooseMultipleResources = async (access: AccessType[]) => {
    try {
      await Promise.all(
        Array.from(selectedResources()).map((resourceId) =>
          TeamsService.addResource(
            props.organizationId,
            props.teamId,
            props.resourceType,
            resourceId,
            access
          )
        )
      );

      const resources = Array.from(selectedResources()).map((id) => ({ id }));
      props.onSelect(resources);
    } catch (error) {
      alert(`Error removing teams: ${error}`);
    }
    setShowConfirmDialogMultiple(false);
  };

  const onRowSelect = (rowsSelected: Set<string>) => {
    setSelectedResources(rowsSelected);
  };

  const itemsPerPage = 10;

  /**
   * Fetch Resources.
   *
   * @returns { page: number, data: Device[], total: number }
   */
  const fetchResources = async ({
    page,
    sortOptions,
    search,
    filters,
  }: FetchDataOptions) => {
    const filtersToString = (filters: Record<string, string | boolean>) => {
      return Object.entries(filters)
        .map(([key, value]) =>
          typeof value === 'boolean' ? `${key}` : `${key}:${value}`
        )
        .join(',');
    };

    const query: {
      [key: string]: string;
    } = {
      ...sortOptions,
      page_size: page.size.toString(),
      page: page.num.toString(),
    };

    if (search) {
      query['search'] = search;
    }

    if (filters) {
      query['filters'] = filtersToString(filters);
    }

    const queryString = new URLSearchParams(query).toString();

    const response = await fetch(
      `${baseUrl}/dashboard/organizations/${props.organizationId}/${props.resourceType}?${queryString}`,
      {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    const result = await handleResponse<{ data: any[]; count: number }>(
      response,
      {
        parse: true,
      }
    );

    setData(result.data);
    return result;
  };

  const columns = [
    {
      key: 'icon',
      title: 'Icon',
      sortable: true,
      render: (item: any) => {
        const style = 'width: 4em; height: 4em;object-fit: contain;';
        const thumbnail = item.files['thumbnail']?.uri;
        // TODO: Use a default thumbnail for the resources that don't have one
        return <img style={style} src={thumbnail as string} alt={item.name} />;
      },
    },
    { key: 'name', title: 'Name', sortable: true },
    { key: 'id', title: 'ID', sortable: true },
  ];

  interface TableItem {}

  const actions: TableAction<any>[] = [
    {
      icon: BsEye,
      handler: (item: TableItem) => {
        setCurrentResource(item);
        setShowModal(true);
      },
      label: 'View',
    },
    {
      icon: FaSolidFolderPlus,
      handler: (item: any) => {
        setCurrentResource(item);
        setShowConfirmDialog(true);
      },
      label: 'Choose',
    },
  ];

  type AccessType = 'read' | 'write' | 'delete';
  const [access, setAccess] = createSignal<AccessType[]>(['read']);

  return (
    <div style="width: 50vw;display: flex; flex-direction: column;justify-content: flex-start; padding: 1em 0.5em 0 0.5em;">
      <ConfirmDialog
        show={showConfirmDialog()}
        title="Add Resource to Team"
        message={`Are you sure you want to add resource "${currentResource()?.name}"?`}
        onClose={() => setShowConfirmDialog(false)}
        onConfirm={() => confirmChooseResource(currentResource(), access())}
      >
        <AccessSelector
          availableAccess={['read', 'write', 'delete']}
          selected={access()}
          onChange={setAccess}
        />
      </ConfirmDialog>

      <ConfirmDialog
        show={showConfirmDialogMultiple()}
        title="Add Resources to Teams"
        message={'Are you sure you want to add the following resources?'}
        onClose={() => setShowConfirmDialogMultiple(false)}
        onConfirm={() => confirmChooseMultipleResources(access())}
      >
        <div style="margin: 1.5em; line-height: 1.5em;">
          {Array.from(selectedResources()).map((resourceId) => {
            const resource = data().find((d) => d.id === resourceId);
            return <div>{`- ${resource?.name}`}</div>;
          })}
        </div>

        <AccessSelector
          availableAccess={['read', 'write', 'delete']}
          selected={access()}
          onChange={setAccess}
        />
      </ConfirmDialog>

      <TableView
        title=""
        resource={props.resourceType}
        fetchData={fetchResources}
        toolbar={{
          filters: [],

          actions: (
            <div>
              <IconButton
                onClick={() => setShowConfirmDialogMultiple(true)}
                icon={FaSolidFolderPlus}
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
    </div>
  );
};
