import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const memoryAuthStorage = new Map<string, string>();

// Use localStorage so the auth session is shared across tabs.
// Print pages open in target="_blank" tabs and rely on the same session.
const authStorageAdapter = {
  getItem(key: string) {
    try {
      if (typeof window !== "undefined") {
        return window.localStorage.getItem(key);
      }
    } catch {
      // Fall back to in-memory storage when localStorage is unavailable.
    }

    return memoryAuthStorage.get(key) ?? null;
  },
  removeItem(key: string) {
    try {
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(key);
      }
    } catch {
      // Ignore storage access errors and keep memory fallback in sync.
    }

    memoryAuthStorage.delete(key);
  },
  setItem(key: string, value: string) {
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(key, value);
      }
    } catch {
      // Ignore storage access errors and keep memory fallback in sync.
    }

    memoryAuthStorage.set(key, value);
  },
};

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient<Database>(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: true,
        persistSession: true,
        storage: authStorageAdapter,
      },
    })
  : null;

export const supabaseConfigMessage = isSupabaseConfigured
  ? null
  : "Supabase credentials are missing. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (or VITE_SUPABASE_PUBLISHABLE_KEY) to .env.local.";
