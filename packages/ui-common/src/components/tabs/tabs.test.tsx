import { describe, it, expect, afterEach } from 'vitest';
import { render, fireEvent, cleanup, screen } from '@solidjs/testing-library';

import Tabs, { TabItem } from './tabs';

import styles from './tabs.module.scss';

describe('Tabs component', () => {
  afterEach(() => cleanup());

  const sampleTabs: TabItem[] = [
    { title: 'Tab 1', content: () => <div>Content 1</div> },
    { title: 'Tab 2', content: () => <div>Content 2</div> },
    { title: 'Tab 3', content: () => <div>Content 3</div> },
  ];

  it('renders with initial tab active', () => {
    render(() => <Tabs tabs={sampleTabs} initialIndex={0} />);
    const activeButton = screen.getByRole('button', { name: 'Tab 1' });
    expect(activeButton).toHaveClass(
      `${styles['tabButton']} ${styles['active']}`
    );
    expect(screen.getByText('Content 1')).toBeInTheDocument();
  });

  it('changes active tab on button click', async () => {
    render(() => <Tabs tabs={sampleTabs} />);
    const tab2Button = screen.getByRole('button', { name: 'Tab 2' });
    await fireEvent.click(tab2Button);
    expect(tab2Button).toHaveClass(
      `${styles['tabButton']} ${styles['active']}`
    );
    expect(screen.getByText('Content 2')).toBeInTheDocument();
    expect(screen.queryByText('Content 1')).not.toBeInTheDocument();
  });

  it('renders correctly without initialIndex', () => {
    render(() => <Tabs tabs={sampleTabs} />);
    const firstTabButton = screen.getByRole('button', { name: 'Tab 1' });
    expect(firstTabButton).toHaveClass(
      `${styles['tabButton']} ${styles['active']}`
    );
    expect(screen.getByText('Content 1')).toBeInTheDocument();
  });
});
