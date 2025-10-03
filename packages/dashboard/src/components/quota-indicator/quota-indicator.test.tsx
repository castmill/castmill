import { render } from '@solidjs/testing-library';
import { describe, it, expect } from 'vitest';
import { QuotaIndicator } from './quota-indicator';

describe('QuotaIndicator', () => {
  it('renders with normal state when usage is low', () => {
    const { container, getByText } = render(() => (
      <QuotaIndicator used={10} total={100} resourceName="Playlists" />
    ));

    expect(getByText('10 of 100 Playlists')).toBeTruthy();
    expect(getByText('10%')).toBeTruthy();
    expect(container.querySelector('.quota-indicator--normal')).toBeTruthy();
  });

  it('renders with warning state when usage is high', () => {
    const { container, getByText } = render(() => (
      <QuotaIndicator used={95} total={100} resourceName="Medias" />
    ));

    expect(getByText('95 of 100 Medias')).toBeTruthy();
    expect(getByText('95%')).toBeTruthy();
    expect(container.querySelector('.quota-indicator--warning')).toBeTruthy();
  });

  it('renders with error state when quota is reached', () => {
    const { container, getByText } = render(() => (
      <QuotaIndicator used={100} total={100} resourceName="Devices" />
    ));

    expect(getByText('100 of 100 Devices')).toBeTruthy();
    expect(getByText('100%')).toBeTruthy();
    expect(container.querySelector('.quota-indicator--error')).toBeTruthy();
  });

  it('renders compact variant correctly', () => {
    const { container, getByText } = render(() => (
      <QuotaIndicator used={50} total={100} resourceName="Channels" compact />
    ));

    expect(getByText('50/100 Channels')).toBeTruthy();
    expect(container.querySelector('.quota-indicator--compact')).toBeTruthy();
  });

  it('handles custom warning threshold', () => {
    const { container } = render(() => (
      <QuotaIndicator
        used={80}
        total={100}
        resourceName="Teams"
        warningThreshold={75}
      />
    ));

    expect(container.querySelector('.quota-indicator--warning')).toBeTruthy();
  });

  it('handles zero total gracefully', () => {
    const { getByText } = render(() => (
      <QuotaIndicator used={0} total={0} resourceName="Items" />
    ));

    expect(getByText('0%')).toBeTruthy();
  });
});
