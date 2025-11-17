import React from 'react';
import { Global, css, Theme } from '@emotion/react';

const styles = (theme: Theme) => css`
   *,
   *::after,
   *::before {
      box-sizing: border-box;
      font-family: 'Noto Sans KR', sans-serif;
   }

   html,
   body {
      height: 100%;

      @supports (-webkit-touch-callout: none) {
         height: -webkit-fill-available;
      }

      *::-webkit-scrollbar {
         display: none;
      }
   }

   body {
      color: ${theme.color.black900};
      font-family: 'Noto Sans KR', sans-serif;
      margin: 0;
      position: relative;
      transition: background-color 0.3s ease;

      a {
         text-decoration: none;
      }
   }

   p,
   h1 {
      padding: 0;
      margin: 0;
   }

   a,
   button {
      display: inline-block;
      cursor: pointer;
      background: none;
      border: 0;
   }

   *:focus {
      outline: none;
   }

   a:focus {
      outline: none;
   }

   input:focus::-webkit-input-placeholder,
   textarea:focus::-webkit-input-placeholder {
      color: transparent !important;
   }

   input:focus:-moz-placeholder,
   textarea:focus:-moz-placeholder {
      color: transparent !important;
   }

   /* FF 4-18 */

   input:focus::-moz-placeholder,
   textarea:focus::-moz-placeholder {
      color: transparent !important;
   }

   /* FF 19+ */

   input:focus:-ms-input-placeholder,
   textarea:focus:-ms-input-placeholder {
      color: transparent !important;
   }

   /* IE 10+ */
`;

function GlobalStyles() {
   return <Global styles={styles} />;
}

export default GlobalStyles;
