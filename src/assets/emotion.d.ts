import { bootstrapColors, commons, bootstrap } from './theme';

type CommonTheme = typeof commons;
type BootStrap = typeof bootstrap;

declare module '@emotion/react' {
   export interface Theme extends CommonTheme, BootStrap {}
}
