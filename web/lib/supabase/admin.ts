// Server-only admin client. Uses the service-role key to bypass RLS for
// search RPCs and aggregations. NEVER import this from a Client Component.
import { createClient } from "@supabase/supabase-js";

export function adminClient() {
  return createClient(
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
