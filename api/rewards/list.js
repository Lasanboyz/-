// api/rewards/list.js
import { getAdminClient } from "../_utils/supabaseAdmin.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    // ✅ debug env (ไม่โชว์ค่า แค่บอกว่ามี/ไม่มี)
    const hasUrl = !!process.env.SUPABASE_URL;
    const hasService = !!process.env.SUPABASE_SERVICE_ROLE_KEY;

    const supabase = getAdminClient();

    const { data, error } = await supabase
      .from("rewards")
      .select("id,title,description,cost_points,stock,image_url,is_active,sort_order")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("cost_points", { ascending: true });

    if (error) {
      return res.status(500).json({
        ok: false,
        where: "supabase query",
        hasUrl,
        hasService,
        error: error.message,
      });
    }

    return res.status(200).json({ ok: true, hasUrl, hasService, rewards: data || [] });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      where: "try/catch",
      message: e?.message || String(e),
      stack: e?.stack || null,
    });
  }
}
