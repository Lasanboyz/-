// api/_lib/supabaseAdmin.js
import { createClient } from "@supabase/supabase-js";

let _adminClient;

export function getAdminClient() {
  if (_adminClient) return _adminClient;

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) throw new Error("Missing SUPABASE_URL");
  if (!serviceKey) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");

  _adminClient = createClient(url, serviceKey, {
    auth: { persistSession: false },
  });

  return _adminClient;
}
