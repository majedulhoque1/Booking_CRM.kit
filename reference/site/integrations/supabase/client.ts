import { createClient } from "@supabase/supabase-js";

// Publishable (anon) key — safe to ship in the browser; RLS (contract/migrations/0008)
// enforces access. Env-only: NO hardcoded fallbacks (each client sets its own).
//   VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/**
 * When env vars are missing (SSR build, preview, not-yet-wired), export a stub client so
 * the app doesn't crash: all queries resolve to empty data, auth methods are no-ops.
 * Keep this fallback — it is what lets `npm run build` succeed before secrets are set.
 */
function createStubClient(): any {
  const result = { data: [], error: null };
  const single = { data: null, error: null };
  const builder: any = new Proxy(function () {}, {
    get(_t, prop) {
      if (prop === "then") return undefined; // not a promise
      if (prop === "single" || prop === "maybeSingle")
        return () => Promise.resolve(single);
      return () => builder;
    },
    apply() {
      return builder;
    },
  });
  // Make builder awaitable -> resolves to empty list
  builder.then = (resolve: (v: any) => void) => resolve(result);

  return {
    from: () => builder,
    rpc: () => Promise.resolve(result),
    storage: {
      from: () => ({
        upload: () => Promise.resolve({ data: null, error: new Error("Supabase not connected") }),
        getPublicUrl: () => ({ data: { publicUrl: "" } }),
        remove: () => Promise.resolve({ data: null, error: null }),
      }),
    },
    auth: {
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      getUser: () => Promise.resolve({ data: { user: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signInWithPassword: () => Promise.resolve({ data: null, error: new Error("Supabase not connected") }),
      signUp: () => Promise.resolve({ data: null, error: new Error("Supabase not connected") }),
      signOut: () => Promise.resolve({ error: null }),
    },
  };
}

export const supabase: any =
  SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storage: typeof window !== "undefined" ? window.localStorage : undefined,
        },
      })
    : createStubClient();
