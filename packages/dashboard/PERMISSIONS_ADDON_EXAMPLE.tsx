/**
 * Example: Integrating Permissions into an Addon Component
 *
 * This example shows how to use permissions in addon components loaded from the Elixir server.
 */

import { Component, createSignal, For } from 'solid-js';
import { Button } from '@castmill/ui-common';
import type { AddonStore } from '../../common/interfaces/addon-store';
import type {
  ResourceType,
  Action,
} from '../../../dashboard/src/services/permissions.service';

interface Team {
  id: string;
  name: string;
  created_at: string;
}

/**
 * Helper function to check permissions in addon components
 */
function canPerformAction(
  store: AddonStore,
  resource: ResourceType,
  action: Action
): boolean {
  const permissions = store.permissions?.matrix;
  if (!permissions || !permissions[resource]) {
    return false;
  }
  return permissions[resource].includes(action);
}

/**
 * Teams Addon Component with Permission Checks
 */
const TeamsAddon: Component<{ store: AddonStore }> = (props) => {
  const [teams, setTeams] = createSignal<Team[]>([]);
  const [loading, setLoading] = createSignal(false);

  // Translation helper
  const t = (key: string, params?: Record<string, any>) =>
    props.store.i18n?.t(key, params) || key;

  // Permission checks
  const canCreate = () => canPerformAction(props.store, 'teams', 'create');
  const canUpdate = () => canPerformAction(props.store, 'teams', 'update');
  const canDelete = () => canPerformAction(props.store, 'teams', 'delete');
  const canView = () => canPerformAction(props.store, 'teams', 'show');

  // Get user role
  const getUserRole = () => props.store.permissions?.role || 'guest';

  // Handlers
  const handleCreate = () => {
    if (!canCreate()) {
      console.warn('User does not have permission to create teams');
      return;
    }
    // Show create modal or form
    console.log('Creating team...');
  };

  const handleEdit = (team: Team) => {
    if (!canUpdate()) {
      console.warn('User does not have permission to update teams');
      return;
    }
    // Show edit modal or form
    console.log('Editing team:', team);
  };

  const handleDelete = (team: Team) => {
    if (!canDelete()) {
      console.warn('User does not have permission to delete teams');
      return;
    }
    // Show confirmation and delete
    console.log('Deleting team:', team);
  };

  return (
    <div>
      {/* Header with Create Button */}
      <div
        style={{
          display: 'flex',
          'justify-content': 'space-between',
          'margin-bottom': '1em',
        }}
      >
        <h2>{t('teams.title')}</h2>

        {/* Create button - Disabled if no permission */}
        <Button
          label={t('teams.create')}
          onClick={handleCreate}
          disabled={!canCreate()}
          color="primary"
          title={!canCreate() ? t('permissions.noCreateTeams') : undefined}
        />
      </div>

      {/* Show role indicator (for demo purposes) */}
      <div
        style={{
          'margin-bottom': '1em',
          padding: '0.5em',
          background: '#f0f0f0',
          'border-radius': '4px',
        }}
      >
        <strong>{t('common.role')}:</strong> {getUserRole()}
        <br />
        <strong>{t('permissions.capabilities')}:</strong>
        {canCreate() && ' Create'}
        {canUpdate() && ' Update'}
        {canDelete() && ' Delete'}
        {canView() && ' View'}
        {!canCreate() && !canUpdate() && !canDelete() && !canView() && ' None'}
      </div>

      {/* Teams List */}
      <div>
        <For each={teams()}>
          {(team) => (
            <div
              style={{
                border: '1px solid #ddd',
                padding: '1em',
                'margin-bottom': '0.5em',
                'border-radius': '4px',
                display: 'flex',
                'justify-content': 'space-between',
                'align-items': 'center',
              }}
            >
              <div>
                <strong>{team.name}</strong>
                <br />
                <small>{new Date(team.created_at).toLocaleDateString()}</small>
              </div>

              <div style={{ display: 'flex', gap: '0.5em' }}>
                {/* Edit Button - Disabled without update permission */}
                <Button
                  label={t('common.edit')}
                  onClick={() => handleEdit(team)}
                  disabled={!canUpdate()}
                  color="secondary"
                  title={
                    !canUpdate() ? t('permissions.noUpdateTeams') : undefined
                  }
                />

                {/* Delete Button - Disabled without delete permission */}
                <Button
                  label={t('common.delete')}
                  onClick={() => handleDelete(team)}
                  disabled={!canDelete()}
                  color="danger"
                  title={
                    !canDelete() ? t('permissions.noDeleteTeams') : undefined
                  }
                />
              </div>
            </div>
          )}
        </For>
      </div>

      {/* Empty State */}
      {teams().length === 0 && !loading() && (
        <div style={{ 'text-align': 'center', padding: '2em', color: '#666' }}>
          {t('teams.noTeams')}
        </div>
      )}
    </div>
  );
};

export default TeamsAddon;
