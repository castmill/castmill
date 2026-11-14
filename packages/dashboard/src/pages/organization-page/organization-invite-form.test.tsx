import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@solidjs/testing-library';
import { I18nProvider } from '../../i18n';
import { OrganizationInviteForm } from './organization-invite-form';

const renderForm = (onSubmit = vi.fn()) => {
  render(() => (
    <I18nProvider>
      <OrganizationInviteForm organizationId="org-1" onSubmit={onSubmit} />
    </I18nProvider>
  ));
  return onSubmit;
};

const typeEmail = (value: string) =>
  fireEvent.input(screen.getByLabelText('Email'), { target: { value } });

describe('OrganizationInviteForm', () => {
  it('invites addresses with dots, plus signs and subdomains', () => {
    const onSubmit = renderForm();

    typeEmail('taylor.brooks+signage@mail.example.co.uk');
    expect(screen.queryByText('Invalid email')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Add'));

    expect(onSubmit).toHaveBeenCalledWith(
      'taylor.brooks+signage@mail.example.co.uk',
      'member'
    );
  });

  it('rejects missing and malformed addresses', () => {
    const onSubmit = renderForm();

    typeEmail('taylor');
    expect(screen.getByText('Invalid email')).toBeInTheDocument();
    typeEmail('');
    expect(screen.getByText('Email is required')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Add'));

    expect(onSubmit).not.toHaveBeenCalled();
  });
});
