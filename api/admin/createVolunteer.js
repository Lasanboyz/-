import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  return res.end(JSON.stringify(body));
}

export default async function handler(req, res) {
  try {
    // ✅ GET ใช้เทสต์ว่า API ไม่ crash + เช็ค env
    if (req.method === "GET") {
      return send(res, 200, {
        ok: true,
        route: "/api/admin/createVolunteer",
        hasEnv: {
          SUPABASE_URL: Boolean(supabaseUrl),
          SUPABASE_SERVICE_ROLE_KEY: Boolean(serviceKey),
        },
      });
    }

    // ✅ OPTIONS preflight
    if (req.method === "OPTIONS") {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
      return res.status(204).end();
    }

    if (req.method !== "POST") {
      return send(res, 405, { error: "Method not allowed" });
    }

    if (!supabaseUrl || !serviceKey) {
      return send(res, 500, {
        error: "Missing env",
        need: ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"],
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    const { volunteer_code, name, branch } = req.body || {};
    const code = String(volunteer_code ?? "").trim().toUpperCase();
    const n = String(name ?? "").trim();
    const b = String(branch ?? "").trim();

    if (!code) return send(res, 400, { error: "volunteer_code is required" });
    if (!n) return send(res, 400, { error: "name is required" });
    if (!b) return send(res, 400, { error: "branch is required" });

    // check exist
    const { data: exist, error: existErr } = await supabaseAdmin
      .from("volunteers")
      .select("id, volunteer_code, name, branch, points")
      .eq("volunteer_code", code)
      .maybeSingle();

    if (existErr) return send(res, 500, { error: existErr.message });
    if (exist?.id) return send(res, 200, { data: exist, existed: true });

    // insert
    const { data, error } = await supabaseAdmin
      .from("volunteers")
      .insert({ volunteer_code: code, name: n, branch: b, points: 0 })
      .select("id, volunteer_code, name, branch, points")
      .single();

    if (error) return send(res, 500, { error: error.message });

    return send(res, 200, { data, existed: false });
  } catch (e) {
    return send(res, 500, { error: e?.message || "Unknown error" });
  }
}
