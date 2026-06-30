import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useIsAdmin } from "@/hooks/useIsAdmin";

// Gate every admin route on BOTH a session AND the admin role. Before the first admin is
// bootstrapped (see notes/env.md) an authenticated non-admin correctly sees "not authorized"
// and the dashboard stays empty (RLS denies their reads anyway).
export function ProtectedRoute({
  children,
  redirectTo = "/login",
}: {
  children: ReactNode;
  redirectTo?: string;
}) {
  const { isAuthenticated, isLoading } = useAuth();
  const { data: isAdmin, isLoading: roleLoading } = useIsAdmin();

  if (isLoading || (isAuthenticated && roleLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate replace to={redirectTo} />;

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6 text-center">
        <div className="max-w-sm space-y-2">
          <p className="text-lg font-semibold text-foreground">Not authorized</p>
          <p className="text-sm text-muted-foreground">
            This account isn't an admin yet. Ask an existing admin to grant access
            (see notes/env.md — the user_roles bootstrap).
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
