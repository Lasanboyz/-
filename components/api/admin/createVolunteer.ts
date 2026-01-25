import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function send(res: any, status: number, body: any) {
  // กันเคส preflight / แปลก ๆ ให้ผ่านแบบไม่พัง
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  return res.status(status).send(JSON.stringify(body));
}

export default async function handler(req: any, res: any) {
  // ✅ Preflight (บางเคส Vercel/Browser จะยิงมา)
  if (req.method === "OPTIONS") {
    return send(res, 200, { ok: true });
  }

  // ✅ GET ใช้เช็คว่า route ทำงาน
  if (req.method === "GET") {
    return send(res, 200, { ok: true, route: "/api/admin/createVolunteer" });
  }

  // ✅ POST เท่านั้นที่สร้างจริง
  if (req.method !== "POST") {
    return send(res, 200, { ok: false, message: "Unsupported method (ignored)" });
  }

  try {
    // บางที req.body อาจเป็น string → parse เผื่อไว้
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const { volunteer_code, name, branch } = body;

    const code = String(volunteer_code ?? "").trim().toUpperCase();
    const n = String(name ?? "").trim();
    const b = String(branch ?? "").trim();

    if (!code) return send(res, 400, { error: "volunteer_code is required" });
    if (!n) return send(res, 400, { error: "name is required" });
    if (!b) return send(res, 400, { error: "branch is required" });

    // กันซ้ำ: ถ้ามีอยู่แล้วคืนตัวเดิม
    const { data: exist, error: existErr } = await supabaseAdmin
      .from("volunteers")
      .select("id, volunteer_code, name, branch, points")
      .eq("volunteer_code", code)
      .maybeSingle();

    if (existErr) return send(res, 500, { error: existErr.message });
    if (exist?.id) return send(res, 200, { data: exist });

    // สร้างใหม่
    const { data, error } = await supabaseAdmin
      .from("volunteers")
      .insert({ volunteer_code: code, name: n, branch: b, points: 0 })
      .select("id, volunteer_code, name, branch, points")
      .single();

    if (error) return send(res, 500, { error: error.message });

    return send(res, 200, { data });
  } catch (e: any) {
    return send(res, 500, { error: e?.message || "Unknown error" });
  }
}
