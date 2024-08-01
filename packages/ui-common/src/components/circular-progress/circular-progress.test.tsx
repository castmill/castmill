import { describe, it, expect } from 'vitest';
import { render } from '@solidjs/testing-library';

import { createSignal } from 'solid-js';

import { CircularProgress } from './circular-progress';

describe('CircularProgress Component', () => {
  it('renders correctly with initial props', () => {
    const { container } = render(() => <CircularProgress progress={50} />);
    const svg = container.querySelector('svg');
    const span = container.querySelector('span');

    // Check if SVG and span exist
    expect(svg).not.toBeNull();
    expect(span).not.toBeNull();

    // Check if the text inside the span is correct
    expect(span?.textContent).toBe('50%');
  });

  it('correctly calculates stroke-dashoffset', () => {
    const { container } = render(() => <CircularProgress progress={75} />);
    const progressCircle = container.querySelector('circle:nth-of-type(2)'); // Selects the second circle for progress

    const expectedOffset = 2 * Math.PI * 1.2 * 0.25; // As the progress is 75%, the offset should be 25% of the circumference
    expect(progressCircle).toHaveAttribute(
      'stroke-dashoffset',
      expectedOffset.toString()
    );
  });

  it('displays the correct progress text', () => {
    const { getByText } = render(() => <CircularProgress progress={30} />);

    // Check if correct progress text is rendered
    expect(getByText('30%')).toBeInTheDocument();
  });

  it('updates correctly when props change', () => {
    const [progress, setProgress] = createSignal(20);
    const { getByText } = render(() => (
      <CircularProgress progress={progress()} />
    ));

    // Initially, the progress should be 20%
    expect(getByText('20%')).toBeInTheDocument();

    // Update the progress
    setProgress(90);

    // Check if the text updates correctly to 90%
    expect(getByText('90%')).toBeInTheDocument();
  });
});
