import { Theme } from '@emotion/react';

interface ThemeGroup {
   light: Theme;
   dark: Theme;
}

const minWidth = (deviceSize: string) =>
   `${(Number(deviceSize.split('px')[0]) + 1).toString()}px`;

const deviceSize = {
   desktop: '1280px',
   laptop: '1024px',
   tablet: '768px',
   mobile: '480px',
};

const device = {
   desktop: `@media (min-width: ${minWidth(deviceSize.laptop)})`,
   laptop: `@media (min-width: ${minWidth(
      deviceSize.tablet,
   )}) and (max-width: ${deviceSize.laptop})`,
   tablet: `@media (min-width: ${minWidth(
      deviceSize.mobile,
   )}) and (max-width: ${deviceSize.tablet})`,
   mobile: `@media (max-width: ${deviceSize.mobile})`,
};

const font = {
   size: {
      xs: '12px',
      s: '14px',
      m: '16px',
      l: '18px',
   },
   weight: {
      normal: 400,
      medium: 500,
      semiBold: 600,
      bold: 700,
   },
};

const color = {
   white900: '#FFFFFF',
   black900: '#000000',

   gray100: '#F8F9FA',
   gray200: '#F1F5F9',
   gray300: '#ECF0F5',
   gray400: '#E2E8F0',
   gray500: '#D3DDE9',
   gray600: '#C2CBD6',
   gray700: '#919DAD',
   gray800: '#606D80',
   gray900: '#313748',

   blue100: '#FCFEFF',
   blue200: '#E1F0FF',
   blue300: '#2F88FF',
   blue400: '#4975CE',
   blue500: '#33599B',
   blue600: '#234684',
};

export const bootstrap = {
   primary: '#003580',
   secondary: '#EE7300',
   danger: '#FF5555',
   complete: '#00BB88',
   onGoing: '#0086E6',
   etc: '#555555',
};

export const bootstrapColors = Object.keys(bootstrap) as [
   keyof typeof bootstrap,
];

export const commons = {
   deviceSize,
   device,
   font,
   color,
};

const light = {
   ...commons,
   ...bootstrap,
};

const dark = {
   ...commons,
   ...bootstrap,
};

const themeGroup: ThemeGroup = {
   light,
   dark,
};

export default themeGroup;
