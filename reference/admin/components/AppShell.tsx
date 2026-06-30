import type { ReactNode } from "react";
import { Outlet, useLocation } from "react-router-dom";

/**
 * Based on src/components/layout/AppShell.tsx.
 *
 * TrialBanner and SubscriptionGate have been removed. The concrete clinic
 * Sidebar/Header are now slots — pass any sidebar/header you like. The
 * sidebar is fixed-position; `mainOffsetClassName` reserves horizontal space
 * for it on large screens (default matches the original 68px collapsed rail).
 */
export function AppShell({
  sidebar,
  header,
  mainOffsetClassName = "lg:ml-[68px]",
}: {
  sidebar?: ReactNode;
  header?: ReactNode;
  mainOffsetClassName?: string;
}) {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background text-foreground lg:h-screen">
      {sidebar}

      <div
        className={`flex min-h-screen flex-col lg:h-screen transition-all duration-200 ease-out ${mainOffsetClassName}`}
      >
        {header}

        <main className="flex-1 overflow-y-auto bg-background px-4 py-5 pb-[calc(4rem+env(safe-area-inset-bottom,0px))] sm:px-6 sm:py-6 lg:pb-6 lg:px-8">
          <div className="page-enter mx-auto w-full max-w-[1280px]" key={location.pathname}>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
