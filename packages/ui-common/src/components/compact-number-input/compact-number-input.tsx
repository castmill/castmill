import { Component, createSignal, createEffect } from 'solid-js';
import styles from './compact-number-input.module.scss';

interface CompactNumberInputProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  precision?: number;
  disabled?: boolean;
}

/**
 * A compact number input designed for coordinate/dimension values
 * in space-constrained containers. Features:
 * - Integrated label
 * - Compact display
 * - Mouse drag to adjust value
 * - Direct input editing
 */
export const CompactNumberInput: Component<CompactNumberInputProps> = (
  props
) => {
  const [inputEl, setInputEl] = createSignal<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = createSignal(false);
  const [isEditing, setIsEditing] = createSignal(false);
  const [dragStartX, setDragStartX] = createSignal(0);
  const [dragStartValue, setDragStartValue] = createSignal(0);

  const precision = () => props.precision ?? 1;
  const step = () => props.step ?? 1;
  const min = () => props.min ?? -Infinity;
  const max = () => props.max ?? Infinity;

  // Format value for display
  const displayValue = () => {
    const val = props.value;
    if (precision() === 0) return Math.round(val).toString();
    return val.toFixed(precision());
  };

  // Keep input in sync with value
  createEffect(() => {
    const el = inputEl();
    if (el && !isEditing()) {
      el.value = displayValue();
    }
  });

  const clampValue = (val: number): number => {
    return Math.max(min(), Math.min(max(), val));
  };

  const handleMouseDown = (e: MouseEvent) => {
    if (props.disabled || isEditing()) return;

    setIsDragging(true);
    setDragStartX(e.clientX);
    setDragStartValue(props.value);

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    // Prevent text selection while dragging
    e.preventDefault();
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging()) return;

    const delta = e.clientX - dragStartX();
    const sensitivity = e.shiftKey ? 0.1 : 1; // Hold shift for fine control
    const newValue = dragStartValue() + delta * step() * sensitivity;

    props.onChange(clampValue(Math.round(newValue * 10) / 10));
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  const handleDoubleClick = () => {
    if (props.disabled) return;
    setIsEditing(true);

    // Focus and select the input
    setTimeout(() => {
      const el = inputEl();
      if (el) {
        el.focus();
        el.select();
      }
    }, 0);
  };

  const commitValue = () => {
    const el = inputEl();
    if (el) {
      const newValue = parseFloat(el.value);
      if (!isNaN(newValue)) {
        const clampedValue = clampValue(newValue);
        props.onChange(clampedValue);
        // Update the input to show the clamped value
        el.value = clampedValue.toFixed(precision());
      } else {
        // Reset to current value if invalid
        el.value = displayValue();
      }
    }
  };

  const handleInputBlur = () => {
    if (isEditing()) {
      commitValue();
    }
    setIsEditing(false);
  };

  const handleInputKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      commitValue();
      setIsEditing(false);
      (e.target as HTMLInputElement).blur();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      const el = inputEl();
      if (el) {
        el.value = displayValue();
        el.blur();
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const increment = e.shiftKey ? step() * 10 : step();
      props.onChange(clampValue(props.value + increment));
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const decrement = e.shiftKey ? step() * 10 : step();
      props.onChange(clampValue(props.value - decrement));
    }
  };

  return (
    <div
      class={`${styles.container} ${isDragging() ? styles.dragging : ''} ${isEditing() ? styles.editing : ''} ${props.disabled ? styles.disabled : ''}`}
      onMouseDown={handleMouseDown}
      onDblClick={handleDoubleClick}
    >
      <span class={styles.label}>{props.label}</span>
      <input
        ref={setInputEl}
        type="text"
        inputMode="decimal"
        class={styles.input}
        value={displayValue()}
        disabled={props.disabled}
        onBlur={handleInputBlur}
        onKeyDown={handleInputKeyDown}
        onClick={(e) => isEditing() && e.stopPropagation()}
        onMouseDown={(e) => isEditing() && e.stopPropagation()}
      />
    </div>
  );
};
