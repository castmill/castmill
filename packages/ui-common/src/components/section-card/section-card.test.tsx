/** @jsxImportSource solid-js */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library';
import { BsGear } from 'solid-icons/bs';
import { SectionCard, SectionCardHeader } from './section-card';

describe('SectionCard', () => {
  afterEach(cleanup);

  it('renders the header, body and footer', () => {
    const onSave = vi.fn();
    render(() => (
      <SectionCard
        title="Settings"
        description="Name and orientation"
        icon={BsGear}
        count={3}
        class="custom-card"
        footerClass="custom-footer"
        actions={<button type="button">Refresh</button>}
        footer={
          <button type="button" onClick={onSave}>
            Save
          </button>
        }
      >
        <p>Body</p>
      </SectionCard>
    ));

    const card = document.querySelector('[data-section-card]')!;
    expect(card.tagName).toBe('SECTION');
    expect(card).toHaveClass('custom-card');
    expect(
      screen.getByRole('heading', { level: 3, name: /Settings/ })
    ).toHaveTextContent('3');
    expect(screen.getByText('Name and orientation')).toBeInTheDocument();
    expect(screen.getByText('Body')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument();
    expect(card.querySelector('svg')).toHaveAttribute('fill', 'currentColor');

    const footer = card.querySelector('footer')!;
    expect(footer).toHaveClass('custom-footer');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(screen.getAllByRole('button', { name: 'Save' })).toHaveLength(1);
  });

  it('omits optional parts', () => {
    render(() => <SectionCard title="Plain">Content</SectionCard>);
    const card = document.querySelector('[data-section-card]')!;
    expect(card.querySelector('footer')).toBeNull();
    expect(card.querySelector('p')).toBeNull();
    expect(card.querySelector('svg')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Plain' })).toBeInTheDocument();
  });

  it('renders a standalone header with a custom class', () => {
    render(() => (
      <SectionCardHeader title="Telemetry" class="bare" count={0} />
    ));
    const header = document.querySelector('header')!;
    expect(header).toHaveClass('bare');
    expect(screen.getByRole('heading')).toHaveTextContent('Telemetry0');
  });
});
