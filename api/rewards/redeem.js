// api/rewards/redeem.ts
import { getAdminClient } from "../../lib/supabaseAdmin.js";
import { getBearerToken, verifyJwtHS256 } from "../../lib/jwt.js";

function parseJsonBody(req: any) {
  // Vercel บางที req.body เป็น string
  if (!req?.body) return {};
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return req.body;
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    // -------------------------
    // Auth
    // -------------------------
    const token = getBearerToken(req);
    const secret = process.env.APP_JWT_SECRET;
    if (!secret) return res.status(500).json({ error: "Missing APP_JWT_SECRET" });

    const payload = verifyJwtHS256(token, secret);
    const volunteerId = payload?.volunteer_id;
    if (!volunteerId) return res.status(401).json({ error: "Unauthorized" });

    // -------------------------
    // Body
    // -------------------------
    const body = parseJsonBody(req);
    const reward_id = String(body?.reward_id ?? "").trim();
    const qty = Math.max(1, Math.floor(Number(body?.qty ?? 1)));
    const phone_number = String(body?.phone_number ?? "").trim(); // optional

    if (!reward_id) return res.status(400).json({ error: "Missing reward_id" });
    if (!Number.isFinite(qty) || qty < 1 || qty > 10) return res.status(400).json({ error: "Invalid qty" });

    const supabase = getAdminClient();

    // -------------------------
    // 1) Load reward
    // schema ที่ใช้: rewards(id,title,cost_points,stock,is_active,image_url)
    // -------------------------
    const { data: reward, error: rewardErr } = await supabase
      .from("rewards")
      .select("id, title, cost_points, stock, is_active")
      .eq("id", reward_id)
      .maybeSingle();

    if (rewardErr) throw rewardErr;
    if (!reward?.id) return res.status(404).json({ error: "Reward not found" });

    if (reward.is_active === false) return res.status(400).json({ error: "Reward is inactive" });

    const cost = Number(reward.cost_points ?? 0);
    const stock = Number(reward.stock ?? 0);

    if (!Number.isFinite(cost) || cost <= 0) return res.status(400).json({ error: "Reward cost is invalid" });
    if (stock < qty) return res.status(400).json({ error: `Stock not enough (stock=${stock}, qty=${qty})` });

    // -------------------------
    // 2) Load volunteer points (อ้าง DB จริง)
    // schema: volunteers(id, points)
    // -------------------------
    const { data: vol, error: volErr } = await supabase
      .from("volunteers")
      .select("id, points")
      .eq("id", volunteerId)
      .maybeSingle();

    if (volErr) throw volErr;
    if (!vol?.id) return res.status(404).json({ error: "Volunteer not found" });

    const currentPoints = Number(vol.points ?? 0);
    const pointsUsed = cost * qty;

    // ✅ กติกา: “สร้างคำขอ” ต้องมีแต้มพอ ณ ตอนขอก่อน
    if (currentPoints < pointsUsed) {
      return res.status(400).json({ error: `Points not enough (have=${currentPoints}, need=${pointsUsed})` });
    }

    // -------------------------
    // 3) Prevent duplicate pending for same reward (optional but recommended)
    // redemption_requests schema (ตามที่เราใช้ใน admin api):
    // id, volunteer_id, reward_id, reward_title, qty, points_used, status, created_at, admin_note, phone_number?
    // -------------------------
    const { data: pendingDup, error: dupErr } = await supabase
      .from("redemption_requests")
      .select("id")
      .eq("volunteer_id", volunteerId)
      .eq("reward_id", reward_id)
      .eq("status", "PENDING")
      .limit(1);

    if (dupErr) throw dupErr;
    if (Array.isArray(pendingDup) && pendingDup.length > 0) {
      return res.status(400).json({ error: "You already have a PENDING request for this reward" });
    }

    // -------------------------
    // 4) Create redemption request (PENDING)
    // ✅ ไม่หักแต้มที่นี่ (หักตอน Admin Approve)
    // -------------------------
    const insertPayload: any = {
      volunteer_id: volunteerId,
      reward_id,
      reward_title: reward.title ?? null,
      qty,
      points_used: pointsUsed,
      status: "PENDING",
    };

    // ถ้าตารางมี phone_number ค่อยส่งไป (ไม่มีก็ไม่พัง)
    // วิธี safe: ลอง insert ก่อน ถ้าฟ้อง column ไม่ exists ค่อย insert ใหม่แบบไม่ส่ง phone_number
    if (phone_number) insertPayload.phone_number = phone_number;

    let requestRow: any = null;

    const tryInsert = async (payload: any) => {
      const { data, error } = await supabase
        .from("redemption_requests")
        .insert(payload)
        .select("id, volunteer_id, reward_id, reward_title, qty, points_used, status, created_at")
        .maybeSingle();
      if (error) throw error;
      return data;
    };

    try {
      requestRow = await tryInsert(insertPayload);
    } catch (e: any) {
      // ถ้าชนเรื่อง column phone_number ไม่มีจริง ให้ลองใหม่แบบตัดออก
      const msg = String(e?.message ?? "");
      if (msg.toLowerCase().includes("phone_number")) {
        delete insertPayload.phone_number;
        requestRow = await tryInsert(insertPayload);
      } else {
        throw e;
      }
    }

    if (!requestRow?.id) return res.status(500).json({ error: "Create request failed" });

    // -------------------------
    // Response (ให้ Rewards.tsx ใช้ได้เลย)
    // ✅ new_points = ยังเท่าเดิม เพราะยังไม่หัก
    // -------------------------
    return res.status(200).json({
      ok: true,
      request: requestRow,
      request_id: requestRow.id,
      new_points: currentPoints,
    });
  } catch (e: any) {
    console.error("[api/rewards/redeem] error:", e);
    return res.status(500).json({ error: e?.message || "Internal error" });
  }
}
