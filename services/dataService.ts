// services/dataService.ts
import type { Volunteer, Reward, RedemptionRequest, RankConfig } from "../types";
import { supabase } from "./supabaseClient";

// ===============================
// Utils (Thai Year)
// ===============================
export const getCurrentThaiYear = () => new Date().getFullYear() + 543;
export const getFiscalYear = (date: Date) => date.getFullYear() + 543;

// ===============================
// Local fallback (Rewards / Requests)
// ===============================
class DataService {
  private rewards: Reward[] = [];
  private redemptionRequests: RedemptionRequest[] = [];

  constructor() {
    this.initLocal();
  }

  private initLocal() {
    const savedReqs = localStorage.getItem("requests_v16");
    if (savedReqs) this.redemptionRequests = JSON.parse(savedReqs);

    // NOTE: ใช้เป็น fallback เฉยๆ (ตอนนี้ฝั่งจริงคุณใช้ rewards table + /api/rewards/* แล้ว)
    this.rewards = [
      {
        id: "r1",
        name: "กระเป๋าผ้าลดโลกร้อน",
        cost: 50,
        stock: 10,
        imageUrl: "https://i.postimg.cc/d1c6T7xn/1768933261970.jpg?auto=format&fit=crop&q=80&w=300",
      },
      {
        id: "r2",
        name: "แก้วน้ำเก็บความเย็น",
        cost: 100,
        stock: 10,
        imageUrl: "https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&q=80&w=300",
      },
      {
        id: "r3",
        name: "เสื้อยืดอาสา",
        cost: 100,
        stock: 10,
        imageUrl: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&q=80&w=300",
      },
      {
        id: "r4",
        name: "หมวกร่มลมเย็น",
        cost: 100,
        stock: 10,
        imageUrl: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&q=80&w=300",
      },
      {
        id: "r5",
        name: "บัตรกำนัล 100 บาท",
        cost: 100,
        stock: 10,
        imageUrl: "https://i.postimg.cc/XNdJ8rDC/images-(27).jpg?auto=format&fit=crop&q=80&w=300",
      },
    ];
  }

  public getRewards() {
    return this.rewards;
  }
  public getRequests() {
    return this.redemptionRequests;
  }
  public addRequest(req: RedemptionRequest) {
    this.redemptionRequests.push(req);
    localStorage.setItem("requests_v16", JSON.stringify(this.redemptionRequests));
  }
  public updateRequest(req: RedemptionRequest) {
    const idx = this.redemptionRequests.findIndex((r) => r.id === req.id);
    if (idx >= 0) {
      this.redemptionRequests[idx] = req;
      localStorage.setItem("requests_v16", JSON.stringify(this.redemptionRequests));
    }
  }
}

export const dataService = new DataService();

// ===============================
// Shared helpers
// ===============================
const normalizeStatus = (v: any) => String(v ?? "").trim().toUpperCase();
const normalizeCode = (v: any) => String(v ?? "").trim().toUpperCase();
const isNoScoreYear = (year: number) => year >= 2557 && year <= 2568;

// ===============================
// Rank logic
// ===============================
export function getRank(points: number, activityCount: number = 0): RankConfig {
  if (points > 200 || activityCount > 10) {
    return {
      name: "ผู้มีพลังขับเคลื่อนสังคม",
      minPoints: 201,
      icon: "🔥",
      color: "bg-orange-100 text-orange-600",
    };
  }
  if (points > 100 || activityCount >= 5) {
    return {
      name: "นักสร้างสรรค์แบ่งปันโอกาส",
      minPoints: 101,
      icon: "🌳",
      color: "bg-teal-100 text-teal-600",
    };
  }
  if (points > 50 || activityCount >= 3) {
    return {
      name: "เพื่อนชุมชน",
      minPoints: 51,
      icon: "🌿",
      color: "bg-green-100 text-green-600",
    };
  }
  return {
    name: "ผู้เริ่มต้นแบ่งปัน",
    minPoints: 0,
    icon: "🌱",
    color: "bg-lime-100 text-lime-600",
  };
}

