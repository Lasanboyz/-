// api/admin/voidActivity.js
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

    if (req.method === "GET") {
      return send(res, 200, {
        ok: true,
        route: "/api/admin/voidActivity",
        hasEnv: {
          SUPABASE_URL: Boolean(supabaseUrl),
          SUPABASE_SERVICE_ROLE_KEY: Boolean(serviceKey),
        },
      });
    }

    if (req.method !== "POST") return send(res, 405, { error: "Method Not Allowed" });
    if (!supabaseUrl || !serviceKey) return send(res, 500, { error: "Missing env" });

    const body = safeParseBody(req);

    const activity_id = String(body.activity_id ?? "").trim();
    const void_reason = String(body.void_reason ?? "Admin void").trim();
    const void_by = String(body.void_by ?? "ADMIN").trim();

    if (!activity_id) return send(res, 400, { error: "activity_id is required" });

    const nowIso = new Date().toISOString();

    const { error: updErr } = await supabaseAdmin
      .from("activity_history")
      .update({
        is_void: true,
        void_reason,
        void_by,
        void_at: nowIso,
      })
      .eq("id", activity_id);

    if (updErr) return send(res, 500, { error: updErr.message });

    return send(res, 200, { data: { voided: true, activity_id } });
  } catch (e) {
    return send(res, 500, { error: e?.message || "Unknown error" });
  }
}
