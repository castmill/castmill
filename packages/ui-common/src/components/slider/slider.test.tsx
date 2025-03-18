import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, cleanup, screen } from '@solidjs/testing-library';

import { Slider } from './slider';
import styles from './slider.module.scss';

describe('Slider component', () => {
  afterEach(() => cleanup());

  it('renders with correct initial value and updates on input', async () => {
    const onChange = vi.fn();
    render(() => (
      <Slider
        name="Test Slider"
        key="testKey"
        value={50}
        min={0}
        max={100}
        step={1}
        disabled={false}
        onChange={onChange}
      />
    ));

    const slider = screen.getByRole('slider');
    expect(slider).toHaveValue('50');

    await fireEvent.input(slider, { target: { value: '75' } });
    expect(onChange).toHaveBeenCalledWith(75);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('renders as disabled when the disabled prop is true', () => {
    render(() => (
      <Slider
        name="Disabled Slider"
        key="disabledKey"
        value={50}
        disabled={true}
        onChange={() => {}}
      />
    ));

    const slider = screen.getByRole('slider');
    expect(slider).toBeDisabled();
  });

  it('does not call onChange when disabled', async () => {
    const onChange = vi.fn();
    render(() => (
      <Slider
        name="Non-updating Slider"
        key="noupdateKey"
        value={30}
        disabled={true}
        onChange={onChange}
      />
    ));

    const slider = screen.getByRole('slider');
    expect(slider).toHaveValue('30');
    expect(slider).toBeDisabled();

    await fireEvent.input(slider, { target: { value: '60' } });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('reflects value correctly and updates on user interaction', async () => {
    const onChange = vi.fn();
    render(() => (
      <Slider
        name="Active Slider"
        key="activeKey"
        value={20}
        min={0}
        max={100}
        step={5}
        disabled={false}
        onChange={onChange}
      />
    ));

    const slider = screen.getByRole('slider');
    expect(slider).toHaveValue('20');

    await fireEvent.input(slider, { target: { value: '40' } });
    expect(onChange).toHaveBeenCalledWith(40);
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
