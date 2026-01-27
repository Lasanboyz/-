// api/admin/redemptions.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

function getAdminClient() {
  if (!SUPABASE_URL) throw new Error("Missing env: SUPABASE_URL");
  if (!SERVICE_ROLE_KEY) throw new Error("Missing env: SUPABASE_SERVICE_ROLE_KEY");
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

const ok = (res: VercelResponse, data: any) => res.status(200).json({ ok: true, data });
const bad = (res: VercelResponse, status: number, error: string, extra?: any) =>
  res.status(status).json({ ok: false, error, ...(extra ? { extra } : {}) });

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const supabase = getAdminClient();

    // รองรับ 2 แบบ:
    // 1) GET /api/admin/redemptions?status=PENDING&search=...
    // 2) POST { action:"approve"|"reject", request_id, note? }
    if (req.method === "GET") {
      const status = String(req.query.status ?? "PENDING").toUpperCase();
      const search = String(req.query.search ?? "").trim();

      // ✅ ตารางที่คาดหวัง:
      // redemption_requests: id, volunteer_code, reward_id, qty, points_used, status, created_at, updated_at
      // rewards: id, name, cost, stock, image_url
      // volunteers: volunteer_code, name, branch
      const { data, error } = await supabase
        .from("redemption_requests")
        .select(
          `
          id,
          volunteer_code,
          reward_id,
          qty,
          points_used,
          status,
          created_at,
          rewards:reward_id (
            id,
            name,
            cost,
            stock,
            image_url
          ),
          volunteers:volunteer_code (
            volunteer_code,
            name,
            branch
          )
        `
        )
        .eq("status", status)
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) throw error;

      let rows = (data ?? []).map((r: any) => ({
        request_id: r.id,
        status: r.status,
        created_at: r.created_at,
        qty: Number(r.qty ?? 1),
        points_used: Number(r.points_used ?? 0),

        volunteer_code: r.volunteer_code,
        volunteer_name: r.volunteers?.name ?? "",
        volunteer_branch: r.volunteers?.branch ?? "",

        reward_id: r.reward_id,
        reward_title: r.rewards?.name ?? "",
        reward_cost: Number(r.rewards?.cost ?? 0),
        reward_stock: typeof r.rewards?.stock === "number" ? r.rewards.stock : null,
        reward_image_url: r.rewards?.image_url ?? "",
      }));

      if (search) {
        const s = search.toLowerCase();
        rows = rows.filter((x: any) => {
          return (
            String(x.volunteer_code ?? "").toLowerCase().includes(s) ||
            String(x.volunteer_name ?? "").toLowerCase().includes(s) ||
            String(x.reward_title ?? "").toLowerCase().includes(s)
          );
        });
      }

      return ok(res, rows);
    }

    if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      const action = String(body?.action ?? "").toLowerCase();
      const request_id = String(body?.request_id ?? "").trim();
      const note = String(body?.note ?? "").trim();

      if (!request_id) return bad(res, 400, "request_id is required");
      if (!["approve", "reject"].includes(action)) return bad(res, 400, "action must be approve|reject");

      // load request
      const { data: reqRow, error: reqErr } = await supabase
        .from("redemption_requests")
        .select("id, volunteer_code, reward_id, qty, points_used, status")
        .eq("id", request_id)
        .maybeSingle();

      if (reqErr) throw reqErr;
      if (!reqRow?.id) return bad(res, 404, "request not found");
      if (String(reqRow.status).toUpperCase() !== "PENDING")
        return bad(res, 400, `request is not PENDING (current=${reqRow.status})`);

      if (action === "reject") {
        const { error: updErr } = await supabase
          .from("redemption_requests")
          .update({ status: "REJECTED", admin_note: note || "Rejected by admin" })
          .eq("id", request_id);

        if (updErr) throw updErr;
        return ok(res, { request_id, status: "REJECTED" });
      }

      // approve: check stock
      const { data: rewardRow, error: rewardErr } = await supabase
        .from("rewards")
        .select("id, stock")
        .eq("id", reqRow.reward_id)
        .maybeSingle();

      if (rewardErr) throw rewardErr;
      if (!rewardRow?.id) return bad(res, 404, "reward not found");

      const qty = Math.max(1, Math.floor(Number(reqRow.qty ?? 1)));
      const stock = Number(rewardRow.stock ?? 0);
      if (stock < qty) return bad(res, 400, `stock not enough (stock=${stock}, qty=${qty})`);

      // deduct points from volunteers
      const { data: vRow, error: vErr } = await supabase
        .from("volunteers")
        .select("id, points")
        .eq("volunteer_code", reqRow.volunteer_code)
        .maybeSingle();

      if (vErr) throw vErr;
      if (!vRow?.id) return bad(res, 404, "volunteer not found");

      const used = Number(reqRow.points_used ?? 0);
      const currentPoints = Number(vRow.points ?? 0);
      if (currentPoints < used) return bad(res, 400, `points not enough (have=${currentPoints}, need=${used})`);

      // update in sequence (ง่ายและชัด)
      const { error: updReqErr } = await supabase
        .from("redemption_requests")
        .update({ status: "APPROVED", admin_note: note || "Approved by admin" })
        .eq("id", request_id);
      if (updReqErr) throw updReqErr;

      const { error: updStockErr } = await supabase
        .from("rewards")
        .update({ stock: stock - qty })
        .eq("id", reqRow.reward_id);
      if (updStockErr) throw updStockErr;

      const { error: updPointsErr } = await supabase
        .from("volunteers")
        .update({ points: currentPoints - used })
        .eq("id", vRow.id);
      if (updPointsErr) throw updPointsErr;

      // optional log
      await supabase.from("point_transactions").insert({
        from_volunteer_id: null,
        to_volunteer_id: vRow.id,
        amount: used,
        type: "redeem",
        note: note || `redeem ${reqRow.reward_id} x${qty}`,
      });

      return ok(res, { request_id, status: "APPROVED", deducted: used, stock_after: stock - qty });
    }

    return bad(res, 405, "Method not allowed");
  } catch (e: any) {
    console.error("[api/admin/redemptions] error:", e);
    return bad(res, 500, e?.message || "Internal Server Error", {
      hint: "Check env SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY and tables: redemption_requests, rewards, volunteers",
    });
  }
}
