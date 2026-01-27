import { getAdminClient } from "../_utils/supabaseAdmin.js";
import { getBearerToken, verifyJwtHS256 } from "../_utils/jwt.js";

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

    // ✅ ทำรายการแบบ atomic ใน DB ผ่าน RPC
    const { data, error } = await supabase.rpc("redeem_reward", {
      p_volunteer_id: payload.volunteer_id,
      p_reward_id: reward_id,
      p_qty: q,
    });

    if (error) {
      // error จาก SQL จะมาเป็น message เช่น "INSUFFICIENT_POINTS"
      const msg = (error.message || "").toUpperCase();

      if (msg.includes("REWARD_NOT_FOUND")) return res.status(404).json({ error: "Reward not found" });
      if (msg.includes("REWARD_NOT_ACTIVE")) return res.status(400).json({ error: "Reward not active" });
      if (msg.includes("OUT_OF_STOCK")) return res.status(400).json({ error: "ของรางวัลหมด หรือ stock ไม่พอ" });
      if (msg.includes("INSUFFICIENT_POINTS")) return res.status(400).json({ error: "แต้มไม่พอ" });

      return res.status(500).json({ error: error.message || "Redeem failed" });
    }

    // data จะเป็น record เดียวจาก function
    return res.status(200).json({
      ok: true,
      request: {
        id: data.request_id,
        status: data.status,
        created_at: data.created_at,
      },
      new_points: data.new_points,
      new_stock: data.new_stock,
      points_used: data.points_used,
    });
  } catch (e) {
    return res.status(500).json({ error: e?.message || "Internal error" });
  }
}
