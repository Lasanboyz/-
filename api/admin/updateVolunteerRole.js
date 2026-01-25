// api/admin/updateVolunteerRole.js
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin = createClient(supabaseUrl, serviceKey);

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  return res.end(JSON.stringify(body));
}

function safeParseBody(req) {
  const b = req.body;
  if (!b) return {};
  if (typeof b === "object") return b;
  if (typeof b === "string") {
    try { return JSON.parse(b); } catch { return {}; }
  }
  return {};
}

export default async function handler(req, res) {
  try {
    if (req.method === "OPTIONS") return send(res, 200, { ok: true });
    if (req.method === "GET") return send(res, 200, { ok: true, route: "/api/admin/updateVolunteerRole" });
    if (req.method !== "POST") return send(res, 405, { error: "Method Not Allowed" });
    if (!supabaseUrl || !serviceKey) return send(res, 500, { error: "Missing env" });

    const body = safeParseBody(req);
    const volunteer_code = String(body.volunteer_code ?? "").trim().toUpperCase();
    const role = String(body.role ?? "").trim().toUpperCase();

    if (!volunteer_code) return send(res, 400, { error: "volunteer_code is required" });
    if (!["VOLUNTEER", "STAFF", "ADMIN"].includes(role)) {
      return send(res, 400, { error: "role must be VOLUNTEER|STAFF|ADMIN" });
    }

    const { data, error } = await supabaseAdmin
      .from("volunteers")
      .update({ role })
      .eq("volunteer_code", volunteer_code)
      .select("volunteer_code, role")
      .maybeSingle();

    if (error) return send(res, 500, { error: error.message });
    return send(res, 200, { data });
  } catch (e) {
    return send(res, 500, { error: e?.message || "Unknown error" });
  }
}
