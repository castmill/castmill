import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, fireEvent, cleanup, screen } from '@solidjs/testing-library';
import { createSignal, JSX } from 'solid-js';

import Tabs, { TabItem } from './tabs';

import styles from './tabs.module.scss';

const TestIcon = (props: JSX.SvgSVGAttributes<SVGSVGElement>) => (
  <svg data-testid="tab-icon" {...props} />
);

describe('Tabs component', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  const sampleTabs: TabItem[] = [
    { title: 'Tab 1', content: () => <div>Content 1</div> },
    { title: 'Tab 2', content: () => <div>Content 2</div> },
    { title: 'Tab 3', content: () => <div>Content 3</div> },
  ];

  it('renders with initial tab active', () => {
    render(() => <Tabs tabs={sampleTabs} initialIndex={0} />);
    const activeButton = screen.getByRole('tab', { name: 'Tab 1' });
    expect(activeButton).toHaveClass(
      `${styles['tabButton']} ${styles['active']}`
    );
    expect(screen.getByText('Content 1')).toBeInTheDocument();
  });

  it('changes active tab on button click', async () => {
    render(() => <Tabs tabs={sampleTabs} />);
    const tab2Button = screen.getByRole('tab', { name: 'Tab 2' });
    await fireEvent.click(tab2Button);
    expect(tab2Button).toHaveClass(
      `${styles['tabButton']} ${styles['active']}`
    );
    expect(screen.getByText('Content 2')).toBeInTheDocument();
    expect(screen.queryByText('Content 1')).not.toBeInTheDocument();
  });

  it('renders correctly without initialIndex', () => {
    render(() => <Tabs tabs={sampleTabs} />);
    const firstTabButton = screen.getByRole('tab', { name: 'Tab 1' });
    expect(firstTabButton).toHaveClass(
      `${styles['tabButton']} ${styles['active']}`
    );
    expect(screen.getByText('Content 1')).toBeInTheDocument();
  });

  it('exposes tablist, tab and tabpanel semantics', () => {
    render(() => (
      <Tabs tabs={sampleTabs} initialIndex={1} ariaLabel="Sections" />
    ));
    const tablist = screen.getByRole('tablist', { name: 'Sections' });
    const tabs = screen.getAllByRole('tab');
    expect(tablist).toContainElement(tabs[0]);
    expect(tabs).toHaveLength(3);

    tabs.forEach((tab, index) => {
      expect(tab).toHaveAttribute('type', 'button');
      expect(tab).toHaveAttribute('aria-selected', String(index === 1));
      expect(tab).toHaveAttribute('tabindex', index === 1 ? '0' : '-1');
      expect(tab).toHaveAttribute('title', `Tab ${index + 1}`);
    });

    const panel = screen.getByRole('tabpanel');
    expect(tabs[1]).toHaveAttribute('aria-controls', panel.id);
    expect(panel).toHaveAttribute('aria-labelledby', tabs[1].id);
    expect(panel).toHaveAttribute('tabindex', '0');
    panel.focus();
    expect(panel).toHaveFocus();
    expect(panel).toHaveTextContent('Content 2');
  });

  it('gives each Tabs instance unique ids', () => {
    render(() => (
      <>
        <Tabs tabs={sampleTabs} />
        <Tabs tabs={sampleTabs} />
      </>
    ));
    const ids = screen.getAllByRole('tab').map((tab) => tab.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('supports reactive (function) titles', async () => {
    const [label, setLabel] = createSignal('Rules (1)');
    render(() => (
      <Tabs
        tabs={[{ title: () => label(), content: () => <div>Rules</div> }]}
      />
    ));
    expect(screen.getByRole('tab', { name: 'Rules (1)' })).toBeInTheDocument();
    setLabel('Rules (2)');
    expect(screen.getByRole('tab', { name: 'Rules (2)' })).toHaveAttribute(
      'title',
      'Rules (2)'
    );
  });

  it('navigates with arrow keys, wrapping around, and Home/End', async () => {
    render(() => <Tabs tabs={sampleTabs} />);
    const [tab1, tab2, tab3] = screen.getAllByRole('tab');

    await fireEvent.keyDown(tab1, { key: 'ArrowRight' });
    expect(tab2).toHaveAttribute('aria-selected', 'true');
    expect(tab2).toHaveFocus();
    expect(screen.getByText('Content 2')).toBeInTheDocument();

    await fireEvent.keyDown(tab2, { key: 'ArrowLeft' });
    expect(tab1).toHaveAttribute('aria-selected', 'true');

    await fireEvent.keyDown(tab1, { key: 'ArrowLeft' });
    expect(tab3).toHaveAttribute('aria-selected', 'true');
    expect(tab3).toHaveFocus();

    await fireEvent.keyDown(tab3, { key: 'ArrowRight' });
    expect(tab1).toHaveAttribute('aria-selected', 'true');

    await fireEvent.keyDown(tab1, { key: 'End' });
    expect(tab3).toHaveAttribute('aria-selected', 'true');

    await fireEvent.keyDown(tab3, { key: 'Home' });
    expect(tab1).toHaveAttribute('aria-selected', 'true');
    expect(tab1).toHaveFocus();
  });

  it('ignores unrelated keys', async () => {
    render(() => <Tabs tabs={sampleTabs} />);
    const [tab1] = screen.getAllByRole('tab');
    const event = new KeyboardEvent('keydown', {
      key: 'a',
      bubbles: true,
      cancelable: true,
    });
    tab1.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    expect(tab1).toHaveAttribute('aria-selected', 'true');
  });

  it('mirrors arrow keys in right-to-left layouts', async () => {
    render(() => (
      <div dir="rtl">
        <Tabs tabs={sampleTabs} />
      </div>
    ));
    const [tab1, tab2, tab3] = screen.getAllByRole('tab');

    await fireEvent.keyDown(tab1, { key: 'ArrowLeft' });
    expect(tab2).toHaveAttribute('aria-selected', 'true');

    await fireEvent.keyDown(tab2, { key: 'ArrowRight' });
    expect(tab1).toHaveAttribute('aria-selected', 'true');

    await fireEvent.keyDown(tab1, { key: 'ArrowRight' });
    expect(tab3).toHaveAttribute('aria-selected', 'true');
  });

  it('scrolls the active tab into view', async () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    render(() => <Tabs tabs={sampleTabs} initialIndex={2} />);
    const tabs = screen.getAllByRole('tab');
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView.mock.instances[0]).toBe(tabs[2]);
    expect(scrollIntoView).toHaveBeenCalledWith({
      block: 'nearest',
      inline: 'nearest',
    });

    await fireEvent.click(tabs[0]);
    expect(scrollIntoView).toHaveBeenCalledTimes(2);
    expect(scrollIntoView.mock.instances[1]).toBe(tabs[0]);
    delete (Element.prototype as Partial<Element>).scrollIntoView;
  });

  it('renders optional icons and keeps the full label for screen readers', () => {
    render(() => (
      <Tabs
        tabs={[
          { title: 'Template', icon: TestIcon, content: () => <div /> },
          { title: 'Assets', content: () => <div /> },
        ]}
      />
    ));
    const [withIcon, withoutIcon] = screen.getAllByRole('tab');
    const icon = screen.getByTestId('tab-icon');

    expect(withIcon).toContainElement(icon);
    expect(icon).toHaveAttribute('aria-hidden', 'true');
    expect(icon).toHaveClass(styles.tabIcon);
    // Only tabs with an icon may collapse to icon-only on small screens
    expect(withIcon).toHaveClass(styles.hasIcon);
    expect(withoutIcon).not.toHaveClass(styles.hasIcon);
    expect(withIcon).toHaveAccessibleName('Template');
    expect(withIcon.querySelector(`.${styles.tabLabel}`)).toHaveTextContent(
      'Template'
    );
  });

  it('marks the edges that hide overflowing tabs', async () => {
    render(() => <Tabs tabs={sampleTabs} />);
    const list = screen.getByRole('tablist');
    Object.defineProperty(list, 'clientWidth', { value: 100 });
    Object.defineProperty(list, 'scrollWidth', { value: 300 });

    await fireEvent.scroll(list);
    expect(list).not.toHaveAttribute('data-overflow-start');
    expect(list).toHaveAttribute('data-overflow-end');

    list.scrollLeft = 100;
    await fireEvent.scroll(list);
    expect(list).toHaveAttribute('data-overflow-start');
    expect(list).toHaveAttribute('data-overflow-end');

    list.scrollLeft = 200;
    await fireEvent.scroll(list);
    expect(list).toHaveAttribute('data-overflow-start');
    expect(list).not.toHaveAttribute('data-overflow-end');
  });

  it('re-measures overflow when the list or its tabs resize', async () => {
    const observed: Element[] = [];
    const disconnect = vi.fn();
    const unobserve = vi.fn();
    let callback: () => void = () => {};
    class MockResizeObserver {
      constructor(cb: () => void) {
        callback = cb;
      }
      observe(el: Element) {
        observed.push(el);
      }
      unobserve = unobserve;
      disconnect = disconnect;
    }
    vi.stubGlobal('ResizeObserver', MockResizeObserver);

    const [tabs, setTabs] = createSignal(sampleTabs.slice(0, 2));
    const { unmount } = render(() => <Tabs tabs={tabs()} />);
    const list = screen.getByRole('tablist');
    expect(observed).toEqual([list, ...screen.getAllByRole('tab')]);

    setTabs(sampleTabs);
    expect(observed).toContain(screen.getByRole('tab', { name: 'Tab 3' }));
    const removed = screen.getByRole('tab', { name: 'Tab 1' });
    setTabs(sampleTabs.slice(1));
    expect(unobserve).toHaveBeenCalledWith(removed);

    Object.defineProperty(list, 'clientWidth', { value: 100 });
    Object.defineProperty(list, 'scrollWidth', { value: 300 });
    callback();
    expect(list).toHaveAttribute('data-overflow-end');

    unmount();
    expect(disconnect).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('does not mark edges when all tabs fit', () => {
    render(() => <Tabs tabs={sampleTabs} />);
    const list = screen.getByRole('tablist');
    expect(list).not.toHaveAttribute('data-overflow-start');
    expect(list).not.toHaveAttribute('data-overflow-end');
  });

  it('keeps a valid selection when the tabs shrink', async () => {
    const [tabs, setTabs] = createSignal(sampleTabs);
    render(() => <Tabs tabs={tabs()} initialIndex={2} />);
    expect(screen.getByText('Content 3')).toBeInTheDocument();

    setTabs(sampleTabs.slice(0, 2));
    expect(screen.getByRole('tab', { name: 'Tab 2' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.getByText('Content 2')).toBeInTheDocument();
  });

  it('focuses and scrolls the current tab after removal and reordering', async () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    const [tabs, setTabs] = createSignal(sampleTabs);
    render(() => <Tabs tabs={tabs()} />);
    const [, tab2, tab3] = screen.getAllByRole('tab');

    setTabs([sampleTabs[1], sampleTabs[2]]);
    await fireEvent.keyDown(tab2, { key: 'ArrowRight' });
    expect(tab3).toHaveAttribute('aria-selected', 'true');
    expect(tab3).toHaveFocus();
    expect(scrollIntoView.mock.instances.at(-1)).toBe(tab3);

    setTabs([sampleTabs[2], sampleTabs[1], sampleTabs[0]]);
    const tab1 = screen.getByRole('tab', { name: 'Tab 1' });
    await fireEvent.keyDown(tab2, { key: 'End' });
    expect(tab1).toHaveAttribute('aria-selected', 'true');
    expect(tab1).toHaveFocus();
    expect(scrollIntoView.mock.instances.at(-1)).toBe(tab1);

    await fireEvent.click(tab3);
    expect(tab3).toHaveAttribute('aria-selected', 'true');
    expect(scrollIntoView.mock.instances.at(-1)).toBe(tab3);
    delete (Element.prototype as Partial<Element>).scrollIntoView;
  });

  it('renders an empty tab list without crashing', async () => {
    render(() => <Tabs tabs={[]} />);
    expect(screen.queryAllByRole('tab')).toHaveLength(0);
    expect(screen.getByRole('tabpanel')).toBeEmptyDOMElement();
  });
});
