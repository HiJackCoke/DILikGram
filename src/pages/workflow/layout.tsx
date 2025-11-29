import { Outlet } from "react-router-dom";

const Layout = () => {
  return (
    <>
      <div id="executor-modal" />
      <Outlet />
    </>
  );
};

export default Layout;
