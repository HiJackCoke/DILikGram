import React from "react";
import ReactDOM from "react-dom/client";

import { createBrowserRouter, RouterProvider } from "react-router-dom";
import routes from "vite-react-routes";
import { ReactDiagramProvider } from "react-cosmos-diagram";

import "./styles/index.css";

// @ts-expect-error: 'routes' might not have the expected type
const router = createBrowserRouter(routes());

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {/* <App /> */}
    <ReactDiagramProvider>
      <RouterProvider router={router} />
    </ReactDiagramProvider>
  </React.StrictMode>
);
