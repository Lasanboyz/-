// api/rewards/redeem.js
import { getAdminClient } from "../_lib/supabaseAdmin.js";

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
  try {
    const supabase = getAdminClient();
    const { reward_id, volunteer_id } = parseJsonBody(req);

    if (!reward_id || !volunteer_id) {
      return res.status(400).json({ error: "reward_id and volunteer_id required" });
    }

    // 1) ดึงข้อมูลอาสา
    const { data: volunteer, error: vErr } = await supabase
      .from("volunteers")
      .select("id, points")
      .eq("id", volunteer_id)
      .single();

    if (vErr || !volunteer) {
      return res.status(404).json({ error: "Volunteer not found" });
    }

    // 2) ดึงรางวัล
    const { data: reward, error: rErr } = await supabase
      .from("rewards")
      .select("id, cost")
      .eq("id", reward_id)
      .single();

    if (rErr || !reward) {
      return res.status(404).json({ error: "Reward not found" });
    }

    // 3) คำนวณแต้มที่ถูกล็อกจาก pending
    const { data: pendingList, error: pErr } = await supabase
      .from("redemption_requests")
      .select("reward_id")
      .eq("volunteer_id", volunteer.id)
      .eq("status", "pending");

    if (pErr) {
      return res.status(500).json({ error: pErr.message });
    }

    let pendingPoints = 0;
    if (pendingList.length > 0) {
      const rewardIds = pendingList.map(r => r.reward_id);
      const { data: rewardsPending } = await supabase
        .from("rewards")
        .select("id, cost")
        .in("id", rewardIds);

      pendingPoints = rewardsPending.reduce((sum, r) => sum + r.cost, 0);
    }

    const availablePoints = volunteer.points - pendingPoints;

    // 4) เช็กแต้มที่ใช้ได้จริง
    if (availablePoints < reward.cost) {
      return res.status(400).json({
        error: "Not enough available points",
        availablePoints,
      });
    }

    // 5) สร้างคำขอแลกของ
    const { error: insErr } = await supabase
      .from("redemption_requests")
      .insert({
        volunteer_id: volunteer.id,
        reward_id: reward.id,
        status: "pending",
      });

    if (insErr) {
      return res.status(500).json({ error: insErr.message });
    }

    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
