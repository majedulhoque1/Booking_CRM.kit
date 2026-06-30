import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

// Inbound inquiries (contract 0004 `inquiries`, unifying Angel's contact + consultation
// submissions via the `type` column). Admin reads/updates are has_role-gated by RLS (0008);
// anon can only INSERT (the public contact form).
export type SubmissionStatus = "new" | "contacted" | "closed";

export interface Submission {
  id: string;
  type: string; // 'contact' | 'consultation'
  name: string;
  email: string | null;
  phone: string | null;
  message: string | null;
  language: string;
  status: SubmissionStatus;
  details: Record<string, unknown>;
  created_at: string;
}

export function useSubmissions() {
  const qc = useQueryClient();
  const inv = () => qc.invalidateQueries({ queryKey: ["submissions"] });

  const { data: submissions = [], isLoading } = useQuery({
    queryKey: ["submissions"],
    queryFn: async () => {
      if (!supabase) return [];
      const { data, error } = await supabase
        .from("inquiries")
        .select("id,type,name,email,phone,message,language,status,details,created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Submission[];
    },
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: SubmissionStatus }) => {
      if (!supabase) return;
      const { error } = await supabase.from("inquiries").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: inv,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      if (!supabase) return;
      const { error } = await supabase.from("inquiries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: inv,
  });

  // Promote an inquiry into a CRM contact (deduped by source_submission_id), then mark closed.
  const convertToContact = useMutation({
    mutationFn: async (s: Submission) => {
      if (!supabase) return;
      const { data: existing } = await supabase
        .from("contacts")
        .select("id")
        .eq("source_submission_id", s.id)
        .maybeSingle();
      if (!existing) {
        const { error } = await supabase.from("contacts").insert({
          name: s.name,
          phone: s.phone,
          email: s.email,
          source_submission_id: s.id,
          details: s.details ?? {},
          notes: s.message,
        });
        if (error) throw error;
      }
      await supabase.from("inquiries").update({ status: "closed" }).eq("id", s.id);
    },
    onSuccess: () => {
      inv();
      qc.invalidateQueries({ queryKey: ["contacts"] });
    },
  });

  return {
    submissions,
    isLoading,
    setStatus: setStatus.mutateAsync,
    remove: remove.mutateAsync,
    convertToContact: convertToContact.mutateAsync,
  };
}
