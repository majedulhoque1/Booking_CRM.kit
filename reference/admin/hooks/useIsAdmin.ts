import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

// Client-side admin check. Relies on the contract's user_roles self-read RLS policy
// (0008): a logged-in user can read ONLY their own role rows, so a returned 'admin' row
// means the caller is an admin. The server-side gate (has_role in every RPC/policy) is the
// real boundary; this just drives UI/routing.
export function useIsAdmin() {
  return useQuery({
    queryKey: ["is-admin"],
    queryFn: async () => {
      if (!supabase) return false;
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("role", "admin")
        .maybeSingle();
      if (error) return false;
      return Boolean(data);
    },
  });
}
