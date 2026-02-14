import { PALETTE } from "../../tailwind.config.mjs";

export { PALETTE };
export type PaletteKey = keyof typeof PALETTE;
export type PaletteProperty = keyof (typeof PALETTE)[keyof typeof PALETTE];
