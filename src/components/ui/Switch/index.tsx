import React, { ChangeEvent } from "react";
import { SwitchProps } from "./type";
import { SwitchView } from "./View";

export const Switch: React.FC<SwitchProps> = (props) => {
  const { onChange, ...rest } = props;

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const nextChecked = e.target.checked;

    onChange?.(e, nextChecked);
  };

  return <SwitchView {...rest} onInputChange={handleInputChange} />;
};
