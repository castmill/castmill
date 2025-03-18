/** @jsxImportSource solid-js */
import { createSignal, createEffect } from 'solid-js';
import styles from './slider.module.scss';

export const Slider = (props: {
  name: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  onChange?: (value: number) => void;
  onSlideStop?: (value: number) => void;
  formatValue?: (value: number) => string;
}) => {
  const [sliderValue, setSliderValue] = createSignal(props.value);
  const [tooltipVisible, setTooltipVisible] = createSignal(false);

  const applyFormatting = (value: number) => {
    return props.formatValue ? props.formatValue(value) : value;
  };

  const handleInput = (event: Event) => {
    const newValue = parseFloat((event.target as HTMLInputElement).value);
    setSliderValue(newValue);
    props.onChange?.(newValue);
  };

  return (
    <div class={styles.sliderContainer}>
      <label class={styles.filterLabel}>
        {props.name}: {applyFormatting(sliderValue())}
      </label>
      <div class={styles.sliderWrapper}>
        <input
          type="range"
          min={props.min ?? 0}
          max={props.max ?? 60000} // Default max 60s
          step={props.step ?? 1000} // Default step 1s
          value={sliderValue()}
          disabled={props.disabled}
          onInput={handleInput}
          onPointerDown={(e) => {
            setTooltipVisible(true);
          }}
          onPointerUp={(e) => {
            setTooltipVisible(false);
            props.onSlideStop?.(sliderValue());
          }}
          class={styles.slider}
        />
        <div
          class={styles.tooltip}
          style={{
            left: `${(sliderValue() / (props.max ?? 60000)) * 100}%`,
            opacity: tooltipVisible() ? 1 : 0,
          }}
        >
          {applyFormatting(sliderValue())}
        </div>
      </div>
    </div>
  );
};
