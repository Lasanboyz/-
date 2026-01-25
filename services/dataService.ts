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

    this.rewards = [
      {
        id: "r1",
        name: "กระเป๋าผ้าลดโลกร้อน",
        cost: 50,
        stock: 10,
        imageUrl:
          "https://i.postimg.cc/d1c6T7xn/1768933261970.jpg?auto=format&fit=crop&q=80&w=300",
      },
      {
        id: "r2",
        name: "แก้วน้ำเก็บความเย็น",
        cost: 100,
        stock: 10,
        imageUrl:
          "https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&q=80&w=300",
      },
      {
        id: "r3",
        name: "เสื้อยืดอาสา",
        cost: 100,
        stock: 10,
        imageUrl:
          "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&q=80&w=300",
      },
      {
        id: "r4",
        name: "หมวกร่มลมเย็น",
        cost: 100,
        stock: 10,
        imageUrl:
          "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&q=80&w=300",
      },
      {
        id: "r5",
        name: "บัตรกำนัล 100 บาท",
        cost: 100,
        stock: 10,
        imageUrl:
          "https://i.postimg.cc/XNdJ8rDC/images-(27).jpg?auto=format&fit=crop&q=80&w=300",
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
    .select("id, volunteer_code, name, branch")
    .eq("volunteer_code", code)
    .maybeSingle();

  if (error) {
    console.error("[Supabase] fetchVolunteerByCode error:", error);
    return null;
  }

  return data;
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
export async function fetchActivityHistoryByCode(
  volunteerCode: string,
  thaiYear?: number
) {
  const code = (volunteerCode ?? "").trim();
  if (!code) return [];

  let q = supabase
    .from("activity_history")
    .select("id, volunteer_code, name, branch, status, activity_date, thai_year, created_at")
    .eq("volunteer_code", code)
    .order("activity_date", { ascending: false });

  if (thaiYear && thaiYear > 0) q = q.eq("thai_year", thaiYear);

  const { data, error } = await q;

  if (error) {
    console.error("[Supabase] fetchActivityHistoryByCode error:", error);
    return [];
  }
  return data ?? [];
}

export async function getVolunteerSummaryFromHistory(
  volunteerCode: string,
  thaiYear: number
) {
  const rowsThisYear = await fetchActivityHistoryByCode(volunteerCode, thaiYear);
  const activityCount = rowsThisYear.length;

  let points = 0;
  if (!(thaiYear >= 2557 && thaiYear <= 2568)) points = activityCount * 20;

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
  is_staff?: boolean;
};

type ActivityRow = {
  volunteer_code: string | null;
  name: string | null;
  branch: string | null;
  status: string | null;
  activity_date: string | null; // "YYYY-MM-DD"
  thai_year: number | string | null;
};

// ---- helpers ----
const __debug = false; // ตั้ง true ชั่วคราวตอนเช็ก
const normalizeCode = (v: any) => String(v ?? "").trim().toUpperCase();
const normalizeStatus = (v: any) => String(v ?? "").trim().toUpperCase();
const isNoScoreYear = (year: number) => year >= 2557 && year <= 2568;

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

export async function fetchLeaderboardSummary(
  mode: LeaderboardMode,
  thaiYear: number // 0 = all years
): Promise<LeaderboardSummaryRow[]> {
  const PAGE_SIZE = 1000; // Supabase max rows มัก 1000
  let from = 0;

  const allRows: ActivityRow[] = [];

  while (true) {
    let q = supabase
      .from("activity_history")
      .select("volunteer_code, name, branch, status, activity_date, thai_year")
      .eq("is_void", false)
      .order("created_at", { ascending: true }) // ให้ pagination เสถียร
      .range(from, from + PAGE_SIZE - 1);

    // ✅ ถ้าเลือกปี -> filter ที่ DB ก่อน (เร็วและชัวร์)
    if (thaiYear && thaiYear !== 0) {
      q = q.eq("thai_year", thaiYear);
    }

    const { data, error } = await q;

    if (error) {
      console.error("[Supabase] fetchLeaderboardSummary error:", error);
      throw new Error(error.message);
    }

    const batch = (data ?? []) as any[];
    if (batch.length === 0) break;

    allRows.push(...(batch as ActivityRow[]));

    // ถ้าได้มาน้อยกว่า PAGE_SIZE แปลว่าหมดแล้ว
    if (batch.length < PAGE_SIZE) break;

    from += PAGE_SIZE;

    // กัน loop ยาวเกิน (ปรับได้)
    if (from > 200000) break;
  }

  console.log("[LB] fetched:", { mode, thaiYear, rows: allRows.length });

  const map = new Map<string, LeaderboardSummaryRow>();

  for (const r of allRows) {
    const code = normalizeCode(r.volunteer_code);
    if (!code) continue;

    const status = normalizeStatus(r.status);
    const rowIsAdmin = status === "ADMIN";

    // mode filter
    if (mode === "ADMIN" && !rowIsAdmin) continue;
    if (mode === "VOLUNTEERS" && rowIsAdmin) continue;

    const rowYear = deriveThaiYear(r);

    // year filter (สำรองอีกชั้น เผื่อ thai_year บางแถวเป็น null)
    if (thaiYear && thaiYear !== 0) {
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
        is_staff: mode === "ADMIN",
      } as LeaderboardSummaryRow);

    prev.activity_count += 1;

    // points rule: ปี 2557–2568 ไม่นับคะแนน
    const effectiveYear = thaiYear !== 0 ? thaiYear : rowYear;
    if (typeof effectiveYear === "number" && !isNoScoreYear(effectiveYear)) {
      prev.points += 20;
    }

    if (!prev.name && r.name) prev.name = r.name;
    if (!prev.branch && r.branch) prev.branch = r.branch;

    map.set(code, prev);
  }

  const result = Array.from(map.values());

  // ✅ เช็ค 80010301 แบบชัด ๆ
  console.log(
    "[LB] has 80010301?",
    result.some((x) => x.volunteer_code === "80010301"),
    "row=",
    result.find((x) => x.volunteer_code === "80010301")
  );

  return result;
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
  points?: number | null; // ถ้าตารางคุณใช้ชื่ออื่น เดี๋ยวค่อยเปลี่ยน
};

async function getVolunteerByCodeForPoints(codeRaw: string): Promise<VolunteerRow | null> {
  const code = String(codeRaw ?? "").trim().toUpperCase();
  if (!code) return null;

  // สำคัญ: ดึง points มาด้วย เพื่อเช็กยอดก่อนโอน
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
  const amount = Number(params.amount ?? 0);
  const note = String(params.note ?? "").trim();

  if (!fromCode || !toCode) throw new Error("กรุณากรอกรหัสผู้โอน/ผู้รับให้ครบ");
  if (fromCode === toCode) throw new Error("ห้ามโอนให้รหัสเดียวกัน");
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("จำนวนแต้มต้องมากกว่า 0");

  const [fromV, toV] = await Promise.all([
    getVolunteerByCodeForPoints(fromCode),
    getVolunteerByCodeForPoints(toCode),
  ]);

  if (!fromV) throw new Error(`ไม่พบผู้โอน: ${fromCode}`);
  if (!toV) throw new Error(`ไม่พบผู้รับ: ${toCode}`);

  const fromPoints = Number(fromV.points ?? 0);
  if (amount > fromPoints) throw new Error(`แต้มไม่พอ (คงเหลือ ${fromPoints})`);

  // Insert ธุรกรรม -> trigger จะไปอัปเดต points ให้เอง
  const { data, error } = await supabase
    .from("point_transactions")
    .insert({
      from_volunteer_id: fromV.id,
      to_volunteer_id: toV.id,
      amount,
      type: "transfer",
      note: note || `transfer ${fromCode} -> ${toCode}`,
    })
    .select("*")
    .maybeSingle();

  if (error) {
    console.error("[Supabase] transferPoints insert error:", error);
    throw new Error(error.message);
  }

  return data;
}

// ใช้ refresh หน้าจอหลังโอน: ดึง points ปัจจุบัน
export async function fetchVolunteerPointsByCode(volunteerCode: string) {
  const v = await getVolunteerByCodeForPoints(volunteerCode);
  if (!v) return null;
  return { points: Number(v.points ?? 0), id: v.id, volunteer_code: v.volunteer_code };
}

// ===============================
// Admin: Adjust Points (Give / Deduct) + Logs
// ===============================

export async function adminGivePoints(params: {
  toVolunteerCode: string;
  amount: number;
  note?: string;
}) {
  const toCode = String(params.toVolunteerCode ?? "").trim().toUpperCase();
  const amount = Number(params.amount ?? 0);
  const note = String(params.note ?? "").trim();

  if (!toCode) throw new Error("กรุณากรอกรหัสผู้รับ");
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("จำนวนแต้มต้องมากกว่า 0");

  const toV = await getVolunteerByCodeForPoints(toCode);
  if (!toV) throw new Error(`ไม่พบผู้รับ: ${toCode}`);

  // insert log (from=null => give)
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

export async function adminDeductPoints(params: {
  volunteerCode: string;
  amount: number;
  note?: string;
}) {
  const code = String(params.volunteerCode ?? "").trim().toUpperCase();
  const amount = Number(params.amount ?? 0);
  const note = String(params.note ?? "").trim();

  if (!code) throw new Error("กรุณากรอกรหัสพนักงาน");
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("จำนวนแต้มต้องมากกว่า 0");

  const v = await getVolunteerByCodeForPoints(code);
  if (!v) throw new Error(`ไม่พบพนักงาน: ${code}`);

  const current = Number(v.points ?? 0);
  if (current < amount) throw new Error(`แต้มไม่พอ (คงเหลือ ${current})`);

  // 1) หักแต้มตรง ๆ
  const { error: updErr } = await supabase
    .from("volunteers")
    .update({ points: current - amount })
    .eq("id", v.id);

  if (updErr) {
    console.error("[Supabase] adminDeductPoints update error:", updErr);
    throw new Error(updErr.message);
  }

  // 2) insert log ไว้ดูประวัติ (amount ต้องเป็นบวกตาม constraint)
  const { error: logErr } = await supabase.from("point_transactions").insert({
    from_volunteer_id: null,
    to_volunteer_id: v.id,
    amount,
    type: "deduct",
    note: note || `admin deduct -${amount} from ${code}`,
  });

  if (logErr) {
    console.error("[Supabase] adminDeductPoints log error:", logErr);
    // ไม่ throw เพื่อไม่ให้ “หักแต้มแล้วแต่โชว์ว่าล้มเหลว” (แต่คุณจะเห็น error ใน console)
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
// Admin: Add activity (manual)
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

  const date = params.activityDate
    ? new Date(params.activityDate)
    : new Date();

  const thaiYear = date.getFullYear() + 543;

  const { error } = await supabase
    .from("activity_history")
    .insert({
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
