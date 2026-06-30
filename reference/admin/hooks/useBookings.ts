import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

// Bookings management (contract 0004 `bookings` + 0005 reschedule_booking). Confirm/cancel
// updates status (firing the 0007 notification trigger); reschedule goes through the
// admin-only RPC. All admin-gated by RLS / has_role.
export type BookingStatus = "pending" | "confirmed" | "cancelled";

export interface BookingRow {
  id: string;
  date: string;
  time: string;
  status: BookingStatus;
  source: string;
  notes: string | null;
  contact: { name: string; phone: string | null } | null;
}

type RescheduleResult = { status: "ok" | "forbidden" | "not_found" | "invalid_slot" | "slot_taken" };

export function useBookings() {
  const qc = useQueryClient();
  const inv = () => qc.invalidateQueries({ queryKey: ["bookings"] });

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ["bookings"],
    queryFn: async () => {
      if (!supabase) return [];
      const { data, error } = await supabase
        .from("bookings")
        .select("id,date,time,status,source,notes,contact:contacts(name,phone)")
        .order("date", { ascending: false })
        .order("time");
      if (error) throw error;
      return (data ?? []) as unknown as BookingRow[];
    },
  });

  // Confirm / cancel: a status change fires enqueue_booking_notification (0007).
  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: BookingStatus }) => {
      if (!supabase) return;
      const { error } = await supabase.from("bookings").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: inv,
  });

  // Reschedule via the admin-only RPC (validates slot + notifies both parties).
  const reschedule = useMutation({
    mutationFn: async (args: { id: string; date: string; time: string }) => {
      if (!supabase) throw new Error("Supabase not configured");
      const { data, error } = await supabase.rpc("reschedule_booking", {
        p_booking_id: args.id,
        p_slot_date: args.date,
        p_slot_time: args.time,
      });
      if (error) throw error;
      return data as RescheduleResult;
    },
    onSuccess: inv,
  });

  return {
    bookings,
    isLoading,
    setStatus: setStatus.mutateAsync,
    reschedule: reschedule.mutateAsync,
  };
}
