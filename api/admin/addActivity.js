const { createClient } = require("@supabase/supabase-js");

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

module.exports = async (req, res) => {
  // allow GET health check
  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      route: "/api/admin/addActivity",
      hasEnv: {
        SUPABASE_URL: !!process.env.SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      },
    });
  }

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { volunteer_code, times, activity_date, status } = req.body || {};

    const code = String(volunteer_code ?? "").trim().toUpperCase();
    const t = Math.floor(Number(times ?? 1));
    const s = String(status ?? "VOLUNTEER").trim().toUpperCase();
    const date = String(activity_date ?? "").trim(); // YYYY-MM-DD

    if (!code) return res.status(400).json({ error: "volunteer_code is required" });
    if (!date) return res.status(400).json({ error: "activity_date is required (YYYY-MM-DD)" });
    if (!Number.isFinite(t) || t < 1) return res.status(400).json({ error: "times must be >= 1" });
    if (s !== "VOLUNTEER" && s !== "ADMIN") return res.status(400).json({ error: "status must be VOLUNTEER or ADMIN" });

    // ดึง name/branch จาก volunteers (ให้ข้อมูลสะอาด)
    const { data: vol, error: volErr } = await supabaseAdmin
      .from("volunteers")
      .select("volunteer_code, name, branch")
      .eq("volunteer_code", code)
      .maybeSingle();

    if (volErr) return res.status(500).json({ error: volErr.message });
    if (!vol) return res.status(404).json({ error: "ไม่พบ volunteer ใน volunteers" });

    const d = new Date(date + "T00:00:00");
    if (Number.isNaN(d.getTime())) return res.status(400).json({ error: "activity_date invalid" });
    const thai_year = d.getFullYear() + 543;

    const rows = Array.from({ length: t }).map(() => ({
      volunteer_code: code,
      name: vol.name ?? null,
      branch: vol.branch ?? null,
      status: s,
      activity_date: date,
      thai_year,
      is_void: false,
    }));

    const { error: insErr } = await supabaseAdmin.from("activity_history").insert(rows);
    if (insErr) return res.status(500).json({ error: insErr.message });

    return res.status(200).json({ data: { inserted: t, thai_year } });
  } catch (e) {
    return res.status(500).json({ error: e?.message || "Unknown error" });
  }
};
