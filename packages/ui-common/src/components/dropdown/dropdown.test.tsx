/** @jsxImportSource solid-js */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@solidjs/testing-library';
import { Dropdown } from './dropdown';

afterEach(() => {
  cleanup();
});

// Define a sample props to use in tests
const sampleProps = {
  label: 'Test Dropdown',
  items: [
    { value: '1', name: 'Option 1' },
    { value: '2', name: 'Option 2' },
    { value: '3', name: 'Option 3' },
  ],
  onSelectChange: vi.fn(),
};

describe('Dropdown Component', () => {
  it('renders correctly with props', async () => {
    render(() => <Dropdown {...sampleProps} />);

    // Check if the label is rendered correctly
    expect(screen.getByText(sampleProps.label)).toBeInTheDocument();

    // Check if all options are rendered
    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(sampleProps.items.length);

    // Check if options contain correct values and names
    sampleProps.items.forEach((item, index) => {
      expect(options[index]).toHaveTextContent(item.name);
      expect(options[index]).toHaveValue(item.value);
    });
  });

  it('supports placeholder state and emits null selection', async () => {
    const handleChange = vi.fn();
    const { container } = render(() => (
      <Dropdown
        {...sampleProps}
        placeholder="Select"
        defaultValue={null}
        onSelectChange={handleChange}
      />
    ));

    const select = container.querySelector('select') as HTMLSelectElement;
    expect(select).toHaveClass('is-placeholder');
    expect(select).toHaveValue('');

    fireEvent.change(select, { target: { value: '2' } });
    expect(handleChange).toHaveBeenCalledWith('2', 'Option 2');
  });

  // Add more tests here to cover other scenarios or edge cases
});
