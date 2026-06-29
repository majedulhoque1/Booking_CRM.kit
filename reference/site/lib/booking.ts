import { supabase } from "@/integrations/supabase/client";

// Calls ONLY the security-definer RPCs (contract/migrations/0005). The browser never
// touches the bookings/contacts tables. Param names + tagged-result values MUST match
// the contract exactly (see contract/README.md).

export interface AvailableSlot {
  slot_date: string; // "YYYY-MM-DD"
  slot_time: string; // "HH:MM:SS"
}

export type RequestBookingResult =
  | { status: "ok"; booking_id: string }
  | { status: "slot_taken" }
  | { status: "invalid_slot" }
  | { status: "invalid_input" };

// child_age / concern are the reference intake fields (stored in contacts.details by the
// RPC). A client with different intake adapts this interface + the request_booking call.
export interface BookingInput {
  name: string;
  phone: string;
  childAge: number;
  branch: string;
  concern: string;
  date: string; // "YYYY-MM-DD"
  time: string; // "HH:MM" or "HH:MM:SS"
  language: "en" | "bn";
}

export async function getAvailableSlots(from: string, to: string): Promise<AvailableSlot[]> {
  const { data, error } = await supabase.rpc("get_available_slots", { p_from: from, p_to: to });
  if (error) throw error;
  return (data ?? []) as AvailableSlot[];
}

export async function requestBooking(input: BookingInput): Promise<RequestBookingResult> {
  const { data, error } = await supabase.rpc("request_booking", {
    p_name: input.name,
    p_phone: input.phone,
    p_child_age: input.childAge,
    p_branch: input.branch,
    p_concern: input.concern,
    p_slot_date: input.date,
    p_slot_time: input.time,
    p_language: input.language,
  });
  if (error) throw error;
  return data as RequestBookingResult;
}
