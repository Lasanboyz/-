// services/dataService.ts
import { Volunteer, Reward, RedemptionRequest, RankConfig } from "../types";
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
// Volunteers (Search)
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
// Activity History
// ===============================

/**
 * NOTE:
 * ใน DB ของคุณมีโอกาสมี "date_text" (DD/MM/YYYY) แทน "activity_date"
 * ดังนั้นเรา select มาทั้งสองชื่อ แล้วใช้ที่มีจริง
 */
export async function fetchActivityHistoryByCode(volunteerCode: string, thaiYear?: number) {
  const code = (volunteerCode ?? "").trim();
  if (!code) return [];

  // ดึงให้ครบทั้ง activity_date/date_text เพื่อกัน schema ไม่ตรง
  const { data, error } = await supabase
    .from("activity_history")
    .select(
      "id, volunteer_code, name, branch, status, thai_year, activity_date, date_text"
    )
    .eq("volunteer_code", code)
    // ถ้า activity_date ไม่มีจริง order จะ fail -> เลยไม่ order ใน query
    .limit(5000);

  if (error) {
    console.error("[Supabase] fetchActivityHistoryByCode error:", error);
    return [];
  }

  let rows = (data ?? []) as any[];

  // filter year ใน JS (กัน thai_year null / ชื่อคอลัมน์ไม่ตรง)
  if (thaiYear && thaiYear > 0) {
    rows = rows.filter((r) => {
      const y = deriveRowThaiYear(r);
      return y === thaiYear;
    });
  }

  // sort ล่าสุดก่อน (ใช้ activity_date ถ้ามี ไม่งั้นใช้ date_text)
  rows.sort((a, b) => {
    const da = toSortableDate(a);
    const db = toSortableDate(b);
    return db - da;
  });

  return rows;
}

export async function getVolunteerSummaryFromHistory(volunteerCode: string, thaiYear: number) {
  const rowsThisYear = await fetchActivityHistoryByCode(volunteerCode, thaiYear);
  const activityCount = rowsThisYear.length;

  let points = 0;
  if (!(thaiYear >= 2557 && thaiYear <= 2568)) {
    points = activityCount * 20;
  }

  const isAdmin = rowsThisYear.some((r: any) => normalizeStatus(r.status) === "ADMIN");

  return { points, activityCount, isAdmin, rowsThisYear };
}

// ===============================
// Leaderboard Summary (Compute from activity_history)
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

// --- helpers / normalizers ---
const normalizeCode = (v: any) => String(v ?? "").trim().toUpperCase();
const normalizeStatus = (v: any) => String(v ?? "").trim().toUpperCase();

const isNoScoreYear = (year: number) => year >= 2557 && year <= 2568;

// parse thai_year ที่เป็น number/string
const parseThaiYear = (v: any) => {
  if (v === null || v === undefined || v === "") return undefined;
  const n = typeof v === "number" ? v : Number(String(v).trim());
  if (!Number.isFinite(n)) return undefined;
  if (n < 2400 || n > 2700) return undefined;
  return n;
};

// parse date_text = DD/MM/YYYY => Thai year
const thaiYearFromDateText = (dateText: any) => {
  const s = String(dateText ?? "").trim();
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return undefined;
  const yyyy = Number(m[3]);
  if (!Number.isFinite(yyyy)) return undefined;
  return yyyy + 543;
};

// parse activity_date (ISO/Date) => Thai year
const thaiYearFromActivityDate = (activityDate: any) => {
  if (!activityDate) return undefined;
  const d = new Date(activityDate);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.getUTCFullYear() + 543;
};

// derive row Thai year (priority: thai_year -> activity_date -> date_text)
const deriveRowThaiYear = (r: any) => {
  return (
    parseThaiYear(r.thai_year) ??
    thaiYearFromActivityDate(r.activity_date) ??
    thaiYearFromDateText(r.date_text)
  );
};

// สำหรับ sort
const toSortableDate = (r: any) => {
  if (r.activity_date) {
    const d = new Date(r.activity_date);
    if (!Number.isNaN(d.getTime())) return d.getTime();
  }
  // date_text DD/MM/YYYY
  const s = String(r.date_text ?? "").trim();
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return 0;
  const dd = Number(m[1]);
  const mm = Number(m[2]);
  const yyyy = Number(m[3]);
  const d = new Date(Date.UTC(yyyy, mm - 1, dd));
  if (Number.isNaN(d.getTime())) return 0;
  return d.getTime();
};

// ✅ main function
export async function fetchLeaderboardSummary(
  mode: LeaderboardMode,
  thaiYear: number
): Promise<LeaderboardSummaryRow[]> {
  // ดึงทั้ง activity_date/date_text เพื่อกัน schema ไม่ตรง
  const { data, error } = await supabase
    .from("activity_history")
    .select("volunteer_code, name, branch, status, thai_year, activity_date, date_text")
    .limit(20000);

  if (error) {
    console.error("[Supabase] fetchLeaderboardSummary error:", error);
    // สำคัญ: ให้หน้า Leaderboard เห็น error จริง
    throw new Error(error.message);
  }

  const rows = (data ?? []) as any[];
  console.log("[fetchLeaderboardSummary] raw rows:", rows.length, { mode, thaiYear });

  const map = new Map<string, LeaderboardSummaryRow>();

  for (const r of rows) {
    const code = normalizeCode(r.volunteer_code);
    if (!code) continue;

    const status = normalizeStatus(r.status);
    const rowIsAdmin = status === "ADMIN";

    // filter mode
    if (mode === "ADMIN" && !rowIsAdmin) continue;
    if (mode === "VOLUNTEERS" && rowIsAdmin) continue;

    const rowYear = deriveRowThaiYear(r);

    // filter year
    if (thaiYear && thaiYear !== 0) {
      if (!rowYear || rowYear !== thaiYear) continue;
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

    // คะแนน: ปี 2557–2568 = 0
    const y = rowYear ?? (thaiYear !== 0 ? thaiYear : undefined);
    if (typeof y === "number" && !isNoScoreYear(y)) {
      prev.points += 20;
    }

    if (!prev.name && r.name) prev.name = r.name;
    if (!prev.branch && r.branch) prev.branch = r.branch;

    map.set(code, prev);
  }

  // sort: คะแนนก่อน แล้วค่อยจำนวนครั้ง
  return Array.from(map.values()).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    return b.activity_count - a.activity_count;
  });
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
