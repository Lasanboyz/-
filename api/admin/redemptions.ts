// api/admin/redemptions.ts
import { createClient } from "@supabase/supabase-js";

// ✅ ไม่ใช้ @vercel/node เพื่อกัน build พัง
type VercelRequest = {
  method?: string;
  query?: Record<string, any>;
  body?: any;
  headers?: Record<string, any>;
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  json: (data: any) => void;
};

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

const asUpper = (v: any) => String(v ?? "").trim().toUpperCase();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const supabase = getAdminClient();

    // =========================
    // GET: /api/admin/redemptions?status=PENDING&search=...
    // =========================
    if (req.method === "GET") {
      const status = asUpper(req.query?.status ?? "PENDING");
      const search = String(req.query?.search ?? "").trim().toLowerCase();

      const { data: reqRows, error: reqErr } = await supabase
        .from("redemption_requests")
        .select("id, volunteer_id, reward_id, reward_title, qty, points_used, status, created_at, phone_number")

        .eq("status", status)
        .order("created_at", { ascending: false })
        .limit(200);

      if (reqErr) throw reqErr;

      const requests = (reqRows ?? []).filter((r: any) => r?.id);
      if (requests.length === 0) return ok(res, []);

      const rewardIds = Array.from(
        new Set(requests.map((r: any) => String(r.reward_id ?? "").trim()).filter(Boolean))
      );
      const volunteerIds = Array.from(
        new Set(requests.map((r: any) => String(r.volunteer_id ?? "").trim()).filter(Boolean))
      );

      const { data: rewardRows, error: rewardErr } = await supabase
        .from("rewards")
        .select("id, title, stock, image_url")
        .in("id", rewardIds);

      if (rewardErr) throw rewardErr;

      const { data: volRows, error: volErr } = await supabase
        .from("volunteers")
        .select("id, volunteer_code, name, branch, points")
        .in("id", volunteerIds);

      if (volErr) throw volErr;

      const rewardMap = new Map<string, any>();
      for (const r of rewardRows ?? []) rewardMap.set(String(r.id), r);

      const volMap = new Map<string, any>();
      for (const v of volRows ?? []) volMap.set(String(v.id), v);

      let rows = requests.map((r: any) => {
        const reward = rewardMap.get(String(r.reward_id ?? "")) ?? null;
        const vol = volMap.get(String(r.volunteer_id ?? "")) ?? null;

        const rewardTitle = reward?.title ?? r.reward_title ?? "";
        const rewardImage = reward?.image_url ?? "";

        return {
          request_id: r.id,
          status: r.status,
          created_at: r.created_at,
          qty: Number(r.qty ?? 1),
          points_used: Number(r.points_used ?? 0),

          volunteer_id: r.volunteer_id,
          volunteer_code: vol?.volunteer_code ?? "",
          volunteer_name: vol?.name ?? "",
          volunteer_branch: vol?.branch ?? "",

          reward_id: r.reward_id,
          reward_title: rewardTitle,
          reward_cost: 0,
          reward_stock: typeof reward?.stock === "number" ? reward.stock : Number(reward?.stock ?? 0),
          reward_image_url: rewardImage,
        };
      });

      if (search) {
        rows = rows.filter((x: any) => {
          return (
            String(x.volunteer_code ?? "").toLowerCase().includes(search) ||
            String(x.volunteer_name ?? "").toLowerCase().includes(search) ||
            String(x.reward_title ?? "").toLowerCase().includes(search)
          );
        });
      }

      return ok(res, rows);
    }

    // =========================
    // POST: { action:"approve"|"reject", request_id, note? }
    // =========================
    if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      const action = String(body?.action ?? "").toLowerCase();
      const request_id = String(body?.request_id ?? "").trim();
      const note = String(body?.note ?? "").trim();

      if (!request_id) return bad(res, 400, "request_id is required");
      if (!["approve", "reject"].includes(action)) return bad(res, 400, "action must be approve|reject");

      const { data: reqRow, error: reqErr } = await supabase
        .from("redemption_requests")
        .select("id, volunteer_id, reward_id, qty, points_used, status")
        .eq("id", request_id)
        .maybeSingle();

      if (reqErr) throw reqErr;
      if (!reqRow?.id) return bad(res, 404, "request not found");
      if (asUpper(reqRow.status) !== "PENDING")
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

      // load volunteer by volunteer_id
      const { data: vRow, error: vErr } = await supabase
        .from("volunteers")
        .select("id, points")
        .eq("id", reqRow.volunteer_id)
        .maybeSingle();

      if (vErr) throw vErr;
      if (!vRow?.id) return bad(res, 404, "volunteer not found");

      const used = Number(reqRow.points_used ?? 0);
      const currentPoints = Number(vRow.points ?? 0);
      if (currentPoints < used) return bad(res, 400, `points not enough (have=${currentPoints}, need=${used})`);

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

      await supabase.from("point_transactions").insert({
        from_volunteer_id: null,
        to_volunteer_id: vRow.id,
        amount: used,
        type: "deduct", // ✅ แนะนำใช้ deduct (กันชน enum/constraint)
        note: note || `redeem ${reqRow.reward_id} x${qty}`,
      });

      return ok(res, { request_id, status: "APPROVED", deducted: used, stock_after: stock - qty });
    }

    return bad(res, 405, "Method not allowed");
  } catch (e: any) {
    console.error("[api/admin/redemptions] error:", e);
    return bad(res, 500, e?.message || "Internal Server Error", {
      hint:
        "Check env SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY and schema: redemption_requests(volunteer_id,reward_id,points_used), rewards(title,stock,image_url), volunteers(id,volunteer_code,name,branch,points)",
    });
  }
}
