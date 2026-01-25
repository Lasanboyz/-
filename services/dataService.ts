// services/dataService.ts
import { Volunteer, Reward, RedemptionRequest, RankConfig } from "../types";
import { supabase } from "./supabaseClient";

// ===============================
// Utils (Thai Year)
// ===============================
export const getCurrentThaiYear = () => {
  const date = new Date();
  return date.getFullYear() + 543;
};

export const getFiscalYear = (date: Date) => {
  return date.getFullYear() + 543;
};

// ===============================
// Local fallback (Rewards / Requests) - keep as is for now
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
      localStorage.setItem(
        "requests_v16",
        JSON.stringify(this.redemptionRequests)
      );
    }
  }
}

export const dataService = new DataService();

// ===============================
// Rank logic (keep same behavior)
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

// helper: map supabase volunteer row → app Volunteer type
export function mapVolunteerRowToVolunteer(row: any): Volunteer {
  return {
    id: row.id,
    empId: row.volunteer_code,
    name: row.name ?? "",
    type: row.branch ?? "",
  } as Volunteer;
}

// ===============================
// Supabase: Activity History
// ===============================
export async function fetchActivityHistoryByCode(
  volunteerCode: string,
  thaiYear?: number
) {
  const code = (volunteerCode ?? "").trim();
  if (!code) return [];

  let q = supabase
    .from("activity_history")
    .select("id, volunteer_code, name, branch, status, activity_date, thai_year")
    .eq("volunteer_code", code)
    .order("activity_date", { ascending: false });

  // ถ้าเลือกปี และตารางมี thai_year ครบ จะเร็วขึ้น
  if (thaiYear && thaiYear > 0) {
    q = q.eq("thai_year", thaiYear);
  }

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
  if (!(thaiYear >= 2557 && thaiYear <= 2568)) {
    points = activityCount * 20;
  }

  // normalize status
  const isAdmin = rowsThisYear.some(
    (r: any) => String(r.status ?? "").trim().toUpperCase() === "ADMIN"
  );

  return { points, activityCount, isAdmin, rowsThisYear };
}

// ===============================
// Leaderboard (Compute from activity_history directly) ✅ ไม่พึ่ง view
// ===============================
export type LeaderboardMode = "VOLUNTEERS" | "ADMIN";

type ActivityRow = {
  volunteer_code: string | null;
  name: string | null;
  branch: string | null;
  status: string | null;
  activity_date: string | null;
  thai_year: number | string | null;
};

type LeaderboardSummaryRow = {
  volunteer_code: string;
  name: string;
  branch: string;
  activity_count: number;
  points: number;
  thai_year?: number; // ถ้าเลือกปีเดียว
  is_staff?: boolean;
};

// --- Normalizers ---
const normalizeCode = (v: any) => String(v ?? "").trim().toUpperCase();

const normalizeStatus = (v: any) => String(v ?? "").trim().toUpperCase();

const toThaiYearFromDate = (dateLike: string) => {
  const d = new Date(dateLike);
  if (Number.isNaN(d.getTime())) return undefined;
  // กัน timezone ข้ามปีแบบแปลก ๆ
  return d.getUTCFullYear() + 543;
};

const parseThaiYear = (v: any) => {
  if (v === null || v === undefined || v === "") return undefined;
  const n = typeof v === "number" ? v : Number(String(v).trim());
  if (!Number.isFinite(n)) return undefined;
  // guard range แบบคร่าว ๆ
  if (n < 2400 || n > 2700) return undefined;
  return n;
};

const isNoScoreYear = (year: number) => year >= 2557 && year <= 2568;

// ✅ main function
export async function fetchLeaderboardSummary(
  mode: LeaderboardMode,
  thaiYear: number
): Promise<LeaderboardSummaryRow[]> {
  // thaiYear: 0 = all years
  // IMPORTANT: เราไม่ filter status ที่ query แบบ neq เพราะมันจะ "ตัด null ทิ้ง" ทำให้อาสาหาย
  // เราจะดึงมาแล้ว filter ใน JS เพื่อให้ logic มั่นใจถูกก่อน

  const { data, error } = await supabase
    .from("activity_history")
    .select("volunteer_code, name, branch, status, activity_date, thai_year")
    .limit(10000); // พอสำหรับช่วงนี้ (ทำให้ถูกก่อน)

  if (error) {
    console.error("[Supabase] fetchLeaderboardSummary error:", error);
    return [];
  }

  const rows: ActivityRow[] = (data ?? []) as any[];

  const map = new Map<string, LeaderboardSummaryRow>();

  for (const r of rows) {
    const code = normalizeCode(r.volunteer_code);
    if (!code) continue;

    const status = normalizeStatus(r.status);
    const isAdmin = status === "ADMIN";

    // filter mode
    if (mode === "ADMIN" && !isAdmin) continue;
    if (mode === "VOLUNTEERS" && isAdmin) continue;

    // derive thai year per row
    const yFromCol = parseThaiYear(r.thai_year);
    const yFromDate = r.activity_date ? toThaiYearFromDate(r.activity_date) : undefined;
    const rowYear = yFromCol ?? yFromDate;

    // filter year (กันเคส thai_year null)
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

    // points rule
    if (rowYear && !isNoScoreYear(rowYear)) {
      prev.points += 20;
    } else if (!rowYear && thaiYear !== 0 && !isNoScoreYear(thaiYear)) {
      // fallback กรณีปีเลือกมา แต่ rowYear หาไม่ได้ (แทบไม่ควรเกิด) — ให้คิดตามปีที่เลือก
      prev.points += 20;
    }

    // name/branch: ถ้าเดิมว่างแล้วแถวนี้มี ให้เติม
    if (!prev.name && r.name) prev.name = r.name;
    if (!prev.branch && r.branch) prev.branch = r.branch;

    map.set(code, prev);
  }

  // sort ให้ใช้งานง่าย (คะแนนก่อน, แล้วครั้ง)
  const result = Array.from(map.values()).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    return b.activity_count - a.activity_count;
  });

  return result;
}

// ===============================
// Backward-compat (กันหน้าเก่าพัง)
// ===============================
// NOTE: ฟังก์ชันพวกนี้เคยผูก view เดิมไว้
// ถ้าหน้าไหนยังเรียกอยู่ ให้ไปเปลี่ยนไปใช้ fetchLeaderboardSummary ทีหลัง

export async function getVolunteers() {
  return await fetchLeaderboardSummary("VOLUNTEERS", 0);
}

export async function getAdmins() {
  return await fetchLeaderboardSummary("ADMIN", 0);
}
