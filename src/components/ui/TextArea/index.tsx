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
      {...props}
      isFocused={isFocused}
      onChange={handleChange}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
    />
  );
}
