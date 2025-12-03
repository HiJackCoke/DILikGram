import { useState } from "react";
import TextAreaView from "./View";
import type { TextAreaProps } from "./types";

export default function TextArea(props: TextAreaProps) {
  const [isFocused, setIsFocused] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    props.onChange(e.target.value);
  };

  return (
    <TextAreaView
      label={props.label}
      value={props.value}
      onChange={handleChange}
      placeholder={props.placeholder}
      required={props.required}
      disabled={props.disabled}
      status={props.status || "default"}
      errorMessage={props.errorMessage}
      isFocused={isFocused}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      rows={props.rows}
      maxLength={props.maxLength}
    />
  );
}
