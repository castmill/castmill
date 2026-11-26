import { Component, createSignal, Show } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import {
  Button,
  FormItem,
  Modal,
  SectionCard,
  useToast,
} from '@castmill/ui-common';

import { getUser } from '../../components/auth';
import { OrganizationsService } from '../../services/organizations.service';
import { setStore } from '../../store';
import { useI18n } from '../../i18n';
import styles from './delete-organization.module.scss';

interface DeleteOrganizationProps {
  organizationId: string;
  organizationName: string;
}

/**
 * Deletes the organization for good. The admin must type the organization's
 * name, which the server checks too.
 */
export const DeleteOrganization: Component<DeleteOrganizationProps> = (
  props
) => {
  const { t } = useI18n();
  const toast = useToast();
  const navigate = useNavigate();

  const [open, setOpen] = createSignal(false);
  const [typedName, setTypedName] = createSignal('');
  const [deleting, setDeleting] = createSignal(false);

  const nameMatches = () => typedName() === props.organizationName;

  const close = () => {
    if (deleting()) return;
    setOpen(false);
    setTypedName('');
  };

  const errorMessage = (error: unknown) => {
    switch ((error as { code?: string })?.code) {
      case 'has_child_organizations':
        return t('organization.delete.errorChildren');
      case 'confirmation_mismatch':
        return t('organization.delete.errorName');
      default:
        return t('organization.delete.errorGeneric');
    }
  };

  const handleDelete = async () => {
    if (!nameMatches() || deleting()) return;
    setDeleting(true);

    try {
      await OrganizationsService.deleteOrganization(
        props.organizationId,
        typedName()
      );
      toast.success(
        t('organization.delete.deleted', { name: props.organizationName })
      );

      const user = getUser();
      const organizations = user?.id
        ? await OrganizationsService.getAll(user.id)
        : [];

      setStore('organizations', {
        data: organizations,
        loaded: true,
        loading: false,
        selectedId: null,
        selectedName: '',
      });

      setDeleting(false);
      setOpen(false);
      navigate(organizations[0] ? `/org/${organizations[0].id}` : '/', {
        replace: true,
      });
    } catch (error) {
      setDeleting(false);
      toast.error(errorMessage(error));
    }
  };

  return (
    <>
      <SectionCard
        class={styles.card}
        title={t('organization.delete.title')}
        description={t('organization.delete.description')}
      >
        <Button
          label={t('organization.delete.action')}
          color="danger"
          onClick={() => setOpen(true)}
        />
      </SectionCard>

      <Show when={open()}>
        <Modal
          title={t('organization.delete.confirmTitle', {
            name: props.organizationName,
          })}
          description={t('organization.delete.confirmDescription')}
          onClose={close}
        >
          <form
            class={styles.form}
            onSubmit={(e) => {
              e.preventDefault();
              handleDelete();
            }}
          >
            <ul class={styles.consequences}>
              <li>{t('organization.delete.consequenceContent')}</li>
              <li>{t('organization.delete.consequenceDevices')}</li>
              <li>{t('organization.delete.consequenceMembers')}</li>
            </ul>
            <FormItem
              label={t('organization.delete.typeName', {
                name: props.organizationName,
              })}
              id="delete-organization-name"
              value={typedName()}
              placeholder={props.organizationName}
              autofocus
              onInput={(value) => setTypedName(String(value))}
            />
            <div class={styles.actions} data-modal-actions>
              <Button
                type="submit"
                color="danger"
                label={
                  deleting()
                    ? t('organization.delete.deleting')
                    : t('organization.delete.confirmAction')
                }
                disabled={!nameMatches() || deleting()}
              />
              <Button
                label={t('common.cancel')}
                onClick={close}
                disabled={deleting()}
              />
            </div>
          </form>
        </Modal>
      </Show>
    </>
  );
};
