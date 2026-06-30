import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

// Analytics dashboard data (contract 0006). Reads ONLY through the 5 SECURITY-DEFINER
// analytics_* RPCs — each self-gated by has_role, so a non-admin gets nothing and the
// underlying analytics_events table stays deny-all. Pass an ISO date range (YYYY-MM-DD).
export interface AnalyticsRange {
  from: string;
  to: string;
}

export interface TrafficPoint { day: string; pageviews: number; unique_visitors: number }
export interface TopPage { path: string; pageviews: number; unique_visitors: number }
export interface SourceRow { source: string; referrer_host: string | null; pageviews: number }
export interface CountryRow { country: string; pageviews: number; unique_visitors: number }
export interface Conversions {
  bookings_by_status: Record<string, number>;
  consultation_submissions: number;
  contact_submissions: number;
  book_consultation_views: number;
  contact_views: number;
}

export function useAnalytics({ from, to }: AnalyticsRange) {
  return useQuery({
    queryKey: ["analytics", from, to],
    queryFn: async () => {
      if (!supabase) {
        return {
          traffic: [] as TrafficPoint[],
          topPages: [] as TopPage[],
          sources: [] as SourceRow[],
          countries: [] as CountryRow[],
          conversions: null as Conversions | null,
        };
      }
      const p = { p_from: from, p_to: to };
      const [traffic, topPages, sources, countries, conversions] = await Promise.all([
        supabase.rpc("analytics_traffic", p),
        supabase.rpc("analytics_top_pages", p),
        supabase.rpc("analytics_sources", p),
        supabase.rpc("analytics_by_country", p),
        supabase.rpc("analytics_conversions", p),
      ]);
      const firstErr = [traffic, topPages, sources, countries, conversions].find((r) => r.error)?.error;
      if (firstErr) throw firstErr;
      return {
        traffic: (traffic.data ?? []) as TrafficPoint[],
        topPages: (topPages.data ?? []) as TopPage[],
        sources: (sources.data ?? []) as SourceRow[],
        countries: (countries.data ?? []) as CountryRow[],
        conversions: (conversions.data ?? null) as Conversions | null,
      };
    },
  });
}
