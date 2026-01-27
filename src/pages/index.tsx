import { useLayoutEffect } from "react";

export default function WorkflowPage() {
  useLayoutEffect(() => {
    window.location.replace("/workflow");
  }, []);
  return (
    <div className="w-full h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900"></div>
  );
}
