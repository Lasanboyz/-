import { getAdminClient } from "../../lib/supabaseAdmin.js";
import { getBearerToken, verifyJwtHS256 } from "../../lib/jwt.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const token = getBearerToken(req);
    const secret = process.env.APP_JWT_SECRET;
    if (!secret) return res.status(500).json({ error: "Missing APP_JWT_SECRET" });

    const payload = verifyJwtHS256(token, secret);
    if (!payload?.volunteer_id) return res.status(401).json({ error: "Unauthorized" });

    const { reward_id, qty } = req.body || {};
    const q = Number(qty ?? 1);
    if (!reward_id) return res.status(400).json({ error: "Missing reward_id" });
    if (!Number.isFinite(q) || q < 1 || q > 10) return res.status(400).json({ error: "Invalid qty" });

    const supabase = getAdminClient();

    const { data, error } = await supabase.rpc("redeem_reward", {
      p_volunteer_id: payload.volunteer_id,
      p_reward_id: reward_id,
      p_qty: q,
    });

    if (error) return res.status(400).json({ error: error.message || "Redeem failed" });

    const row = Array.isArray(data) ? data[0] : data;
    return res.status(200).json({ ok: true, result: row });
  } catch (e) {
    return res.status(500).json({ error: e?.message || "Internal error" });
  }
}
