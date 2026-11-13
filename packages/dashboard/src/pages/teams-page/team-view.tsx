import { createSignal, createEffect, Show, on, onCleanup } from 'solid-js';

import {
  Button,
  DetailsSummary,
  DetailsSummaryPill,
  Drawer,
  FormItem,
  formatRelativeTimeLocalized,
} from '@castmill/ui-common';
import { usePermissions } from '../../hooks/usePermissions';

import { BsCheckLg, BsX } from 'solid-icons/bs';
import { JsonTeam } from '../../interfaces/team';
import { TeamsService, TeamUpdate } from '../../services/teams.service';
import { TeamResourcesView } from './team-resources-view';
import { useI18n } from '../../i18n';

import styles from './teams-page.module.scss';

export const MIN_TEAM_NAME_LENGTH = 5;

/**
 * Team shown in the details drawer. Teams fetched from the API use snake_case
 * timestamps, while older callers pass camelCase ones.
 */
export type TeamDetails = Omit<TeamUpdate, 'id'> & {
  id?: number;
  inserted_at?: string;
  updated_at?: string;
};

export const TeamView = (props: {
  organizationId: string;
  team: TeamDetails;
  title: string;
  onClose: () => void;
  onSubmit: (teamUpdate: TeamUpdate) => Promise<JsonTeam | void>;
}) => {
  const { t, locale } = useI18n();
  const { canPerformAction } = usePermissions();
  const [teamId, setTeamId] = createSignal<number | undefined>(props.team.id);
  const [name, setName] = createSignal(props.team.name || '');
  const [memberCount, setMemberCount] = createSignal<number>();
  const [saving, setSaving] = createSignal(false);
  // Re-render relative timestamps every minute.
  const [now, setNow] = createSignal(Date.now());
  const timer = setInterval(() => setNow(Date.now()), 60000);
  onCleanup(() => clearInterval(timer));

  const [isFormModified, setIsFormModified] = createSignal(false);
  const [errors, setErrors] = createSignal(new Map());

  const formId = () => `team-form-${props.team.id ?? 'new'}`;

  const loadMemberCount = async (id: number) => {
    try {
      const result = await TeamsService.fetchMembers(props.organizationId, id, {
        page: { num: 1, size: 1 },
        sortOptions: { direction: 'ascending' },
      });
      if (teamId() === id) {
        setMemberCount(result?.count);
      }
    } catch (error) {
      console.error('Failed to fetch team member count:', error);
    }
  };

  createEffect(
    on(
      () => props.team.id,
      () => {
        setTeamId(props.team.id);
        setName(props.team.name || '');
        setErrors(new Map());
        setIsFormModified(false);
        setMemberCount(undefined);
        if (props.team.id) {
          loadMemberCount(props.team.id);
        }
      }
    )
  );

  // Check if user can update teams (for existing teams) or create teams (for new teams)
  const canEdit = () => {
    if (props.team.id) {
      // Editing existing team requires update permission
      return canPerformAction('teams', 'update');
    } else {
      // Creating new team requires create permission
      return canPerformAction('teams', 'create');
    }
  };

  const validateField = (fieldId: string, value: string) => {
    let error = '';
    switch (fieldId) {
      case 'name':
        if (!value) {
          error = t('teams.errors.nameRequired');
        } else if (value.length < MIN_TEAM_NAME_LENGTH) {
          error = t('teams.errors.nameMinLength', {
            min: MIN_TEAM_NAME_LENGTH,
          });
        }
        break;
      default:
        error = '';
    }

    setErrors((prev) => new Map(prev).set(fieldId, error));
    return !error;
  };

  createEffect(() => {
    setIsFormModified(name() !== (props.team.name || ''));
  });

  const isFormValid = () => {
    return (
      ![...errors().values()].some((e) => e) && isFormModified() && canEdit()
    );
  };

  const resetForm = () => {
    setName(props.team.name || '');
    setErrors(new Map());
    setIsFormModified(false);
  };

  const submit = async () => {
    if (!isFormValid() || saving()) {
      return;
    }
    setSaving(true);
    try {
      const team = await props.onSubmit({
        id: props.team.id!,
        name: name(),
      });

      setIsFormModified(false);
      if (team) {
        setTeamId(team.id);
      }
    } finally {
      setSaving(false);
    }
  };

  const insertedAt = () => props.team.inserted_at ?? props.team.insertedAt;
  const updatedAt = () => props.team.updated_at ?? props.team.updatedAt;

  const timestamps = () => {
    now();
    return [
      insertedAt() &&
        t('teams.created', {
          time: formatRelativeTimeLocalized(insertedAt()!, locale()),
        }),
      updatedAt() &&
        t('teams.updated', {
          time: formatRelativeTimeLocalized(updatedAt()!, locale()),
        }),
    ]
      .filter(Boolean)
      .join(' · ');
  };

  const summaryPills = (): DetailsSummaryPill[] => {
    const pills: DetailsSummaryPill[] = [
      {
        label: <span class={styles.summaryName}>{props.team.name}</span>,
        title: props.team.name,
        tone: 'neutral',
      },
    ];
    const count = memberCount();
    if (count !== undefined) {
      pills.push({
        label: (
          <>
            {t('teams.members')} <strong>{count}</strong>
          </>
        ),
        tone: 'info',
      });
    }
    return pills;
  };

  return (
    <Drawer
      title={props.title}
      closeButtonTitle={t('common.close')}
      onClose={props.onClose}
      placement="right"
      size="xl"
      closeOnOutsideClick
      outsideClickIgnoreSelector="tbody tr"
      footer={
        canEdit() ? (
          <div class={styles.teamFooter} data-testid="team-footer">
            <span class={styles.teamDirty} aria-live="polite">
              {isFormModified() ? t('teams.unsavedChanges') : ''}
            </span>
            <Button
              label={t('common.reset')}
              disabled={!isFormModified() || saving()}
              onClick={resetForm}
              icon={BsX}
              color="secondary"
            />
            <Button
              label={props.team.id ? t('common.save') : t('common.create')}
              type="submit"
              form={formId()}
              disabled={!isFormValid()}
              loading={saving()}
              icon={BsCheckLg}
              color="success"
            />
          </div>
        ) : undefined
      }
    >
      <div class={styles.teamView}>
        <Show when={props.team.id}>
          <DetailsSummary
            class={styles.teamSummary}
            label={t('teams.summary')}
            compact
            pills={summaryPills()}
            note={timestamps()}
          />
        </Show>
        <form
          id={formId()}
          class={styles.teamForm}
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <FormItem
            label={t('common.name')}
            id="name"
            value={name()!}
            placeholder={t('teams.enterTeamName')}
            disabled={!canEdit()}
            autofocus={!props.team.id}
            onInput={(value: string | number | boolean) => {
              const strValue = value as string;
              setName(strValue);
              validateField('name', strValue);
            }}
          >
            <div class="error">{errors().get('name')}</div>
          </FormItem>
        </form>

        <Show when={teamId()}>
          <TeamResourcesView
            organizationId={props.organizationId}
            teamId={teamId()!}
            onRemove={() => {
              loadMemberCount(teamId()!);
            }}
          />
        </Show>
      </div>
    </Drawer>
  );
};
