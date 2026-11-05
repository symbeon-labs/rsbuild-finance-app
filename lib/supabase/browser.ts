"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database.types";
import { getSupabasePublicConfig } from "./env";

let browserClient: ReturnType<typeof createBrowserClient<Database>> | undefined;

export function createClient() {
  if (!browserClient) {
    const { url, key } = getSupabasePublicConfig();
    browserClient = createBrowserClient<Database>(url, key);
  }
  return browserClient;
}
