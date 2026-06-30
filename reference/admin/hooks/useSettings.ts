import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

// Read/write public.site_settings (contract 0002/0008). The contract RPCs read these at
// runtime (timezone, notify_staff_phone), so this is how the admin tunes the client without
// any SQL change. Admin RLS gates writes.
export function useSettings() {
  const qc = useQueryClient();

  const { data: settings = {}, isLoading } = useQuery({
    queryKey: ["site_settings"],
    queryFn: async () => {
      if (!supabase) return {};
      const { data, error } = await supabase.from("site_settings").select("key,value");
      if (error) throw error;
      return Object.fromEntries((data ?? []).map((r) => [r.key, r.value])) as Record<string, string>;
    },
  });

  const update = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      if (!supabase) return;
      // upsert so a missing key is created; key is the PK.
      const { error } = await supabase
        .from("site_settings")
        .upsert({ key, value }, { onConflict: "key" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["site_settings"] }),
  });

  return { settings, isLoading, update: update.mutateAsync };
}