// ===============================
// Supabase: Volunteers (Search on Home)
// ===============================
export async function fetchVolunteerByCode(volunteerCode: string) {
  const code = (volunteerCode ?? "").trim();
  if (!code) return null;

  const { data, error } = await supabase
    .from("volunteers")
    .select("id, volunteer_code, name, branch, role")
    .eq("volunteer_code", code)
    .maybeSingle();

  if (error) {
    console.error("[Supabase] fetchVolunteerByCode error:", error);
    return null;
  }
  return data ?? null;
}

export function mapVolunteerRowToVolunteer(row: any): Volunteer {
  return {
    id: row.id,
    empId: row.volunteer_code,
    name: row.name ?? "",
    type: row.branch ?? "",
  } as Volunteer;
}

// ===============================
// Supabase: Activity History (Profile/History page)
// ===============================
export async function fetchActivityHistoryByCode(volunteerCode: string, thaiYear?: number) {
  const code = (volunteerCode ?? "").trim();
  if (!code) return [];

  let q = supabase
    .from("activity_history")
    .select("id, volunteer_code, name, branch, status, activity_date, thai_year, created_at, is_void")
    .eq("volunteer_code", code)
    .eq("is_void", false)
    .order("activity_date", { ascending: false })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });

  if (thaiYear && thaiYear > 0) q = q.eq("thai_year", thaiYear);

  const { data, error } = await q;

  if (error) {
    console.error("[Supabase] fetchActivityHistoryByCode error:", error);
    return [];
  }
  return data ?? [];
}

export async function getVolunteerSummaryFromHistory(volunteerCode: string, thaiYear: number) {
  const rowsThisYear = await fetchActivityHistoryByCode(volunteerCode, thaiYear);
  const activityCount = rowsThisYear.length;

  let points = 0;
  if (!isNoScoreYear(thaiYear)) points = activityCount * 20;

  const isAdmin = rowsThisYear.some((r: any) => normalizeStatus(r.status) === "ADMIN");
  return { points, activityCount, isAdmin, rowsThisYear };
}

// ===============================
// Leaderboard (Compute from activity_history directly)
// ===============================
export type LeaderboardMode = "VOLUNTEERS" | "ADMIN";

export type LeaderboardSummaryRow = {
  volunteer_code: string;
  name: string;
  branch: string;
  activity_count: number;
  points: number;
  thai_year?: number;
};

type ActivityRow = {
  id: string;
  created_at: string; // supabase returns ISO string
  volunteer_code: string | null;
  name: string | null;
  branch: string | null;
  status: string | null;
  activity_date: string | null; // YYYY-MM-DD
  thai_year: number | string | null;
};

// ---- year derive ----
const parseThaiYear = (v: any): number | undefined => {
  if (v === null || v === undefined || v === "") return undefined;
  const n = typeof v === "number" ? v : Number(String(v).trim());
  return Number.isFinite(n) ? n : undefined;
};

