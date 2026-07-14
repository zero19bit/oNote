import { useEffect } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { Sidebar } from "./components/Layout/Sidebar";
import { Topbar } from "./components/Layout/Topbar";
import { CommandPalette } from "./components/CommandPalette/CommandPalette";
import { QuickCapture } from "./components/QuickCapture/QuickCapture";
import { Toasts } from "./components/Toasts";
import { useUI } from "./store/ui";
import { AchievementToaster } from "./components/AchievementToaster";
import { initAchievementWatchers } from "./lib/achievements";

export default function App() {
  const init = useUI((s) => s.init);
  const navigate = useNavigate();

  useEffect(() => {
    init();
    initAchievementWatchers();
  }, [init]);

  // quick navigation wrapper for the command palette
  useEffect(() => {
    (window as any).__nav = navigate;
  }, [navigate]);

  return (
    <div className="h-full w-full flex bg-bg-base text-fg overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar />
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
      <CommandPalette />
      <QuickCapture />
      <Toasts />
      <AchievementToaster />
    </div>
  );
}
