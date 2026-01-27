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

    // 1) Load reward
    const { data: reward, error: rewardErr } = await supabase
      .from("rewards")
      .select("id,title,cost_points,stock,is_active")
      .eq("id", reward_id)
      .single();

    if (rewardErr || !reward) return res.status(404).json({ error: "Reward not found" });
    if (!reward.is_active) return res.status(400).json({ error: "Reward not active" });

    const cost = Number(reward.cost_points) * q;

    // 2) ลด stock ก่อน (กันของหมด) — ถ้า fail หยุดเลย
    const { data: stockUpdated, error: stockErr } = await supabase
      .from("rewards")
      .update({ stock: reward.stock - q })
      .eq("id", reward.id)
      .gte("stock", q)
      .select("id,stock")
      .single();

    if (stockErr || !stockUpdated) {
      return res.status(400).json({ error: "ของรางวัลหมด หรือ stock ไม่พอ" });
    }

    // 3) หักแต้ม (ต้องพอ) — ถ้า fail ต้องชดเชย stock คืน
    const { data: vUpdated, error: vErr } = await supabase
      .from("volunteers")
      .update({ points: supabase.rpc ? undefined : undefined }) // (ignore)
      .eq("id", payload.volunteer_id)
      .gte("points", cost)
      .select("id,points,name,branch,role,volunteer_code")
      .single();

    // NOTE: supabase-js ไม่มี update points = points - cost แบบ native expression
    // เราเลยต้องอ่าน points ก่อน แล้วค่อย update แบบปลอดภัยกว่าด้วย gte filter:

    if (vErr || !vUpdated) {
      // ชดเชย stock คืน
      await supabase.from("rewards").update({ stock: stockUpdated.stock + q }).eq("id", reward.id);
      return res.status(400).json({ error: "แต้มไม่พอ" });
    }

    // ✅ แก้ให้เป็นหักแต้มจริง: ต้องอ่าน points ก่อน แล้ว update ตามค่าจริง
    // (เราทำเพิ่มอีกชั้นเพื่อให้แน่น)
    const currentPoints = Number(vUpdated.points);
    const newPoints = currentPoints - cost;

    const { data: vDeducted, error: vDeductErr } = await supabase
      .from("volunteers")
      .update({ points: newPoints })
      .eq("id", payload.volunteer_id)
      .eq("points", currentPoints) // optimistic lock กันตัดแต้มซ้อน
      .select("id,points,name,branch,role,volunteer_code")
      .single();

    if (vDeductErr || !vDeducted) {
      // ชดเชย stock คืน
      await supabase.from("rewards").update({ stock: stockUpdated.stock + q }).eq("id", reward.id);
      return res.status(409).json({ error: "แต้มถูกเปลี่ยนระหว่างทำรายการ ลองใหม่อีกครั้ง" });
    }

    // 4) สร้างคำขอ
    const { data: reqCreated, error: reqErr } = await supabase
      .from("redemption_requests")
      .insert({
        volunteer_id: payload.volunteer_id,
        reward_id: reward.id,
        reward_title: reward.title,
        qty: q,
        points_used: cost,
        status: "PENDING",
      })
      .select("id,status,created_at")
      .single();

    if (reqErr || !reqCreated) {
      // ถ้าสร้างคำขอไม่สำเร็จ: ชดเชยแต้ม+stock คืน (best effort)
      await supabase.from("volunteers").update({ points: currentPoints }).eq("id", payload.volunteer_id);
      await supabase.from("rewards").update({ stock: stockUpdated.stock + q }).eq("id", reward.id);
      return res.status(500).json({ error: "สร้างคำขอไม่สำเร็จ" });
    }

    // 5) ส่งกลับ
    return res.status(200).json({
      ok: true,
      request: reqCreated,
      new_points: vDeducted.points,
    });
  } catch (e) {
    return res.status(500).json({ error: e?.message || "Internal error" });
  }
}
