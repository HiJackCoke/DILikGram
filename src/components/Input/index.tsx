import { useState } from "react";
import InputView from "./View";
import type { InputProps } from "./types";

function formatNumberWithCommas(value: number): string {
  return value.toLocaleString("en-US");
}

export default function Input(props: InputProps) {
  const [isFocused, setIsFocused] = useState(false);

  // Format display value for numbers
  const displayValue = (() => {
    if (props.type === "number" && props.formatNumber && !isFocused) {
      return formatNumberWithCommas(props.value);
    }
    return String(props.value);
  })();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (props.type === "number") {
      const numValue = Number(e.target.value);
      if (!isNaN(numValue)) {
        // Apply min/max constraints
        let constrainedValue = numValue;
        if (props.min !== undefined && numValue < props.min) {
          constrainedValue = props.min;
        }
        if (props.max !== undefined && numValue > props.max) {
          constrainedValue = props.max;
        }
        props.onChange(constrainedValue);
      }
    } else {
      props.onChange(e.target.value);
    }
  };

  const handleIncrement = () => {
    if (props.type === "number") {
      const step = props.step ?? 1;
      const newValue = props.value + step;
      const constrainedValue =
        props.max !== undefined ? Math.min(newValue, props.max) : newValue;
      props.onChange(constrainedValue);
    }
  };

  const handleDecrement = () => {
    if (props.type === "number") {
      const step = props.step ?? 1;
      const newValue = props.value - step;
      const constrainedValue =
        props.min !== undefined ? Math.max(newValue, props.min) : newValue;
      props.onChange(constrainedValue);
    }
  };

  return (
    <InputView
      label={props.label}
      type={props.type}
      value={String(props.value)}
      displayValue={displayValue}
      placeholder={props.placeholder}
      required={props.required}
      disabled={props.disabled}
      readOnly={props.readOnly}
      status={props.status || "default"}
      errorMessage={props.errorMessage}
      isFocused={isFocused}
      onChange={handleChange}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      min={props.type === "number" ? props.min : undefined}
      max={props.type === "number" ? props.max : undefined}
      step={props.type === "number" ? props.step : undefined}
      onIncrement={props.type === "number" ? handleIncrement : undefined}
      onDecrement={props.type === "number" ? handleDecrement : undefined}
      formatNumber={props.type === "number" ? props.formatNumber : undefined}
    />
  );
}