const thaiYearFromActivityDate = (activityDate: any): number | undefined => {
  if (!activityDate) return undefined;
  const d = new Date(`${activityDate}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.getUTCFullYear() + 543;
};

const deriveThaiYear = (r: ActivityRow): number | undefined => {
  return parseThaiYear(r.thai_year) ?? thaiYearFromActivityDate(r.activity_date);
};

/**
 * ✅ KEYSET pagination (created_at + id) — กันซ้ำ/กันหลุด 100%
 * หมดปัญหา .range() แล้วเลขเพี้ยน
 */
export async function fetchLeaderboardSummary(mode: LeaderboardMode, thaiYear: number): Promise<LeaderboardSummaryRow[]> {
  const PAGE_SIZE = 1000;

  const allRows: ActivityRow[] = [];
  const seen = new Set<string>();

  let lastCreatedAt: string | null = null;
  let lastId: string | null = null;

  while (true) {
    let q = supabase
      .from("activity_history")
      .select("id, created_at, volunteer_code, name, branch, status, activity_date, thai_year")
      .eq("is_void", false);

    // filter by thai_year when user selects a year (fast path)
    if (thaiYear && thaiYear !== 0) q = q.eq("thai_year", thaiYear);

    // ✅ keyset cursor: (created_at > lastCreatedAt) OR (created_at = lastCreatedAt AND id > lastId)
    if (lastCreatedAt && lastId) {
      q = q.or(`created_at.gt.${lastCreatedAt},and(created_at.eq.${lastCreatedAt},id.gt.${lastId})`);
    }

    // ✅ stable order
    q = q.order("created_at", { ascending: true }).order("id", { ascending: true }).limit(PAGE_SIZE);

    const { data, error } = await q;

    if (error) {
      console.error("[Supabase] fetchLeaderboardSummary error:", error);
      throw new Error(error.message);
    }

    const batch = (data ?? []) as ActivityRow[];
    if (batch.length === 0) break;

    for (const r of batch) {
      if (!r?.id) continue;
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      allRows.push(r);
    }

    const last = batch[batch.length - 1];
    lastCreatedAt = last?.created_at ?? lastCreatedAt;
    lastId = last?.id ?? lastId;

    if (batch.length < PAGE_SIZE) break;
  }

  // aggregate
  const map = new Map<string, LeaderboardSummaryRow>();

  for (const r of allRows) {
    const code = normalizeCode(r.volunteer_code);
    if (!code) continue;

    const status = normalizeStatus(r.status);
    const rowIsAdmin = status === "ADMIN";

    if (mode === "ADMIN" && !rowIsAdmin) continue;
    if (mode === "VOLUNTEERS" && rowIsAdmin) continue;

    const rowYear = deriveThaiYear(r);
    if (thaiYear && thaiYear !== 0) {
      // double safety
      if (rowYear !== thaiYear) continue;
    }

    const prev =
      map.get(code) ??
      ({
        volunteer_code: code,
        name: r.name ?? "",
        branch: r.branch ?? "",
        activity_count: 0,
        points: 0,
        thai_year: thaiYear !== 0 ? thaiYear : undefined,
      } as LeaderboardSummaryRow);

    prev.activity_count += 1;

    const effectiveYear = thaiYear !== 0 ? thaiYear : rowYear;
    if (typeof effectiveYear === "number" && !isNoScoreYear(effectiveYear)) {
      prev.points += 20;
    }

    if (!prev.name && r.name) prev.name = r.name;
    if (!prev.branch && r.branch) prev.branch = r.branch;

    map.set(code, prev);
  }

  return Array.from(map.values());
}

// ===============================
// Backward-compat
// ===============================
export async function getVolunteers() {
  return await fetchLeaderboardSummary("VOLUNTEERS", 0);
}
export async function getAdmins() {
  return await fetchLeaderboardSummary("ADMIN", 0);
}

// ===============================
// Points Transfer (point_transactions)
// ===============================
type VolunteerRow = {
  id: string;
  volunteer_code: string;
  name?: string | null;
  branch?: string | null;
  points?: number | null;
};

async function getVolunteerByCodeForPoints(codeRaw: string): Promise<VolunteerRow | null> {
  const code = String(codeRaw ?? "").trim().toUpperCase();
  if (!code) return null;

  const { data, error } = await supabase
    .from("volunteers")
    .select("id, volunteer_code, name, branch, points")
    .eq("volunteer_code", code)
    .maybeSingle();

  if (error) {
    console.error("[Supabase] getVolunteerByCodeForPoints error:", error);
    return null;
  }
  return (data as any) ?? null;
}

export async function transferPoints(params: {
  fromVolunteerCode: string;
  toVolunteerCode: string;
  amount: number;
  note?: string;
}) {
  const fromCode = String(params.fromVolunteerCode ?? "").trim().toUpperCase();
  const toCode = String(params.toVolunteerCode ?? "").trim().toUpperCase();
  const amount = Math.floor(Number(params.amount ?? 0));
  const note = String(params.note ?? "").trim();

  if (!fromCode || !toCode) throw new Error("กรุณากรอกรหัสผู้โอน/ผู้รับให้ครบ");
  if (fromCode === toCode) throw new Error("ห้ามโอนให้รหัสเดียวกัน");
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("จำนวนแต้มต้องมากกว่า 0");

  // ✅ ให้ DB ทำทั้งหมด: lock + check PENDING + ตัด/บวก points + insert log
  const { data, error } = await supabase.rpc("transfer_points_atomic", {
    p_from_code: fromCode,
    p_to_code: toCode,
    p_amount: amount,
    p_note: note || null,
  });

  if (error) {
    console.error("[Supabase] transfer_points_atomic error:", error);

    const msg = String(error.message || "").toLowerCase();

    if (msg.includes("insufficient points")) {
      // มักเกิดจากมีรายการแลกของรางวัล PENDING ล็อกแต้มไว้
      throw new Error("แต้มไม่พอ (มีแต้มที่ถูกล็อกจากการแลกรางวัลที่รออนุมัติ)");
    }
    if (msg.includes("cannot transfer to yourself")) throw new Error("ห้ามโอนให้ตัวเอง");
    if (msg.includes("from not found")) throw new Error(`ไม่พบผู้โอน: ${fromCode}`);
    if (msg.includes("to not found")) throw new Error(`ไม่พบผู้รับ: ${toCode}`);

    throw new Error(error.message);
  }

  return data;
}

export async function fetchVolunteerPointsByCode(volunteerCode: string) {
  const v = await getVolunteerByCodeForPoints(volunteerCode);
  if (!v) return null;
  return { points: Number(v.points ?? 0), id: v.id, volunteer_code: v.volunteer_code };
}

// ===============================
// Admin: Adjust Points (Give / Deduct) + Logs
// ===============================
export async function adminGivePoints(params: { toVolunteerCode: string; amount: number; note?: string }) {
  const toCode = String(params.toVolunteerCode ?? "").trim().toUpperCase();
  const amount = Number(params.amount ?? 0);
  const note = String(params.note ?? "").trim();

  if (!toCode) throw new Error("กรุณากรอกรหัสผู้รับ");
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("จำนวนแต้มต้องมากกว่า 0");

  const toV = await getVolunteerByCodeForPoints(toCode);
  if (!toV) throw new Error(`ไม่พบผู้รับ: ${toCode}`);

  const { error } = await supabase.from("point_transactions").insert({
    from_volunteer_id: null,
    to_volunteer_id: toV.id,
    amount,
    type: "adjustment",
    note: note || `admin give +${amount} to ${toCode}`,
  });

  if (error) {
    console.error("[Supabase] adminGivePoints error:", error);
    throw new Error(error.message);
  }

  return true;
}

export async function adminDeductPoints(params: { volunteerCode: string; amount: number; note?: string }) {
  const code = String(params.volunteerCode ?? "").trim().toUpperCase();
  const amount = Math.floor(Number(params.amount ?? 0));
  const note = String(params.note ?? "").trim();

  if (!code) throw new Error("กรุณากรอกรหัสพนักงาน");
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("จำนวนแต้มต้องมากกว่า 0");

  const v = await getVolunteerByCodeForPoints(code);
  if (!v) throw new Error(`ไม่พบพนักงาน: ${code}`);

  // ✅ (optional) เช็กแต้มก่อนหัก เพื่อ UX ดี / error ชัด
  // แต่ตัวจริงจะถูกกันซ้ำด้วย trigger check_non_negative_on_deduct() อยู่แล้ว
  const current = Number(v.points ?? 0);
  if (current < amount) throw new Error(`แต้มไม่พอ (คงเหลือ ${current})`);

  // ✅ ทำแค่ "log" แล้วให้ trigger trg_update_points ไปหักแต้มเอง
  const { error } = await supabase.from("point_transactions").insert({
    from_volunteer_id: null,
    to_volunteer_id: v.id,
    amount,
    type: "deduct",
    note: note || `admin deduct -${amount} from ${code}`,
  });

  if (error) {
    console.error("[Supabase] adminDeductPoints error:", error);

    const msg = String(error.message || "").toLowerCase();
    // กันข้อความ error ที่อ่านง่ายขึ้น (เผื่อ trigger โยน error มา)
    if (msg.includes("insufficient") || msg.includes("non-negative") || msg.includes("negative")) {
      throw new Error("แต้มไม่พอสำหรับการหัก");
    }

    throw new Error(error.message);
  }

  return true;
}

export async function adminFetchPointHistory(volunteerId: string) {
  const id = String(volunteerId ?? "").trim();
  if (!id) return [];

  const { data, error } = await supabase
    .from("point_transactions_view")
    .select("*")
    .or(`from_volunteer_id.eq.${id},to_volunteer_id.eq.${id}`)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error("[Supabase] adminFetchPointHistory error:", error);
    return [];
  }

  return data ?? [];
}

// ===============================
// Admin: Add activity (manual) - existing (kept)
// ===============================
export async function addActivityOnce(params: {
  volunteerCode: string;
  name?: string;
  branch?: string;
  status?: "VOLUNTEER" | "ADMIN";
  activityDate?: string; // YYYY-MM-DD
}) {
  const code = params.volunteerCode.trim().toUpperCase();
  if (!code) throw new Error("volunteerCode is required");

  const date = params.activityDate ? new Date(params.activityDate) : new Date();
  const thaiYear = date.getFullYear() + 543;

  const { error } = await supabase.from("activity_history").insert({
    volunteer_code: code,
    name: params.name ?? null,
    branch: params.branch ?? null,
    status: params.status ?? "VOLUNTEER",
    activity_date: date.toISOString().slice(0, 10),
    thai_year: thaiYear,
    is_void: false,
  });

  if (error) {
    console.error("[addActivityOnce] error:", error);
    throw new Error(error.message);
  }

  return true;
}

// ===============================
// Admin API helpers (Service role endpoints)
// ===============================
async function callAdminApi<T>(path: string, body: any): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const json = await res.json().catch(() => ({} as any));
  if (!res.ok) throw new Error(json?.error || `API error ${res.status}`);

  // บาง endpoint คืน { ok:true, ... } บาง endpoint คืน { data: ... }
  return (json?.data ?? json) as T;
}

export async function createVolunteer(params: { volunteerCode: string; name: string; branch: string; isStaff?: boolean }) {
  const volunteerCode = String(params.volunteerCode ?? "").trim().toUpperCase();
  const name = String(params.name ?? "").trim();
  const branch = String(params.branch ?? "").trim();

  if (!volunteerCode) throw new Error("กรุณากรอกรหัสอาสา/รหัสพนักงาน");
  if (!name) throw new Error("กรุณากรอกชื่อ-นามสกุล");
  if (!branch) throw new Error("กรุณากรอกสังกัด/พื้นที่");

  const res = await fetch("/api/admin/createVolunteer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ volunteer_code: volunteerCode, name, branch }),
  });

  const json = await res.json().catch(() => ({} as any));
  if (!res.ok) throw new Error(json?.error || `API error ${res.status}`);

  return json?.data ?? null;
}

// =====================================================
// Admin functions (existing)
// =====================================================
export type VolunteerRole = "VOLUNTEER" | "STAFF" | "ADMIN";

export async function adminCreateVolunteer(params: { volunteer_code: string; name: string; branch: string }) {
  const volunteer_code = String(params.volunteer_code ?? "").trim().toUpperCase();
  const name = String(params.name ?? "").trim();
  const branch = String(params.branch ?? "").trim();

  if (!volunteer_code) throw new Error("volunteer_code is required");
  if (!name) throw new Error("name is required");
  if (!branch) throw new Error("branch is required");

  const { data: exist, error: existErr } = await supabase
    .from("volunteers")
    .select("id, volunteer_code, name, branch, points")
    .eq("volunteer_code", volunteer_code)
    .maybeSingle();

  if (existErr) throw new Error(existErr.message);
  if (exist?.id) return exist;

  const { data, error } = await supabase
    .from("volunteers")
    .insert({ volunteer_code, name, branch, points: 0 })
    .select("id, volunteer_code, name, branch, points")
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function adminAddActivity(params: {
  volunteer_code: string;
  times: number;
  activity_date: string; // YYYY-MM-DD
  status: "VOLUNTEER" | "ADMIN";
}) {
  const code = String(params.volunteer_code ?? "").trim().toUpperCase();
  const times = Math.floor(Number(params.times));

  if (!code) throw new Error("volunteer_code is required");
  if (!params.activity_date) throw new Error("activity_date is required");
  if (!Number.isFinite(times) || times < 1) throw new Error("times must be >= 1");

  return await callAdminApi<{ inserted: number; thai_year: number }>("/api/admin/addActivity", {
    volunteer_code: code,
    times,
    activity_date: params.activity_date,
    status: params.status,
  });
}

export async function adminVoidLatestActivity(params: {
  volunteer_code: string;
  void_reason: string;
  void_by: string;
  onlyCurrentThaiYear?: boolean;
}) {
  const code = String(params.volunteer_code ?? "").trim().toUpperCase();
  if (!code) throw new Error("volunteer_code is required");

  const nowIso = new Date().toISOString();
  const currentThaiYear = getCurrentThaiYear();

  let q = supabase.from("activity_history").select("id, activity_date, created_at, thai_year").eq("volunteer_code", code).eq("is_void", false);

  if (params.onlyCurrentThaiYear) q = q.eq("thai_year", currentThaiYear);

  const { data, error } = await q
    .order("activity_date", { ascending: false })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(1);

  if (error) throw new Error(error.message);

  const latest = (data ?? [])[0];
  if (!latest?.id) return { voided: false, message: "ไม่พบรายการกิจกรรมที่ยังไม่ void" };

  const { error: updErr } = await supabase
    .from("activity_history")
    .update({
      is_void: true,
      void_reason: params.void_reason || "Admin void",
      void_by: params.void_by || "ADMIN",
      void_at: nowIso,
    })
    .eq("id", latest.id);

  if (updErr) throw new Error(updErr.message);

  return { voided: true, activity_id: latest.id };
}

/**
 * ✅ Add activity via Server API (Service Role)
 */
export async function adminAddActivityViaApi(params: {
  volunteer_code: string;
  times: number;
  activity_date: string; // YYYY-MM-DD
  status: "VOLUNTEER" | "ADMIN";
}) {
  const volunteer_code = String(params.volunteer_code ?? "").trim().toUpperCase();
  const times = Math.max(1, Math.floor(Number(params.times ?? 1)));
  const activity_date = String(params.activity_date ?? "").trim();
  const status = String(params.status ?? "VOLUNTEER").trim().toUpperCase() as "VOLUNTEER" | "ADMIN";

  if (!volunteer_code) throw new Error("volunteer_code is required");
  if (!activity_date) throw new Error("activity_date is required (YYYY-MM-DD)");
  if (!Number.isFinite(times) || times < 1) throw new Error("times must be >= 1");
  if (!["VOLUNTEER", "ADMIN"].includes(status)) throw new Error("status must be VOLUNTEER|ADMIN");

  return await callAdminApi<{ inserted: number; thai_year: number; volunteer_code: string }>("/api/admin/addActivity", {
    volunteer_code,
    times,
    activity_date,
    status,
  });
}

/**
 * ✅ Void activity by activity_id
 */
export async function adminVoidActivityById(params: { activity_id: string; void_reason?: string; void_by?: string }) {
  const activity_id = String(params.activity_id ?? "").trim();
  const void_reason = String(params.void_reason ?? "Admin deleted").trim();
  const void_by = String(params.void_by ?? "ADMIN").trim();

  if (!activity_id) throw new Error("activity_id is required");

  return await callAdminApi<{ voided: boolean; activity_id: string }>("/api/admin/voidActivity", {
    activity_id,
    void_reason,
    void_by,
  });
}

/**
 * ✅ Update volunteer role
 */
export async function adminUpdateVolunteerRole(params: { volunteer_code: string; role: VolunteerRole }) {
  const volunteer_code = String(params.volunteer_code ?? "").trim().toUpperCase();
  const role = String(params.role ?? "").trim().toUpperCase() as VolunteerRole;

  if (!volunteer_code) throw new Error("volunteer_code is required");
  if (!["VOLUNTEER", "STAFF", "ADMIN"].includes(role)) throw new Error("role must be VOLUNTEER|STAFF|ADMIN");

  return await callAdminApi<{ volunteer_code: string; role: VolunteerRole }>("/api/admin/updateVolunteerRole", {
    volunteer_code,
    role,
  });
}

/**
 * ✅ Deduct points via Server API (Service Role)
 */
export async function adminDeductPointsViaApi(params: { volunteer_code: string; amount: number; note?: string }) {
  const volunteer_code = String(params.volunteer_code ?? "").trim().toUpperCase();
  const amount = Number(params.amount ?? 0);
  const note = String(params.note ?? "admin deduct").trim();

  if (!volunteer_code) throw new Error("volunteer_code is required");
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("amount must be > 0");

  return await callAdminApi<{
    ok: boolean;
    volunteer_code: string;
    before: number;
    after: number;
    deducted: number;
  }>("/api/admin/deductPoints", {
    volunteer_code,
    amount,
    note,
  });
}

// =====================================================
// ✅ Admin – Reward Approval (NEW) : /api/admin/redemptions
// =====================================================
export type RedemptionStatus = "PENDING" | "APPROVED" | "REJECTED";

export type AdminRedemptionRow = {
  request_id: string;
  created_at: string;
  status: RedemptionStatus | string;
  qty: number;
  points_used: number;

  reward_id: string;
  reward_title: string;
  reward_image_url?: string | null;
  reward_stock?: number | null;

  volunteer_id: string;
  volunteer_code: string;
  volunteer_name?: string | null;
  volunteer_branch?: string | null;
};

// --- token helper (Admin endpoint ต้องใช้ JWT Bearer) ---
function getStoredJwt(): string | null {
  // ✅ รองรับทั้ง user token + admin token
  const keys = [
    "admin_jwt_token_v1",
    "admin_jwt_token",
    "app_token",
    "auth_token",
    "volunteer_token",
    "jwt",
    "token",
  ];

  for (const k of keys) {
    const v = localStorage.getItem(k);
    if (v && String(v).trim()) return String(v).trim();
  }
  return null;
}

async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getStoredJwt();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers ? (init.headers as any) : {}),
  };

  // NOTE: ถ้า token ว่าง endpoint จะตอบ 401
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(path, { ...init, headers });
  const json = await res.json().catch(() => ({} as any));
  if (!res.ok) throw new Error(json?.error || `API error ${res.status}`);
  return json as T;
}

export async function adminListRedemptions(params?: { status?: RedemptionStatus; search?: string }) {
  const status = (params?.status ?? "PENDING") as RedemptionStatus;
  const search = String(params?.search ?? "").trim();

  const qs = new URLSearchParams();
  qs.set("status", status);
  if (search) qs.set("search", search);

  const json = await adminFetch<{ ok: boolean; rows: AdminRedemptionRow[] }>(`/api/admin/redemptions?${qs.toString()}`, {
    method: "GET",
  });

  return json?.rows ?? [];
}

export async function adminApproveRedemption(requestId: string) {
  const request_id = String(requestId ?? "").trim();
  if (!request_id) throw new Error("Missing request_id");

  const json = await adminFetch<{ ok: boolean; result?: any }>(`/api/admin/redemptions`, {
    method: "POST",
    body: JSON.stringify({ action: "APPROVE", request_id }),
  });

  return json;
}

export async function adminRejectRedemption(requestId: string) {
  const request_id = String(requestId ?? "").trim();
  if (!request_id) throw new Error("Missing request_id");

  const json = await adminFetch<{ ok: boolean; result?: any }>(`/api/admin/redemptions`, {
    method: "POST",
    body: JSON.stringify({ action: "REJECT", request_id }),
  });

  return json;
}
// ===============================
// Admin: Redemptions (Rewards approval)
// ===============================
export type RedemptionRow = {
  request_id: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | string;
  created_at: string;

  qty: number;
  points_used: number;

  volunteer_id?: string;
  volunteer_code?: string;
  volunteer_name?: string;
  volunteer_branch?: string;

  reward_id?: string;
  reward_title?: string;
  reward_cost?: number;
  reward_stock?: number | null;
  reward_image_url?: string;
};

function normalizeApiList(json: any): any[] {
  // รองรับหลายรูปแบบ (กันพัง)
  if (Array.isArray(json)) return json;
  if (Array.isArray(json?.data)) return json.data;
  if (Array.isArray(json?.rows)) return json.rows;
  if (Array.isArray(json?.result)) return json.result;
  return [];
}

export async function adminFetchRedemptions(params: { status?: string; search?: string }) {
  const status = String(params.status ?? "PENDING").toUpperCase();
  const search = String(params.search ?? "").trim();

  const qs = new URLSearchParams();
  qs.set("status", status);
  if (search) qs.set("search", search);

  const res = await fetch(`/api/admin/redemptions?${qs.toString()}`);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || `API error ${res.status}`);

  return normalizeApiList(json) as RedemptionRow[];
}
