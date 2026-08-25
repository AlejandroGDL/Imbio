import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";

export function MainLayout() {
  return (
    <div className="flex min-h-screen bg-gradient-to-br from-imbio-green-50/40 via-white to-sky-50/30">
      <Sidebar />
      <main className="flex-1 overflow-x-hidden">
        <div className="mx-auto max-w-7xl p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
