/**
 * Team Members View
 *
 * (c) Castmill 2025
 */

import {
  Button,
  IconButton,
  Modal,
  TableView,
  FormItem,
  FetchDataOptions,
  ConfirmDialog,
  TableViewRef,
} from '@castmill/ui-common';
import { TeamsService } from '../../services/teams.service';
import { store, setStore } from '../../store/store';
import { BsCheckLg } from 'solid-icons/bs';
import { AiOutlineDelete } from 'solid-icons/ai';
import { createSignal, Show } from 'solid-js';
import { User } from '../../interfaces/user.interface';
import { useI18n } from '../../i18n';

const [data, setData] = createSignal<{ user: User; user_id: string }[]>([], {
  equals: false,
});

const [currentMember, setCurrentMember] = createSignal<{
  user: User;
  role: string;
}>();
const [showAddMemberDialog, setShowAddMemberDialog] = createSignal(false);
const [showConfirmDialogMultiple, setShowConfirmDialogMultiple] =
  createSignal(false);

const [showConfirmDialog, setShowConfirmDialog] = createSignal(false);

const [selectedMembers, setSelectedMembers] = createSignal(new Set<string>());

const [email, setEmail] = createSignal('');
const [errors, setErrors] = createSignal(new Map());
const [isFormValid, setIsFormValid] = createSignal(false);

const onRowSelect = (rowsSelected: Set<string>) => {
  setSelectedMembers(rowsSelected);
};

const itemsPerPage = 10;

const actions = [
  {
    icon: AiOutlineDelete,
    handler: (item: any) => {
      setCurrentMember(item);
      setShowConfirmDialog(true);
    },
    label: 'Remove',
  },
];

const addMember = () => {
  setShowAddMemberDialog(true);
};

const validateField = (field: string, value: string) => {
  if (field === 'email') {
    if (value.length === 0) {
      errors().set(field, 'Email is required');
    } else if (!value.match(/^[\w-]+@([\w-]+\.)+[\w-]{2,4}$/)) {
      errors().set(field, 'Invalid email');
    } else {
      errors().delete(field);
    }
  }

  setErrors(new Map(errors()));
  setIsFormValid(errors().size === 0);
};

export const TeamMembersView = (props: {
  organizationId: string;
  teamId: number;
  onRemove: (member: User) => void;
}) => {
  const { t } = useI18n();

  const columns = [
    { key: 'user.name', title: t('common.name'), sortable: true },
    { key: 'role', title: t('common.role'), sortable: true },
    { key: 'inserted_at', title: t('teams.insertedAt'), sortable: true },
  ];

  const fetchData = async (opts: FetchDataOptions) => {
    const result = await TeamsService.fetchMembers(
      props.organizationId,
      props.teamId,
      opts
    );
    setData(result.data);
    return result;
  };

  let tableViewRef: TableViewRef<string, User>;

  const setRef = (ref: TableViewRef<string, User>) => {
    tableViewRef = ref;
  };

  const refreshData = () => {
    if (tableViewRef) {
      tableViewRef.reloadData();
    }
  };

  const confirmRemoveMemberFromTeam = async (member?: User) => {
    if (!member) {
      return;
    }

    try {
      await TeamsService.removeMemberFromTeam(
        props.organizationId,
        props.teamId,
        member.id
      );

      refreshData();

      setShowConfirmDialog(false);
    } catch (error) {
      alert((error as Error).message);
    }
  };

  const confirmRemoveMultipleMembersFromTeam = async () => {
    try {
      await Promise.all(
        Array.from(selectedMembers()).map((memberId) =>
          TeamsService.removeMemberFromTeam(
            props.organizationId,
            props.teamId,
            memberId
          )
        )
      );

      refreshData();

      setShowConfirmDialogMultiple(false);
    } catch (error) {
      alert((error as Error).message);
    }
  };

  return (
    <>
      <Show when={showAddMemberDialog()}>
        <Modal
          title={t('teams.inviteMember')}
          description={t('teams.inviteMemberDescription')}
          onClose={() => setShowAddMemberDialog(false)}
        >
          {/* Adding a new member just requires a valid email address */}
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (isFormValid()) {
                try {
                  await TeamsService.inviteUser(
                    store.organizations.selectedId!,
                    props.teamId,
                    email()
                  );

                  refreshData();
                  setShowAddMemberDialog(false);
                } catch (error) {
                  alert((error as Error).message);
                }
              }
            }}
          >
            <FormItem
              label={t('common.name')}
              id="name"
              value={email()!}
              placeholder={t('teams.enterMember')}
              onInput={(value: string | number | boolean) => {
                const strValue = value as string;
                setEmail(strValue);
                validateField('email', strValue);
              }}
            >
              <div class="error">{errors().get('email')}</div>
            </FormItem>
            <div class="form-input"></div>
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
        title={`Remove User From Team`}
        message={`Are you sure you want to remove member "${currentMember()?.user?.name}" from the team?`}
        onClose={() => setShowConfirmDialog(false)}
        onConfirm={() => confirmRemoveMemberFromTeam(currentMember()?.user)}
      />

      <ConfirmDialog
        show={showConfirmDialogMultiple()}
        title={`Remove members From Team`}
        message={`Are you sure you want to remove the following members from the team?`}
        onClose={() => setShowConfirmDialogMultiple(false)}
        onConfirm={() => confirmRemoveMultipleMembersFromTeam()}
      >
        <div style="margin: 1.5em; line-height: 1.5em;">
          {Array.from(selectedMembers()).map((memberId) => {
            const member = data().find((d) => d.user_id === memberId);
            return <div>{`- ${member?.user.name}`}</div>;
          })}
        </div>
      </ConfirmDialog>

      <TableView
        title=""
        resource="teams"
        fetchData={fetchData}
        ref={setRef}
        toolbar={{
          mainAction: (
            <Button
              label={t('teams.inviteMember')}
              onClick={addMember}
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
                disabled={selectedMembers().size === 0}
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
        itemIdKey="user_id"
      ></TableView>
    </>
  );
};
