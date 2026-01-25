// /api/admin/addActivity.js
const { createClient } = require("@supabase/supabase-js");

function send(res, status, body) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  return res.status(status).send(JSON.stringify(body));
}

function safeParseBody(req) {
  // Vercel บางครั้งให้ body เป็น string
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

function isValidYMD(ymd) {
  // YYYY-MM-DD แบบง่าย ๆ
  return /^\d{4}-\d{2}-\d{2}$/.test(String(ymd || "").trim());
}

function toThaiYearFromYMD(ymd) {
  // ใช้ UTC กันเพี้ยนเวลา
  const d = new Date(`${ymd}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return d.getUTCFullYear() + 543;
}

module.exports = async (req, res) => {
  try {
    // preflight
    if (req.method === "OPTIONS") return send(res, 200, { ok: true });

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    // health check
    if (req.method === "GET") {
      return send(res, 200, {
        ok: true,
        route: "/api/admin/addActivity",
        hasEnv: {
          SUPABASE_URL: !!SUPABASE_URL,
          SUPABASE_SERVICE_ROLE_KEY: !!SERVICE_KEY,
        },
      });
    }

    if (req.method !== "POST") return send(res, 405, { error: "Method Not Allowed" });

    // ✅ เช็ก env ก่อนสร้าง client (กัน crash ตอนโหลดไฟล์)
    if (!SUPABASE_URL || !SERVICE_KEY) {
      return send(res, 500, { error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" });
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY);

    const body = safeParseBody(req);

    const volunteer_code = String(body.volunteer_code ?? "").trim().toUpperCase();
    const times = Math.floor(Number(body.times ?? 1));
    const activity_date = String(body.activity_date ?? "").trim(); // YYYY-MM-DD
    const status = String(body.status ?? "VOLUNTEER").trim().toUpperCase();

    if (!volunteer_code) return send(res, 400, { error: "volunteer_code is required" });
    if (!activity_date) return send(res, 400, { error: "activity_date is required (YYYY-MM-DD)" });
    if (!isValidYMD(activity_date)) return send(res, 400, { error: "activity_date invalid format (YYYY-MM-DD)" });
    if (!Number.isFinite(times) || times < 1) return send(res, 400, { error: "times must be >= 1" });
    if (!["VOLUNTEER", "ADMIN"].includes(status)) {
      return send(res, 400, { error: "status must be VOLUNTEER|ADMIN" });
    }

    const thai_year = toThaiYearFromYMD(activity_date);
    if (!thai_year) return send(res, 400, { error: "activity_date invalid date" });

    // ดึงชื่อ/สาขา จาก volunteers (service role = bypass RLS)
    const { data: vol, error: volErr } = await supabaseAdmin
      .from("volunteers")
      .select("volunteer_code, name, branch")
      .eq("volunteer_code", volunteer_code)
      .maybeSingle();

    if (volErr) return send(res, 500, { error: volErr.message });
    if (!vol) return send(res, 404, { error: `ไม่พบ volunteer: ${volunteer_code}` });

    const rows = Array.from({ length: times }).map(() => ({
      volunteer_code,
      name: vol.name ?? null,
      branch: vol.branch ?? null,
      status,
      activity_date,
      thai_year,
      is_void: false,
    }));

    const { error: insErr } = await supabaseAdmin.from("activity_history").insert(rows);
    if (insErr) return send(res, 500, { error: insErr.message });

    return send(res, 200, { data: { inserted: times, thai_year, volunteer_code } });
  } catch (e) {
    return send(res, 500, { error: e?.message || "Unknown error" });
  }
};
