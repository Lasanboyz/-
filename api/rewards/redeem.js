// api/rewards/redeem.js
import { getAdminClient } from "../_lib/supabaseAdmin.js";
import { getBearerToken, verifyJwtHS256 } from "../_lib/jwt.js";


function parseJsonBody(req) {
  if (!req || !req.body) return {};
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return req.body;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // ---- Auth ----
    const token = getBearerToken(req);
    const secret = process.env.APP_JWT_SECRET;
    if (!secret) {
      return res.status(500).json({ error: "Missing APP_JWT_SECRET" });
    }

    const payload = verifyJwtHS256(token, secret);
    const volunteerId = payload && payload.volunteer_id;
    if (!volunteerId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // ---- Body ----
    const body = parseJsonBody(req);
    const reward_id = String(body.reward_id || "").trim();
    const qty = Math.max(1, Math.floor(Number(body.qty || 1)));
    const phone_number = String(body.phone_number || "").trim();

    if (!reward_id) {
      return res.status(400).json({ error: "Missing reward_id" });
    }

    const supabase = getAdminClient();

    // ---- Load reward ----
    const { data: reward, error: rewardErr } = await supabase
      .from("rewards")
      .select("id, title, cost_points, stock, is_active")
      .eq("id", reward_id)
      .maybeSingle();

    if (rewardErr) throw rewardErr;
    if (!reward) return res.status(404).json({ error: "Reward not found" });
    if (reward.is_active === false) {
      return res.status(400).json({ error: "Reward inactive" });
    }

    const cost = Number(reward.cost_points || 0);
    const stock = Number(reward.stock || 0);
    const pointsUsed = cost * qty;

    if (stock < qty) {
      return res.status(400).json({ error: "Stock not enough" });
    }

    // ---- Load volunteer ----
    const { data: vol, error: volErr } = await supabase
      .from("volunteers")
      .select("id, points")
      .eq("id", volunteerId)
      .maybeSingle();

    if (volErr) throw volErr;
    if (!vol) return res.status(404).json({ error: "Volunteer not found" });

    const currentPoints = Number(vol.points || 0);
    if (currentPoints < pointsUsed) {
      return res.status(400).json({ error: "Points not enough" });
    }

    // ---- Prevent duplicate pending ----
    const { data: dup } = await supabase
      .from("redemption_requests")
      .select("id")
      .eq("volunteer_id", volunteerId)
      .eq("reward_id", reward_id)
      .eq("status", "PENDING")
      .limit(1);

    if (Array.isArray(dup) && dup.length > 0) {
      return res.status(400).json({ error: "Already have pending request" });
    }

    // ---- Insert request ----
    const payloadInsert = {
      volunteer_id: volunteerId,
      reward_id,
      reward_title: reward.title,
      qty,
      points_used: pointsUsed,
      status: "PENDING",
    };

    if (phone_number) payloadInsert.phone_number = phone_number;

    const { data: reqRow, error: insErr } = await supabase
      .from("redemption_requests")
      .insert(payloadInsert)
      .select()
      .maybeSingle();

    if (insErr) throw insErr;

    return res.status(200).json({
      ok: true,
      request: reqRow,
      new_points: currentPoints,
    });
  } catch (e) {
    console.error("[redeem] error:", e);
    return res.status(500).json({ error: e.message || "Internal error" });
  }
}
