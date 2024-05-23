import { describe, it, expect } from 'vitest';
import { render, screen } from '@solidjs/testing-library';
import { Dropdown } from './dropdown';

// Define a sample props to use in tests
const sampleProps = {
  label: 'Test Dropdown',
  items: [
    { value: '1', name: 'Option 1' },
    { value: '2', name: 'Option 2' },
    { value: '3', name: 'Option 3' },
  ],
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

  // Add more tests here to cover other scenarios or edge cases
});
