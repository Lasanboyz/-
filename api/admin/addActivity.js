// api/admin/addActivity.js
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

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
    try {
      return JSON.parse(b);
    } catch {
      return {};
    }
  }
  return {};
}

function toThaiYearFromYMD(ymd) {
  const d = new Date(`${ymd}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.getFullYear() + 543;
}

export default async function handler(req, res) {
  try {
    // OPTIONS
    if (req.method === "OPTIONS") {
      return send(res, 200, { ok: true });
    }

    // GET = health check
    if (req.method === "GET") {
      return send(res, 200, {
        ok: true,
        route: "/api/admin/addActivity",
        hasEnv: {
          SUPABASE_URL: Boolean(supabaseUrl),
          SUPABASE_SERVICE_ROLE_KEY: Boolean(serviceKey),
        },
      });
    }

    if (req.method !== "POST") {
      return send(res, 405, { error: "Method Not Allowed" });
    }

    if (!supabaseUrl || !serviceKey) {
      return send(res, 500, {
        error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey);
    const body = safeParseBody(req);

    const volunteer_code = String(body.volunteer_code ?? "")
      .trim()
      .toUpperCase();
    const times = Math.floor(Number(body.times ?? 1));
    const activity_date = String(body.activity_date ?? "").trim();
    const status = String(body.status ?? "VOLUNTEER").toUpperCase();

    if (!volunteer_code) return send(res, 400, { error: "volunteer_code is required" });
    if (!activity_date) return send(res, 400, { error: "activity_date is required" });
    if (!Number.isFinite(times) || times < 1)
      return send(res, 400, { error: "times must be >= 1" });

    const thai_year = toThaiYearFromYMD(activity_date);
    if (!thai_year)
      return send(res, 400, { error: "activity_date invalid format" });

    const { data: vol, error: volErr } = await supabaseAdmin
      .from("volunteers")
      .select("volunteer_code, name, branch")
      .eq("volunteer_code", volunteer_code)
      .maybeSingle();

    if (volErr) return send(res, 500, { error: volErr.message });
    if (!vol) return send(res, 404, { error: `ไม่พบ volunteer ${volunteer_code}` });

    const rows = Array.from({ length: times }).map(() => ({
      volunteer_code,
      name: vol.name ?? null,
      branch: vol.branch ?? null,
      status,
      activity_date,
      thai_year,
      is_void: false,
    }));

    const { error: insErr } = await supabaseAdmin
      .from("activity_history")
      .insert(rows);

    if (insErr) return send(res, 500, { error: insErr.message });

    return send(res, 200, {
      data: { inserted: times, volunteer_code, thai_year },
    });
  } catch (e) {
    return send(res, 500, { error: e.message || "Unknown error" });
  }
}
