import { getAdminClient } from "../_utils/supabaseAdmin.js";
import { getBearerToken, verifyJwtHS256 } from "../_utils/jwt.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const token = getBearerToken(req);
    const secret = process.env.APP_JWT_SECRET;
    if (!secret) return res.status(500).json({ error: "Missing APP_JWT_SECRET" });

    const payload = verifyJwtHS256(token, secret);
    if (!payload?.volunteer_id) return res.status(401).json({ error: "Unauthorized" });

    const supabase = getAdminClient();

    const { data, error } = await supabase
      .from("redemption_requests")
      .select("id,created_at,status,qty,points_used,reward_id,reward_title")
      .eq("volunteer_id", payload.volunteer_id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) return res.status(500).json({ error: error.message });

    return res.status(200).json({ ok: true, requests: data || [] });
  } catch (e) {
    return res.status(500).json({ error: e?.message || "Internal error" });
  }
}
