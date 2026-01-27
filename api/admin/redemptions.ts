import { getAdminClient } from "../../lib/supabaseAdmin.js";
import { getBearerToken, verifyJwtHS256 } from "../../lib/jwt.js";

async function assertAdmin(supabase: any, volunteerId: string) {
  const { data, error } = await supabase
    .from("volunteers")
    .select("id, role")
    .eq("id", volunteerId)
    .single();

  if (error || !data) throw new Error("Unauthorized");
  if (data.role !== "ADMIN") throw new Error("Forbidden");
}

export default async function handler(req: any, res: any) {
  try {
    const token = getBearerToken(req);
    const secret = process.env.APP_JWT_SECRET;
    if (!secret) return res.status(500).json({ error: "Missing APP_JWT_SECRET" });

    const payload = verifyJwtHS256(token, secret);
    if (!payload?.volunteer_id) return res.status(401).json({ error: "Unauthorized" });

    const supabase = getAdminClient();
    await assertAdmin(supabase, payload.volunteer_id);

    // ✅ 1) LIST: GET /api/admin/redemptions?status=PENDING&search=...
    if (req.method === "GET") {
      const status = (req.query?.status ?? "PENDING") as string;
      const search = (req.query?.search ?? null) as string | null;

      const { data, error } = await supabase.rpc("admin_list_redemptions", {
        p_status: status,
        p_search: search,
        p_page: 1,
        p_page_size: 50,
      });

      if (error) return res.status(400).json({ error: error.message || "List failed" });
      return res.status(200).json({ ok: true, rows: data ?? [] });
    }

    // ✅ 2) ACTION: POST /api/admin/redemptions  body: { action: "APPROVE"|"REJECT", request_id: "..." }
    if (req.method === "POST") {
      const { action, request_id } = req.body || {};
      if (!request_id) return res.status(400).json({ error: "Missing request_id" });

      if (action === "APPROVE") {
        const { data, error } = await supabase.rpc("admin_approve_redemption_v2", {
          p_request_id: request_id,
        });
        if (error) return res.status(400).json({ error: error.message || "Approve failed" });
        const row = Array.isArray(data) ? data[0] : data;
        if (!row?.ok) return res.status(400).json({ error: row?.message || "Approve failed" });
        return res.status(200).json({ ok: true, result: row });
      }

      if (action === "REJECT") {
        const { data, error } = await supabase.rpc("admin_reject_redemption_v2", {
          p_request_id: request_id,
        });
        if (error) return res.status(400).json({ error: error.message || "Reject failed" });
        const row = Array.isArray(data) ? data[0] : data;
        if (!row?.ok) return res.status(400).json({ error: row?.message || "Reject failed" });
        return res.status(200).json({ ok: true, result: row });
      }

      return res.status(400).json({ error: "Invalid action (use APPROVE or REJECT)" });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (e: any) {
    const msg = e?.message || "Internal error";
    const code = msg === "Forbidden" ? 403 : msg === "Unauthorized" ? 401 : 500;
    return res.status(code).json({ error: msg });
  }
}
