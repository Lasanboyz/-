import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { volunteer_code, name, branch } = req.body || {};

    const code = String(volunteer_code ?? "").trim().toUpperCase();
    const n = String(name ?? "").trim();
    const b = String(branch ?? "").trim();

    if (!code) return res.status(400).json({ error: "volunteer_code is required" });
    if (!n) return res.status(400).json({ error: "name is required" });
    if (!b) return res.status(400).json({ error: "branch is required" });

    const { data: exist, error: existErr } = await supabaseAdmin
      .from("volunteers")
      .select("id, volunteer_code, name, branch, points")
      .eq("volunteer_code", code)
      .maybeSingle();

    if (existErr) return res.status(500).json({ error: existErr.message });
    if (exist?.id) return res.status(200).json({ data: exist });

    const { data, error } = await supabaseAdmin
      .from("volunteers")
      .insert({ volunteer_code: code, name: n, branch: b, points: 0 })
      .select("id, volunteer_code, name, branch, points")
      .single();

    if (error) return res.status(500).json({ error: error.message });

    return res.status(200).json({ data });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "Unknown error" });
  }
}
