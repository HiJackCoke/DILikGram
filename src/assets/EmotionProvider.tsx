import React, { useEffect, useState } from 'react';
import type { ReactNode } from 'react';

import { ThemeProvider } from '@emotion/react';

import GlobalStyles from './GlobalStyles';
import themeGroup from './theme';

interface Props {
   children: ReactNode;
}

function EmotionProvider({ children }: Props) {
   const { light, dark } = themeGroup;

   const [theme, setTheme] = useState(light);

   useEffect(() => {
      const isDarkMode = localStorage.getItem('dark-mode');
      if (isDarkMode) setTheme(dark);
   }, []);

   return (
      <ThemeProvider theme={theme}>
         <GlobalStyles />
         {children}
      </ThemeProvider>
   );
}

export default EmotionProvider;
