import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

// CRUD on public.availability (contract 0004). Admin RLS (0008) gates writes; these drive
// the windows that get_available_slots generates bookable slots from.
export interface AvailabilityWindow {
  id: string;
  weekday: number; // 0 = Sunday
  start_time: string;
  end_time: string;
  slot_minutes: number;
  active: boolean;
}
export interface AvailabilityInput {
  weekday: number;
  start_time: string;
  end_time: string;
  slot_minutes: number;
}

export function useAvailability() {
  const qc = useQueryClient();
  const inv = () => qc.invalidateQueries({ queryKey: ["availability"] });

  const { data: windows = [], isLoading } = useQuery({
    queryKey: ["availability"],
    queryFn: async () => {
      if (!supabase) return [];
      const { data, error } = await supabase
        .from("availability")
        .select("id,weekday,start_time,end_time,slot_minutes,active")
        .order("weekday")
        .order("start_time");
      if (error) throw error;
      return (data ?? []) as AvailabilityWindow[];
    },
  });

  const create = useMutation({
    mutationFn: async (input: AvailabilityInput) => {
      if (!supabase) return;
      const { error } = await supabase.from("availability").insert({ ...input, active: true });
      if (error) throw error;
    },
    onSuccess: inv,
  });
  const toggle = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      if (!supabase) return;
      const { error } = await supabase.from("availability").update({ active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: inv,
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      if (!supabase) return;
      const { error } = await supabase.from("availability").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: inv,
  });

  return {
    windows,
    isLoading,
    create: create.mutateAsync,
    toggle: toggle.mutateAsync,
    remove: remove.mutateAsync,
  };
}
