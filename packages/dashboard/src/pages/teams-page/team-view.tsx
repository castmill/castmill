import { createSignal, createEffect, Show } from 'solid-js';

import { Button, FormItem } from '@castmill/ui-common';

import { BsCheckLg, BsX } from 'solid-icons/bs';
import { JsonTeam } from '../../interfaces/team';
import { TeamUpdate } from '../../services/teams.service';
import { TeamResourcesView } from './team-resources-view';

import styles from './teams-page.module.scss';

export const TeamView = (props: {
  organizationId: string;
  team: Omit<TeamUpdate, 'id'> & { id?: number };
  onSubmit: (teamUpdate: TeamUpdate) => Promise<JsonTeam | void>;
}) => {
  const [teamId, setTeamId] = createSignal<number | undefined>(props.team.id);
  const [name, setName] = createSignal(props.team.name);

  const [isFormModified, setIsFormModified] = createSignal(false);
  const [errors, setErrors] = createSignal(new Map());

  const validateField = (fieldId: string, value: string) => {
    let error = '';
    switch (fieldId) {
      case 'name':
        if (!value) {
          error = 'Name is required';
        } else if (value.length < 5) {
          error = 'Name must be at least 5 characters';
        }
        break;
      default:
        error = '';
    }

    setErrors((prev) => new Map(prev).set(fieldId, error));
    return !error;
  };

  createEffect(() => {
    // We need to check both fields or create effect will not detect the dependencies.
    const hasModifiedName = name() !== props.team.name;
    setIsFormModified(hasModifiedName);
  });

  const isFormValid = () => {
    return ![...errors().values()].some((e) => e) && isFormModified();
  };

  return (
    <div style="width: 60vw;">
      <div class="info">
        <Show when={props.team.insertedAt}>
          <span>Added on </span> <span>{`${props.team.insertedAt}`}. </span>
        </Show>
        <Show when={props.team.updatedAt}>
          <span>Last updated on </span>
          <span>{`${props.team.updatedAt}`}</span>
        </Show>
      </div>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (isFormValid()) {
            const team = await props.onSubmit({
              id: props.team.id!,
              name: name(),
            });

            setIsFormModified(false);
            if (team) {
              setTeamId(team.id);
            }
          }
        }}
      >
        <div class="form-inputs">
          <FormItem
            label="Name"
            id="name"
            value={name()!}
            placeholder="Enter media name"
            onInput={(value: string | number | boolean) => {
              const strValue = value as string;
              setName(strValue);
              validateField('name', strValue);
            }}
          >
            <div class="error">{errors().get('name')}</div>
          </FormItem>
        </div>

        {/* TableView for members */}
        <Show when={teamId()}>
          <TeamResourcesView
            organizationId={props.organizationId}
            teamId={teamId()!}
            onRemove={(member) => {
              console.log('Remove member', member);
            }}
          />
        </Show>

        <div class={styles['actions']}>
          <Button
            label={props.team.id ? 'Update' : 'Create'}
            type="submit"
            disabled={!isFormValid()}
            icon={BsCheckLg}
            color="success"
          />
          <Button
            label="Reset"
            onClick={() => {
              setName(props.team.name);
              setIsFormModified(false);
            }}
            icon={BsX}
            color="danger"
          />
        </div>
      </form>
    </div>
  );
};
