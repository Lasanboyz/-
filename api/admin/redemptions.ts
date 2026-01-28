// api/admin/redemptions.ts
import { getAdminClient } from "../_lib/supabaseAdmin.js";
import { getBearerToken, verifyJwtHS256 } from "../_lib/jwt.js";

function send(res: any, status: number, body: any) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.end(JSON.stringify(body));
}

function safeParseBody(req: any) {
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

function mustAdmin(payload: any) {
  const role = String(payload?.role ?? "").toUpperCase();
  return role === "ADMIN" || role === "STAFF";
}

export default async function handler(req: any, res: any) {
  try {
    if (req.method === "OPTIONS") return send(res, 200, { ok: true });

    const supabase = getAdminClient();

    // =====================
    // GET: list redemptions
    // =====================
    if (req.method === "GET") {
      const url = new URL(req.url, "http://localhost");
      const status = String(url.searchParams.get("status") || "PENDING").toUpperCase();
      const search = String(url.searchParams.get("search") || "").trim();

      // Auth (admin)
      const token = getBearerToken(req);
      const secret = process.env.APP_JWT_SECRET;
      if (!secret) return send(res, 500, { error: "Missing APP_JWT_SECRET" });

      const payload = verifyJwtHS256(token, secret);
      if (!payload || !mustAdmin(payload)) return send(res, 401, { error: "Unauthorized" });

      let q = supabase
        .from("redemption_requests")
        .select(
          `
          id,
          created_at,
          status,
          qty,
          points_used,
          reward_id,
          reward_title,
          phone_number,
          volunteer_id,
          volunteers:volunteer_id ( volunteer_code, name, branch ),
          rewards:reward_id ( title, image_url, stock )
        `
        )
        .order("created_at", { ascending: false });

      if (status) q = q.eq("status", status);
      if (search) {
        // search by volunteer_code / name / reward_title (best effort)
        q = q.or(
          `reward_title.ilike.%${search}%,volunteers.name.ilike.%${search}%,volunteers.volunteer_code.ilike.%${search}%`
        );
      }

      const { data, error } = await q.limit(200);
      if (error) return send(res, 500, { error: error.message });

      const rows =
        (data || []).map((r: any) => ({
          request_id: r.id,
          created_at: r.created_at,
          status: r.status,
          qty: r.qty,
          points_used: r.points_used,

          reward_id: r.reward_id,
          reward_title: r.rewards?.title || r.reward_title,
          reward_image_url: r.rewards?.image_url ?? null,
          reward_stock: r.rewards?.stock ?? null,

          volunteer_id: r.volunteer_id,
          volunteer_code: r.volunteers?.volunteer_code ?? "",
          volunteer_name: r.volunteers?.name ?? "",
          volunteer_branch: r.volunteers?.branch ?? "",
        })) || [];

      return send(res, 200, { ok: true, rows });
    }

    // =====================
    // POST: approve/reject
    // =====================
    if (req.method !== "POST") return send(res, 405, { error: "Method Not Allowed" });

    // Auth (admin)
    const token = getBearerToken(req);
    const secret = process.env.APP_JWT_SECRET;
    if (!secret) return send(res, 500, { error: "Missing APP_JWT_SECRET" });

    const payload = verifyJwtHS256(token, secret);
    if (!payload || !mustAdmin(payload)) return send(res, 401, { error: "Unauthorized" });

    const body = safeParseBody(req);
    const action = String(body.action || "").toUpperCase();
    const request_id = String(body.request_id || "").trim();

    if (!request_id) return send(res, 400, { error: "request_id is required" });
    if (!["APPROVE", "REJECT"].includes(action)) return send(res, 400, { error: "Invalid action" });

    // Load request
    const { data: reqRow, error: reqErr } = await supabase
      .from("redemption_requests")
      .select("id, status, volunteer_id, reward_id, qty, points_used, reward_title")
      .eq("id", request_id)
      .maybeSingle();

    if (reqErr) return send(res, 500, { error: reqErr.message });
    if (!reqRow) return send(res, 404, { error: "Request not found" });

    const status = String(reqRow.status || "").toUpperCase();
    if (status !== "PENDING") {
      // idempotent: ไม่ทำซ้ำ
      return send(res, 200, { ok: true, result: { message: `Already ${status}`, request_id } });
    }

    const nowIso = new Date().toISOString();

    if (action === "APPROVE") {
      // check reward stock
      const { data: reward, error: rewardErr } = await supabase
        .from("rewards")
        .select("id, stock, title")
        .eq("id", reqRow.reward_id)
        .maybeSingle();

      if (rewardErr) return send(res, 500, { error: rewardErr.message });
      if (!reward) return send(res, 404, { error: "Reward not found" });

      const stock = Number(reward.stock ?? 0);
      const qty = Number(reqRow.qty ?? 1);
      if (stock < qty) return send(res, 400, { error: "Stock not enough" });

      // 1) mark approved
      const { error: updReqErr } = await supabase
        .from("redemption_requests")
        .update({
          status: "APPROVED",
          approved_at: nowIso,
          approved_by: String(payload?.volunteer_code ?? payload?.volunteer_id ?? "ADMIN"),
        })
        .eq("id", request_id);

      if (updReqErr) return send(res, 500, { error: updReqErr.message });

      // 2) deduct stock
      const { error: updStockErr } = await supabase
        .from("rewards")
        .update({ stock: stock - qty })
        .eq("id", reward.id);

      if (updStockErr) return send(res, 500, { error: updStockErr.message });

      // 3) optional: log finalize (ไม่หักแต้มเพิ่ม)
      const { error: txErr } = await supabase.from("point_transactions").insert({
        from_volunteer_id: reqRow.volunteer_id,
        to_volunteer_id: null,
        amount: Number(reqRow.points_used ?? 0),
        type: "redeem_finalize",
        note: `redeem approved: ${reward.title} x${qty}`,
      });

      if (txErr) console.error("[admin redemptions] finalize tx log error:", txErr);

      return send(res, 200, {
        ok: true,
        result: { request_id, status: "APPROVED", stock_after: stock - qty },
      });
    }

    // action === "REJECT"
    {
      const pointsUsed = Number(reqRow.points_used ?? 0);

      // 1) refund points (เพราะตอน PENDING เราหักไปแล้ว)
      const { data: vol, error: volErr } = await supabase
        .from("volunteers")
        .select("id, points")
        .eq("id", reqRow.volunteer_id)
        .maybeSingle();

      if (volErr) return send(res, 500, { error: volErr.message });
      if (!vol) return send(res, 404, { error: "Volunteer not found" });

      const current = Number(vol.points ?? 0);
      const refunded = current + pointsUsed;

      const { error: updVolErr } = await supabase
        .from("volunteers")
        .update({ points: refunded })
        .eq("id", vol.id);

      if (updVolErr) return send(res, 500, { error: updVolErr.message });

      // 2) mark rejected
      const { error: updReqErr } = await supabase
        .from("redemption_requests")
        .update({
          status: "REJECTED",
          rejected_at: nowIso,
          rejected_by: String(payload?.volunteer_code ?? payload?.volunteer_id ?? "ADMIN"),
          reject_reason: String(body.reject_reason ?? "").trim() || null,
        })
        .eq("id", request_id);

      if (updReqErr) return send(res, 500, { error: updReqErr.message });

      // 3) log refund
      const { error: txErr } = await supabase.from("point_transactions").insert({
        from_volunteer_id: null,
        to_volunteer_id: reqRow.volunteer_id,
        amount: pointsUsed,
        type: "redeem_refund",
        note: `redeem rejected refund: ${reqRow.reward_title ?? ""}`.trim(),
      });

      if (txErr) console.error("[admin redemptions] refund tx log error:", txErr);

      return send(res, 200, {
        ok: true,
        result: { request_id, status: "REJECTED", refunded_points: pointsUsed, points_after: refunded },
      });
    }
  } catch (e: any) {
    console.error("[api/admin/redemptions] error:", e);
    return send(res, 500, { error: e?.message || "Unknown error" });
  }
}
