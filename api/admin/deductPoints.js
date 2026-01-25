// api/admin/deductPoints.js
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
    try {
      return JSON.parse(b);
    } catch {
      return {};
    }
  }
  return {};
}

export default async function handler(req, res) {
  try {
    if (req.method === "OPTIONS") return send(res, 200, { ok: true });

    if (req.method === "GET") {
      return send(res, 200, {
        ok: true,
        route: "/api/admin/deductPoints",
        hasEnv: {
          SUPABASE_URL: Boolean(supabaseUrl),
          SUPABASE_SERVICE_ROLE_KEY: Boolean(serviceKey),
        },
      });
    }

    if (req.method !== "POST") return send(res, 405, { error: "Method Not Allowed" });
    if (!supabaseUrl || !serviceKey) return send(res, 500, { error: "Missing env" });

    const body = safeParseBody(req);

    const volunteer_code = String(body.volunteer_code ?? "").trim().toUpperCase();
    const amount = Number(body.amount ?? 0);
    const note = String(body.note ?? "admin deduct").trim();

    if (!volunteer_code) return send(res, 400, { error: "volunteer_code is required" });
    if (!Number.isFinite(amount) || amount <= 0) return send(res, 400, { error: "amount must be > 0" });

    // 1) load volunteer
    const { data: v, error: vErr } = await supabaseAdmin
      .from("volunteers")
      .select("id, points")
      .eq("volunteer_code", volunteer_code)
      .maybeSingle();

    if (vErr) return send(res, 500, { error: vErr.message });
    if (!v?.id) return send(res, 404, { error: `ไม่พบพนักงาน: ${volunteer_code}` });

    const current = Number(v.points ?? 0);
    if (current < amount) return send(res, 400, { error: `แต้มไม่พอ (คงเหลือ ${current})` });

    // 2) update points (service role -> ผ่านแน่นอน)
    const newPoints = current - amount;
    const { error: updErr } = await supabaseAdmin
      .from("volunteers")
      .update({ points: newPoints })
      .eq("id", v.id);

    if (updErr) return send(res, 500, { error: updErr.message });

    // 3) insert transaction log
    const { error: txErr } = await supabaseAdmin.from("point_transactions").insert({
      from_volunteer_id: null,
      to_volunteer_id: v.id,
      amount,
      type: "deduct",
      note,
    });

    if (txErr) return send(res, 500, { error: txErr.message });

    return send(res, 200, {
      data: { ok: true, volunteer_code, before: current, after: newPoints, deducted: amount },
    });
  } catch (e) {
    return send(res, 500, { error: e?.message || "Unknown error" });
  }
}
