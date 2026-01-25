// services/dataService.ts
import { Volunteer, Transaction, Reward, RedemptionRequest, RankConfig } from '../types';
import { supabase } from './supabaseClient';

// ===============================
// Utils (Thai Year)
// ===============================
export const getCurrentThaiYear = () => {
  const date = new Date();
  return date.getFullYear() + 543; // AD + 543
};

export const getFiscalYear = (date: Date) => {
  return date.getFullYear() + 543; // Simple Thai Year
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
    // Requests from localStorage
    const savedReqs = localStorage.getItem('requests_v16');
    if (savedReqs) this.redemptionRequests = JSON.parse(savedReqs);

    // Rewards (temporary static)
    this.rewards = [
      { id: 'r1', name: 'กระเป๋าผ้าลดโลกร้อน', cost: 50, stock: 10, imageUrl: 'https://i.postimg.cc/d1c6T7xn/1768933261970.jpg?auto=format&fit=crop&q=80&w=300' },
      { id: 'r2', name: 'แก้วน้ำเก็บความเย็น', cost: 100, stock: 10, imageUrl: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&q=80&w=300' },
      { id: 'r3', name: 'เสื้อยืดอาสา', cost: 100, stock: 10, imageUrl: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&q=80&w=300' },
      { id: 'r4', name: 'หมวกร่มลมเย็น', cost: 100, stock: 10, imageUrl: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&q=80&w=300' },
      { id: 'r5', name: 'บัตรกำนัล 100 บาท', cost: 100, stock: 10, imageUrl: 'https://i.postimg.cc/XNdJ8rDC/images-(27).jpg?auto=format&fit=crop&q=80&w=300' },
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
    localStorage.setItem('requests_v16', JSON.stringify(this.redemptionRequests));
  }

  public updateRequest(req: RedemptionRequest) {
    const idx = this.redemptionRequests.findIndex(r => r.id === req.id);
    if (idx >= 0) {
      this.redemptionRequests[idx] = req;
      localStorage.setItem('requests_v16', JSON.stringify(this.redemptionRequests));
    }
  }
}

export const dataService = new DataService();

// ===============================
// Rank logic (keep same behavior)
// ===============================
export function getRank(points: number, activityCount: number = 0): RankConfig {
  if (points > 200 || activityCount > 10) {
    return { name: 'ผู้มีพลังขับเคลื่อนสังคม', minPoints: 201, icon: '🔥', color: 'bg-orange-100 text-orange-600' };
  }
  if (points > 100 || activityCount >= 5) {
    return { name: 'นักสร้างสรรค์แบ่งปันโอกาส', minPoints: 101, icon: '🌳', color: 'bg-teal-100 text-teal-600' };
  }
  if (points > 50 || activityCount >= 3) {
    return { name: 'เพื่อนชุมชน', minPoints: 51, icon: '🌿', color: 'bg-green-100 text-green-600' };
  }
  return { name: 'ผู้เริ่มต้นแบ่งปัน', minPoints: 0, icon: '🌱', color: 'bg-lime-100 text-lime-600' };
}

// ===============================
// Supabase: Volunteers (Search on Home)
// ===============================
export async function fetchVolunteerByCode(volunteerCode: string) {
  const code = volunteerCode.trim();
  if (!code) return null;

  const { data, error } = await supabase
    .from('volunteers')
    .select('id, volunteer_code, name, branch')
    .eq('volunteer_code', code)
    .maybeSingle();

  if (error) {
    console.error('[Supabase] fetchVolunteerByCode error:', error);
    return null;
  }

  return data;
}

// helper: map supabase volunteer row → app Volunteer type
export function mapVolunteerRowToVolunteer(row: any): Volunteer {
  return {
    id: row.id,                 // uuid
    empId: row.volunteer_code,   // volunteer_code
    name: row.name ?? '',
    type: row.branch ?? '',
    // isStaff: จะเช็คจาก activity_history/status ตอนโหลด profile ได้
  } as Volunteer;
}

// ===============================
// Supabase: Activity History (Profile / Points / Activity count)
// ===============================

// ✅ ดึงประวัติ “ทั้งหมด” ของรหัสพนักงาน (ใช้โชว์ list + คำนวณครั้ง)
export async function fetchActivityHistoryByCode(volunteerCode: string, thaiYear?: number) {
  const code = volunteerCode.trim();
  if (!code) return [];

  let q = supabase
    .from('activity_history')
    .select('id, volunteer_code, name, branch, status, activity_date, thai_year')
    .eq('volunteer_code', code)
    .order('activity_date', { ascending: false });

  if (thaiYear && thaiYear > 0) {
    q = q.eq('thai_year', thaiYear);
  }

  const { data, error } = await q;

  if (error) {
    console.error('[Supabase] fetchActivityHistoryByCode error:', error);
    return [];
  }

  return data ?? [];
}

// ✅ คำนวณแต้ม/จำนวนครั้ง จาก activity_history (แทน transactions ก้อนใหญ่)
export async function getVolunteerSummaryFromHistory(volunteerCode: string, thaiYear: number) {
  const rowsThisYear = await fetchActivityHistoryByCode(volunteerCode, thaiYear);

  const activityCount = rowsThisYear.length;

  // เงื่อนไขเดิม: ปี 2557-2568 ไม่คิดคะแนน
  let points = 0;
  if (!(thaiYear >= 2557 && thaiYear <= 2568)) {
    points = activityCount * 20; // 1 ครั้ง = 20 แต้ม (ตามเดิม)
  }

  // ใช้ status จาก record ล่าสุด (ถ้ามี ADMIN ให้ถือเป็นทีมงาน)
  const isAdmin = rowsThisYear.some(r => (r.status ?? '') === 'ADMIN');

  return { points, activityCount, isAdmin, rowsThisYear };
}

// ===============================
// Supabase: Leaderboard
// ===============================
export type LeaderboardMode = 'VOLUNTEERS' | 'ADMIN';

// view ที่เราสร้างไว้
const leaderboardTable = (mode: LeaderboardMode) =>
  mode === 'ADMIN' ? 'leaderboard_admin' : 'leaderboard_volunteers';

export async function fetchLeaderboard(mode: LeaderboardMode) {
  const { data, error } = await supabase
    .from(leaderboardTable(mode))
    .select('*')
    .limit(500);

  if (error) {
    console.error('[Supabase] fetchLeaderboard error:', error);
    return [];
  }

  return data ?? [];
}

// ===============================
// (Optional) Transfer / Points Transactions (ยังไม่เปิดใช้จริง)
// ===============================
// ถ้าจะทำ “โอนแต้มจริง” เราจะไปผูกกับ table point_transactions + RLS ทีหลัง
// ===============================
// Backward-compat (for old Leaderboard.tsx)
// ===============================

// Leaderboard.tsx เก่าๆ บางเวอร์ชันเรียก getVolunteers()
// เราทำ alias ให้เพื่อกันหน้า /leaderboard พัง
export async function getVolunteers() {
  return await fetchLeaderboard('VOLUNTEERS');
}

// เผื่อ Leaderboard.tsx เรียก getAdmins() ด้วย (กันพังไว้ก่อน)
export async function getAdmins() {
  return await fetchLeaderboard('ADMIN');
}

