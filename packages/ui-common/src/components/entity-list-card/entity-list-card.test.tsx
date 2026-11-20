/** @jsxImportSource solid-js */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, fireEvent, cleanup, screen } from '@solidjs/testing-library';
import { BsImage } from 'solid-icons/bs';
import {
  EntityCardMetaIcon,
  EntityCardNotice,
  EntityCardStatus,
  EntityCardThumbnail,
  EntityListCard,
} from './entity-list-card';

describe('EntityListCard', () => {
  afterEach(cleanup);

  it('renders title, subtitle, non-empty meta and footer', () => {
    const { container } = render(() => (
      <EntityListCard
        title="Lobby screen"
        titleText="Lobby screen"
        subtitle="Main entrance"
        meta={['1.2 MB', false, null, undefined, '', <b>Online</b>]}
        footer={<EntityCardNotice tone="danger">Offline</EntityCardNotice>}
      />
    ));
    expect(screen.getByText('Lobby screen')).toHaveAttribute(
      'title',
      'Lobby screen'
    );
    expect(screen.getByText('Main entrance')).toBeInTheDocument();
    expect(container.querySelectorAll('[class*="meta-item"]')).toHaveLength(2);
    expect(screen.getByText('Offline').closest('[data-tone]')).toHaveAttribute(
      'data-tone',
      'danger'
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('omits empty optional slots', () => {
    const { container } = render(() => <EntityListCard title="Name" />);
    expect(container.querySelector('[class*="subtitle"]')).toBeNull();
    expect(container.querySelector('[class*="meta"]')).toBeNull();
    expect(container.querySelector('[class*="footer"]')).toBeNull();
    expect(container.querySelector('[class*="visual"]')).toBeNull();
  });

  it('opens, selects and exposes actions independently', async () => {
    const onOpen = vi.fn();
    const onChange = vi.fn();
    const onAction = vi.fn();
    const { container } = render(() => (
      <EntityListCard
        title="Playlist"
        onOpen={onOpen}
        selection={{ checked: true, onChange, label: 'Select Playlist' }}
        actions={<button onClick={onAction}>More</button>}
      />
    ));
    const card = container.querySelector('[data-entity-card]')!;
    expect(card.className).toMatch(/selected/);
    expect(card.className).toMatch(/openable/);

    await fireEvent.click(screen.getByRole('button', { name: 'Playlist' }));
    expect(onOpen).toHaveBeenCalledTimes(1);

    await fireEvent.input(
      screen.getByRole('checkbox', { name: 'Select Playlist' }),
      { target: { checked: false } }
    );
    expect(onChange).toHaveBeenCalledWith(false);

    await fireEvent.click(screen.getByRole('button', { name: 'More' }));
    expect(onAction).toHaveBeenCalled();
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('disables opening and selection, and marks busy cards', () => {
    const { container } = render(() => (
      <EntityListCard
        title="Media"
        onOpen={vi.fn()}
        disabled
        busy
        selection={{ checked: false, onChange: vi.fn(), label: 'Select' }}
      />
    ));
    const card = container.querySelector('[data-entity-card]')!;
    expect(card).toHaveAttribute('aria-disabled', 'true');
    expect(card).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox')).toBeDisabled();
  });
});

describe('EntityCardThumbnail', () => {
  afterEach(cleanup);

  it('falls back to the icon when there is no image or it fails', async () => {
    const { container } = render(() => (
      <>
        <EntityCardThumbnail fallbackIcon={BsImage} />
        <EntityCardThumbnail
          src="/broken.png"
          alt="Preview"
          fallbackGlyph="🖼"
        />
      </>
    ));
    expect(container.querySelectorAll('svg')).toHaveLength(1);
    const img = screen.getByAltText('Preview');
    await fireEvent.error(img);
    expect(screen.queryByAltText('Preview')).not.toBeInTheDocument();
    expect(screen.getByText('🖼')).toBeInTheDocument();
  });
});

describe('EntityCardStatus', () => {
  afterEach(cleanup);

  it('renders a tone dot with a label', () => {
    render(() => <EntityCardStatus tone="success">Online</EntityCardStatus>);
    expect(screen.getByText('Online')).toHaveAttribute('data-tone', 'success');
  });
});

describe('EntityListCard slots', () => {
  afterEach(cleanup);

  it('renders slot content exactly once', () => {
    let created = 0;
    const Action = () => {
      created++;
      return <button type="button">More</button>;
    };
    render(() => <EntityListCard title="Card" actions={<Action />} />);
    expect(created).toBe(1);
    expect(screen.getAllByRole('button', { name: 'More' })).toHaveLength(1);
  });

  it('shows notice details as visible text', () => {
    render(() => (
      <EntityCardNotice tone="danger" detail="Unsupported codec">
        Failed
      </EntityCardNotice>
    ));
    expect(screen.getByText('Failed')).toBeInTheDocument();
    expect(screen.getByText('Unsupported codec')).toBeInTheDocument();
  });

  it('labels metadata icons for assistive technology', () => {
    render(() => <EntityCardMetaIcon icon={BsImage} label="JPEG" />);
    expect(screen.getByRole('img', { name: 'JPEG' })).toBeInTheDocument();
  });
});
