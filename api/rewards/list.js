import { getAdminClient } from "../../lib/supabaseAdmin.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const supabase = getAdminClient();

    const { data, error } = await supabase
      .from("rewards")
      .select("id,title,description,cost_points,stock,image_url,is_active,sort_order")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("cost_points", { ascending: true });

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true, rewards: data || [] });
  } catch (e) {
    return res.status(500).json({ error: e?.message || "Internal error" });
  }
}
