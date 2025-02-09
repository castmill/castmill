import { createSignal } from 'solid-js';
import { OrganizationRole } from '../../types/organization-role.type';
import { Button, Dropdown, FormItem } from '@castmill/ui-common';

import style from './organization-invite-form.module.scss';

export const OrganizationInviteForm = (props: {
  organizationId: string;
  onSubmit: (email: string, role: OrganizationRole) => void;
}) => {
  const [email, setEmail] = createSignal('');
  const [role, setRole] = createSignal<OrganizationRole>('regular');

  const [errors, setErrors] = createSignal(new Map());
  const [isFormValid, setIsFormValid] = createSignal(false);

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

  {
    /* Adding a new member just requires a valid email address */
  }
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (isFormValid()) {
          props.onSubmit(email(), role());
        }
      }}
    >
      <FormItem
        label="Name"
        id="name"
        value={email()!}
        placeholder="Enter member's email"
        onInput={(value: string | number | boolean) => {
          const strValue = value as string;
          setEmail(strValue);
          validateField('email', strValue);
        }}
      >
        <div class="error">{errors().get('email')}</div>
      </FormItem>
      <div class={style['form-input']}>
        <Dropdown
          label="Role"
          items={[
            {
              name: 'Admin',
              value: 'admin',
            },
            {
              name: 'Regular',
              value: 'regular',
            },
            {
              name: 'Guest',
              value: 'guest',
            },
          ]}
          onSelectChange={(value) => {
            setRole(value as OrganizationRole);
          }}
        />
      </div>
      <div class="form-actions">
        <Button
          label="Add"
          type="submit"
          disabled={!isFormValid()}
          color="primary"
        />
      </div>
    </form>
  );
};
