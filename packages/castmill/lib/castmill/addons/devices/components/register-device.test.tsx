import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@solidjs/testing-library';
import RegisterDevice from './register-device';

describe('RegisterDevice QR registration', () => {
  it('prefills the pincode and only requires a name before registering', () => {
    const onSubmit = vi.fn();
    render(() => (
      <RegisterDevice
        pincode="XUFUG53BKL"
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />
    ));

    expect(screen.getByLabelText('devices.pincode')).toHaveValue('XUFUG53BKL');
    expect(screen.getByLabelText('devices.pincode')).toBeDisabled();
    const register = screen.getByRole('button', { name: 'devices.register' });
    expect(register).toBeDisabled();
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.input(screen.getByLabelText('common.name'), {
      target: { value: 'Lobby display' },
    });
    expect(register).toBeEnabled();
    fireEvent.click(register);

    expect(onSubmit).toHaveBeenCalledWith({
      name: 'Lobby display',
      pincode: 'XUFUG53BKL',
    });
  });
});
