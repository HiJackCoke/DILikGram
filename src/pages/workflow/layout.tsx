import { ExecutorEditorProvider } from "@/contexts/ExecutorEditor";
import { Outlet } from "react-router-dom";

const Layout = () => {
  return (
    <ExecutorEditorProvider>
      <div id="executor-modal" />
      <Outlet />
    </ExecutorEditorProvider>
  );
};

export default Layout;
