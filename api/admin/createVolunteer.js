const { createClient } = require("@supabase/supabase-js");

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

module.exports = async (req, res) => {
  // allow GET health check
  if (req.method === "GET") {
    return res.status(200).json({ ok: true, route: "/api/admin/createVolunteer" });
  }

  // allow OPTIONS preflight
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(200).json({ ok: true });
  }

  if (req.method !== "POST") {
    return res.status(200).json({ ok: false, message: "Unsupported method (ignored)" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const { volunteer_code, name, branch } = body;

    const code = String(volunteer_code || "").trim().toUpperCase();
    const n = String(name || "").trim();
    const b = String(branch || "").trim();

    if (!code) return res.status(400).json({ error: "volunteer_code is required" });
    if (!n) return res.status(400).json({ error: "name is required" });
    if (!b) return res.status(400).json({ error: "branch is required" });

    // exist -> return
    const { data: exist, error: existErr } = await supabaseAdmin
      .from("volunteers")
      .select("id, volunteer_code, name, branch, points")
      .eq("volunteer_code", code)
      .maybeSingle();

    if (existErr) return res.status(500).json({ error: existErr.message });
    if (exist?.id) return res.status(200).json({ data: exist });

    // insert new
    const { data, error } = await supabaseAdmin
      .from("volunteers")
      .insert({ volunteer_code: code, name: n, branch: b, points: 0 })
      .select("id, volunteer_code, name, branch, points")
      .single();

    if (error) return res.status(500).json({ error: error.message });

    return res.status(200).json({ data });
  } catch (e) {
    return res.status(500).json({ error: e?.message || "Unknown error" });
  }
};
