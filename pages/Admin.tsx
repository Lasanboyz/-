// pages/Admin.tsx
import React, { useMemo, useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Search,
  PlusCircle,
  MinusCircle,
  History,
  RefreshCcw,
  UserPlus,
  Trash2,
  Shield,
  Gift,
  CheckCircle2,
  XCircle,
  Filter,
  KeyRound,
} from "lucide-react";

import type { Volunteer } from "../types";

import {
  fetchVolunteerByCode,
  mapVolunteerRowToVolunteer,
  fetchVolunteerPointsByCode,
  adminGivePoints,
  adminDeductPoints,
  adminFetchPointHistory,
  createVolunteer,
  // ✅ activity
  fetchActivityHistoryByCode,
  adminAddActivityViaApi,
  adminVoidActivityById,
  adminUpdateVolunteerRole,
  type VolunteerRole,
} from "../services/dataService";

type TxRow = any;

// ===============================
// ✅ Redemptions types (from /api/admin/redemptions)
// ===============================
type RedemptionStatus = "PENDING" | "APPROVED" | "REJECTED";

type AdminRedemptionRow = {
  request_id: string;
  status: RedemptionStatus;
  created_at: string;

  phone_number?: string | null; // ✅ เพิ่ม
  
  qty: number;
  points_used: number;

  volunteer_id: string;
  volunteer_code: string;
  volunteer_name: string;
  volunteer_branch: string;

  reward_id: string;
  reward_title: string;
  reward_cost: number; // ใน schema คุณเป็น 0 ไว้ก็ได้
  reward_stock: number | null;
  reward_image_url: string;
};

// ===============================
// ✅ JWT helper (ไม่ต้องไปแก้ใน F12 อีก)
// - พยายาม "เดา/ดึง" token จาก localStorage หลาย key
// - ถ้าเดาไม่เจอ: ให้ paste token แล้วกดบันทึก
// ===============================
const ADMIN_JWT_STORAGE_KEY = "admin_jwt_token_v1";

function pickFirstNonEmpty(...vals: Array<string | null | undefined>) {
  for (const v of vals) {
    const s = String(v ?? "").trim();
    if (s) return s;
  }
  return "";
}

function tryDetectJwtFromLocalStorage(): { token: string; source: string } {
  try {
    // 1) ของเราที่เซฟไว้เอง
    const direct = localStorage.getItem(ADMIN_JWT_STORAGE_KEY);
    if (direct) return { token: direct, source: ADMIN_JWT_STORAGE_KEY };

    // 2) คีย์ที่พบบ่อยๆที่คุณเคยบอกไว้/หน้าจอ hint
    const commonKeys = [
      "jwt",
      "jwt_token",
      "token",
      "auth_token",
      "app_token",
      "volunteer_token",
      "access_token",
    ];
    for (const k of commonKeys) {
      const v = localStorage.getItem(k);
      if (v && v.split(".").length === 3) return { token: v, source: k };
    }

    // 3) Supabase (บางโปรเจกต์ใช้ key รูปแบบ sb-xxxx-auth-token)
    // เราจะไล่ดูทุก key ที่มีคำว่า "auth" และ "token"
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i) || "";
      const val = localStorage.getItem(key) || "";

      // ถ้าเป็น JWT ตรงๆ
      if (val && val.split(".").length === 3) {
        if (/auth|token|jwt|supabase|sb-/i.test(key)) return { token: val, source: key };
      }

      // ถ้าเป็น JSON ที่ข้างในมี access_token
      if (/auth|token|supabase|sb-/i.test(key)) {
        try {
          const obj = JSON.parse(val);
          const access = obj?.access_token || obj?.currentSession?.access_token || obj?.session?.access_token;
          if (access && String(access).split(".").length === 3) return { token: String(access), source: `${key} (json.access_token)` };
        } catch {
          // ignore
        }
      }
    }

    return { token: "", source: "" };
  } catch {
    return { token: "", source: "" };
  }
}

async function apiListRedemptions(params: { status: RedemptionStatus; search?: string; jwt: string }) {
  const qs = new URLSearchParams();
  qs.set("status", params.status);
  if (params.search) qs.set("search", params.search);

  const res = await fetch(`/api/admin/redemptions?${qs.toString()}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${params.jwt}`,
    },
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.ok === false) {
    const msg = json?.error || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return (json?.rows ?? []) as AdminRedemptionRow[];
}

async function apiActRedemption(params: { action: "approve" | "reject"; request_id: string; note?: string; jwt: string }) {
  const res = await fetch(`/api/admin/redemptions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.jwt}`,
    },
    body: JSON.stringify({
      action: params.action,
      request_id: params.request_id,
      note: params.note || "",
    }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.ok === false) {
    const msg = json?.error || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return json?.result;
}

export const Admin: React.FC = () => {
  const navigate = useNavigate();

  // ===== Auth (simple passcode) =====
  const [passcode, setPasscode] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const ADMIN_PASS = import.meta.env.VITE_ADMIN_PASSCODE || "NTL-Volunteer-2569";

  // ===== Search =====
  const [searchCode, setSearchCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // ===== Selected volunteer =====
  const [v, setV] = useState<Volunteer | null>(null);
  const [points, setPoints] = useState<number>(0);

  // ✅ role (from volunteers.role)
  const [role, setRole] = useState<VolunteerRole>("VOLUNTEER");

  // ✅ activity
  const [activityRows, setActivityRows] = useState<any[]>([]);
  const [activityCount, setActivityCount] = useState<number>(0);
  const [loadingActivity, setLoadingActivity] = useState(false);

  // ===== Adjust points =====
  const [amount, setAmount] = useState<string>("");
  const [note, setNote] = useState<string>("");

  // ✅ “นับเป็นกิจกรรมอาสา” แบบเลือกได้
  const [countAsActivity, setCountAsActivity] = useState<boolean>(false);
  const [activityDate, setActivityDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [activityTimes, setActivityTimes] = useState<number>(1);

  // ===== History =====
  const [history, setHistory] = useState<TxRow[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // ===== Create volunteer (when not found) =====
  const [showCreate, setShowCreate] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [newBranch, setNewBranch] = useState<"HO" | "BRANCH">("BRANCH");

  // ===== Tabs =====
  const [activeTab, setActiveTab] = useState<"VOLUNTEER" | "REDEEM">("VOLUNTEER");

  // ===== Redemptions =====
  const [redeemStatus, setRedeemStatus] = useState<RedemptionStatus>("PENDING");
  const [redeemSearch, setRedeemSearch] = useState<string>("");
  const [redeemRows, setRedeemRows] = useState<AdminRedemptionRow[]>([]);
  const [loadingRedeem, setLoadingRedeem] = useState(false);
  const [actingRequestId, setActingRequestId] = useState<string>("");

  // ✅ JWT UI (ไม่ต้องไปแก้ F12)
  const [jwt, setJwt] = useState<string>("");
  const [jwtSource, setJwtSource] = useState<string>("");

  useEffect(() => {
    const d = tryDetectJwtFromLocalStorage();
    setJwt(d.token);
    setJwtSource(d.source);
  }, []);

  const canSubmit = useMemo(() => {
    const n = Number(amount);
    return v && Number.isFinite(n) && n > 0;
  }, [v, amount]);

  const doUnlock = () => {
    setMsg(null);
    if (passcode.trim() === ADMIN_PASS) setUnlocked(true);
    else setMsg("Passcode ไม่ถูกต้อง");
  };

  const resetUI = () => {
    setV(null);
    setPoints(0);
    setHistory([]);
    setRole("VOLUNTEER");

    setActivityRows([]);
    setActivityCount(0);

    setAmount("");
    setNote("");

    setCountAsActivity(false);
    setActivityDate(new Date().toISOString().slice(0, 10));
    setActivityTimes(1);

    setShowCreate(false);
    setNewCode("");
    setNewName("");
    setNewBranch("BRANCH");
  };

  const refreshPointsAndHistory = async (volunteerId: string, volunteerCode: string) => {
    const p = await fetchVolunteerPointsByCode(volunteerCode);
    setPoints(Number(p?.points ?? 0));

    setLoadingHistory(true);
    try {
      const rows = await adminFetchPointHistory(volunteerId);
      setHistory(rows);
    } finally {
      setLoadingHistory(false);
    }
  };

  const refreshActivity = async (volunteerCode: string) => {
    setLoadingActivity(true);
    try {
      const rows = await fetchActivityHistoryByCode(volunteerCode);
      setActivityRows(rows ?? []);
      setActivityCount((rows ?? []).length);
    } finally {
      setLoadingActivity(false);
    }
  };

  const persistJwt = (token: string) => {
    const t = String(token || "").trim();
    if (!t) {
      setMsg("กรุณาวาง JWT token ก่อน");
      return;
    }
    localStorage.setItem(ADMIN_JWT_STORAGE_KEY, t);
    setJwt(t);
    setJwtSource(ADMIN_JWT_STORAGE_KEY);
    setMsg("บันทึก JWT token แล้ว ✅ (ไม่ต้องเปิด F12 อีก)");
  };

  const autoDetectJwt = () => {
    const d = tryDetectJwtFromLocalStorage();
    setJwt(d.token);
    setJwtSource(d.source);
    if (!d.token) setMsg("ยังเดา JWT ไม่เจอ — ให้ paste token แล้วกดบันทึก");
    else setMsg(`เจอ JWT แล้ว ✅ (มาจาก: ${d.source})`);
  };

  const refreshRedemptions = async () => {
    setLoadingRedeem(true);
    setMsg(null);

    const token = String(jwt || "").trim();
    if (!token) {
      setLoadingRedeem(false);
      setRedeemRows([]);
      setMsg("ยังไม่มี JWT token — วาง token แล้วกด “บันทึก” ก่อน");
      return;
    }

    try {
      const rows = await apiListRedemptions({
        status: redeemStatus,
        search: redeemSearch.trim(),
        jwt: token,
      });
      setRedeemRows(rows ?? []);
    } catch (e: any) {
      console.error("[Admin] redemptions error:", e);
      setRedeemRows([]);
      setMsg(e?.message ?? "โหลดรายการแลกรางวัลไม่สำเร็จ");
    } finally {
      setLoadingRedeem(false);
    }
  };

  const handleSearch = async () => {
    const code = searchCode.trim().toUpperCase();
    if (!code) {
      setMsg("กรุณากรอกรหัสก่อนค้นหา");
      return;
    }

    setLoading(true);
    setMsg(null);
    resetUI();

    try {
      const row = await fetchVolunteerByCode(code);

      if (!row) {
        setMsg(`ไม่พบรหัส "${code}" ในตาราง volunteers — สามารถเพิ่มอาสาใหม่ได้ด้านล่าง`);
        setShowCreate(true);
        setNewCode(code);
        return;
      }

      const mapped = mapVolunteerRowToVolunteer(row);
      setV(mapped);

      const r = String((row as any).role ?? "VOLUNTEER").toUpperCase();
      setRole((["VOLUNTEER", "STAFF", "ADMIN"].includes(r) ? r : "VOLUNTEER") as VolunteerRole);

      await Promise.all([refreshPointsAndHistory((row as any).id, code), refreshActivity(code)]);
      setMsg(null);
    } catch (e: any) {
      console.error("[Admin] search error:", e);
      setMsg(e?.message ?? "ค้นหาไม่สำเร็จ (เช็ก Console เพิ่มเติม)");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateVolunteer = async () => {
    const code = newCode.trim().toUpperCase();
    const name = newName.trim();
    const branch = newBranch === "HO" ? "HO" : "BRANCH";

    if (!code) return setMsg("กรุณากรอกรหัสอาสา");
    if (!name) return setMsg("กรุณากรอกชื่อ-นามสกุล");

    setLoading(true);
    setMsg(null);

    try {
      await createVolunteer({ volunteerCode: code, name, branch, isStaff: false });

      const row = await fetchVolunteerByCode(code);
      if (!row) throw new Error("สร้างแล้วแต่ค้นหาไม่เจอ (เช็ก RLS/insert result)");

      const mapped = mapVolunteerRowToVolunteer(row);
      setV(mapped);
      setShowCreate(false);

      const r = String((row as any).role ?? "VOLUNTEER").toUpperCase();
      setRole((["VOLUNTEER", "STAFF", "ADMIN"].includes(r) ? r : "VOLUNTEER") as VolunteerRole);

      await Promise.all([refreshPointsAndHistory((row as any).id, code), refreshActivity(code)]);

      setMsg("เพิ่มอาสาใหม่สำเร็จ ✅");
      setNewName("");
      setNewBranch("BRANCH");
    } catch (e: any) {
      console.error("[Admin] createVolunteer error:", e);
      setMsg(e?.message ?? "เพิ่มอาสาใหม่ไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  const doMaybeAddActivity = async () => {
    if (!v) return;
    if (!countAsActivity) return;

    const status = role === "ADMIN" ? "ADMIN" : "VOLUNTEER";

    await adminAddActivityViaApi({
      volunteer_code: v.empId,
      times: Math.max(1, Math.floor(Number(activityTimes || 1))),
      activity_date: activityDate,
      status,
    });

    await refreshActivity(v.empId);
  };

  const handleGive = async () => {
    if (!v) return;
    const n = Number(amount);
    if (!confirm(`ยืนยัน “เพิ่ม” ${n} แต้ม ให้ ${v.empId}?`)) return;

    setLoading(true);
    setMsg(null);
    try {
      await adminGivePoints({
        toVolunteerCode: v.empId,
        amount: n,
        note: note || `admin give`,
      });

      await doMaybeAddActivity();

      setAmount("");
      setNote("");

      await refreshPointsAndHistory(v.id, v.empId);
      setMsg("เพิ่มแต้มสำเร็จ ✅");
    } catch (e: any) {
      console.error(e);
      setMsg(e?.message ?? "เพิ่มแต้มไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  const handleDeduct = async () => {
    if (!v) return;
    const n = Number(amount);
    if (!confirm(`ยืนยัน “หัก” ${n} แต้ม จาก ${v.empId}?`)) return;

    setLoading(true);
    setMsg(null);
    try {
      await adminDeductPoints({
        volunteerCode: v.empId,
        amount: n,
        note: note || `admin deduct`,
      });

      await doMaybeAddActivity();

      setAmount("");
      setNote("");

      await refreshPointsAndHistory(v.id, v.empId);
      setMsg("หักแต้มสำเร็จ ✅");
    } catch (e: any) {
      console.error(e);
      setMsg(e?.message ?? "หักแต้มไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  const handleChangeRole = async (next: VolunteerRole) => {
    if (!v) return;
    if (!confirm(`ยืนยันเปลี่ยนบทบาท ${v.empId} เป็น ${next}?`)) return;

    setLoading(true);
    setMsg(null);
    try {
      await adminUpdateVolunteerRole({ volunteer_code: v.empId, role: next });
      setRole(next);
      setMsg("อัปเดตบทบาทสำเร็จ ✅");
    } catch (e: any) {
      console.error(e);
      setMsg(e?.message ?? "อัปเดตบทบาทไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  const handleVoidActivity = async (activityId: string) => {
    if (!v) return;

    const id = String(activityId ?? "").trim();
    if (!id) {
      setMsg("ไม่พบ activity_id ของรายการนี้");
      return;
    }

    if (!confirm("ยืนยันลบกิจกรรมนี้? (จะหายจาก Leaderboard/โปรไฟล์ทันที)")) return;

    setLoading(true);
    setMsg(null);
    try {
      await adminVoidActivityById({
        activity_id: id,
        void_reason: "Admin deleted",
        void_by: "ADMIN",
      });

      await refreshActivity(v.empId);
      setMsg("ลบกิจกรรมสำเร็จ ✅");
    } catch (e: any) {
      console.error(e);
      setMsg(e?.message ?? "ลบกิจกรรมไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (request_id: string) => {
    const id = String(request_id ?? "").trim();
    const token = String(jwt || "").trim();
    if (!id) return;
    if (!token) return setMsg("ยังไม่มี JWT token — วาง token แล้วกดบันทึกก่อน");

    if (!confirm("ยืนยันอนุมัติคำขอแลกรางวัลนี้? (จะตัดแต้ม/ตัดสต็อกตามระบบ API)")) return;

    setActingRequestId(id);
    setMsg(null);
    try {
      await apiActRedemption({ action: "approve", request_id: id, jwt: token });
      setMsg("อนุมัติสำเร็จ ✅");
      await refreshRedemptions();
    } catch (e: any) {
      console.error(e);
      setMsg(e?.message ?? "อนุมัติไม่สำเร็จ");
    } finally {
      setActingRequestId("");
    }
  };

  const handleReject = async (request_id: string) => {
    const id = String(request_id ?? "").trim();
    const token = String(jwt || "").trim();
    if (!id) return;
    if (!token) return setMsg("ยังไม่มี JWT token — วาง token แล้วกดบันทึกก่อน");

    if (!confirm("ยืนยันปฏิเสธคำขอแลกรางวัลนี้?")) return;

    setActingRequestId(id);
    setMsg(null);
    try {
      await apiActRedemption({ action: "reject", request_id: id, jwt: token });
      setMsg("ปฏิเสธสำเร็จ ✅");
      await refreshRedemptions();
    } catch (e: any) {
      console.error(e);
      setMsg(e?.message ?? "ปฏิเสธไม่สำเร็จ");
    } finally {
      setActingRequestId("");
    }
  };

  // ===== Locked screen =====
  if (!unlocked) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-6">
        <div className="bg-white w-full max-w-md rounded-2xl shadow-sm border border-gray-100 p-6">
          <h1 className="text-xl font-bold text-gray-800 mb-4">Admin Access</h1>

          {msg && <div className="mb-3 text-sm text-red-600">{msg}</div>}

          <label className="text-sm text-gray-600">Passcode</label>
          <input
            type="password"
            className="w-full mt-2 border rounded-xl p-3 outline-none focus:ring-2 focus:ring-primary"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            placeholder="ใส่รหัสเพื่อเข้าใช้งาน"
          />

          <button
            onClick={doUnlock}
            className="w-full mt-4 bg-gray-900 text-white rounded-xl py-3 font-bold hover:bg-black transition"
          >
            เข้าสู่ระบบ
          </button>

          <div className="mt-4 text-xs text-gray-400">
            * รหัสตั้งจาก VITE_ADMIN_PASSCODE (ถ้าไม่ตั้งจะใช้ NTL-Volunteer-2569)
          </div>
        </div>
      </div>
    );
  }

  // ===== Main UI =====
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate("/")} className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-800">
          <ArrowLeft size={18} /> กลับหน้าแรก
        </button>
        <div className="text-gray-300">|</div>
        <div className="font-bold text-gray-800">Admin Panel</div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-2xl p-2 shadow-sm border border-gray-100 inline-flex gap-2">
        <button
          onClick={() => setActiveTab("VOLUNTEER")}
          className={`px-4 py-2 rounded-xl text-sm font-bold transition ${
            activeTab === "VOLUNTEER" ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-50"
          }`}
        >
          จัดการอาสา
        </button>
        <button
          onClick={() => {
            setActiveTab("REDEEM");
            if (redeemRows.length === 0) refreshRedemptions();
          }}
          className={`px-4 py-2 rounded-xl text-sm font-bold transition inline-flex items-center gap-2 ${
            activeTab === "REDEEM" ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-50"
          }`}
        >
          <Gift size={16} /> อนุมัติการแลกของ
        </button>
      </div>

      {msg && (
        <div className="text-sm text-gray-700 bg-gray-50 border border-gray-100 rounded-xl p-3">
          {msg}
        </div>
      )}

      {/* ============================
          TAB: REDEMPTIONS
      ============================ */}
      {activeTab === "REDEEM" && (
        <div className="space-y-4">
          {/* ✅ JWT panel */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 font-bold text-gray-800">
              <KeyRound size={18} /> JWT สำหรับเรียก API (ไม่ต้องเปิด F12)
            </div>

            <div className="text-xs text-gray-500 mt-1">
              * ระบบอนุมัติ/ปฏิเสธต้องส่ง <span className="font-mono">Authorization: Bearer &lt;JWT&gt;</span>
            </div>

            <div className="mt-3 grid md:grid-cols-[1fr_auto_auto] gap-2 items-end">
              <div>
                <label className="text-sm text-gray-600">JWT token</label>
                <input
                  value={jwt}
                  onChange={(e) => setJwt(e.target.value)}
                  className="w-full mt-2 border rounded-xl p-3 outline-none focus:ring-2 focus:ring-primary font-mono text-xs"
                  placeholder="วาง JWT ที่นี่ (xxx.yyy.zzz)"
                />
                <div className="mt-2 text-xs text-gray-400">
                  สถานะ:{" "}
                  {jwt ? (
                    <span className="text-green-700 font-bold">มี token</span>
                  ) : (
                    <span className="text-red-600 font-bold">ยังไม่มี token</span>
                  )}
                  {jwtSource ? <span className="ml-2">• source: {jwtSource}</span> : null}
                </div>
              </div>

              <button
                onClick={() => persistJwt(jwt)}
                className="h-[46px] px-4 rounded-xl bg-gray-900 text-white font-bold hover:bg-black"
              >
                บันทึก
              </button>

              <button
                onClick={autoDetectJwt}
                className="h-[46px] px-4 rounded-xl bg-gray-100 text-gray-800 font-bold hover:bg-gray-200"
              >
                ดึงอัตโนมัติ
              </button>
            </div>

            <div className="mt-3 text-xs text-gray-400">
              * ถ้ายังไม่แน่ใจว่า JWT คืออันไหน: เปิดหน้า <span className="font-mono">/api/admin/redemptions?status=PENDING</span>{" "}
              แล้วดูว่ามันขึ้น 401 หรือไม่
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex flex-col md:flex-row md:items-end gap-3">
              <div className="flex-1">
                <div className="font-bold text-gray-800 flex items-center gap-2">
                  <Gift size={18} /> รายการแลกรางวัล
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  * ถ้าไม่ขึ้น ให้เช็ก JWT ด้านบนก่อน แล้วค่อยกด Refresh
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="text-xs text-gray-500 inline-flex items-center gap-1">
                  <Filter size={14} /> สถานะ
                </div>
                <select
                  value={redeemStatus}
                  onChange={(e) => setRedeemStatus(e.target.value as RedemptionStatus)}
                  className="border rounded-xl px-3 py-2 text-sm outline-none"
                >
                  <option value="PENDING">PENDING</option>
                  <option value="APPROVED">APPROVED</option>
                  <option value="REJECTED">REJECTED</option>
                </select>

                <button
                  onClick={refreshRedemptions}
                  disabled={loadingRedeem}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white font-bold hover:opacity-90 disabled:opacity-50"
                >
                  <RefreshCcw size={16} />
                  {loadingRedeem ? "กำลังโหลด..." : "Refresh"}
                </button>
              </div>
            </div>

            <div className="mt-4 flex flex-col md:flex-row gap-3">
              <div className="flex-1">
                <label className="text-sm text-gray-600">ค้นหา (รหัส/ชื่อ/รางวัล)</label>
                <div className="relative mt-2">
                  <input
                    value={redeemSearch}
                    onChange={(e) => setRedeemSearch(e.target.value)}
                    onKeyDown={(e) => (e.key === "Enter" ? refreshRedemptions() : null)}
                    className="w-full border rounded-xl p-3 pl-10 outline-none focus:ring-2 focus:ring-primary"
                    placeholder="เช่น 80010301 หรือ ชื่อ-นามสกุล หรือ กระเป๋า"
                  />
                  <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                </div>
              </div>

              <button
                onClick={refreshRedemptions}
                disabled={loadingRedeem}
                className="md:mt-7 px-4 py-3 rounded-xl bg-gray-900 text-white font-bold hover:bg-black disabled:opacity-50"
              >
                ค้นหา
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            {loadingRedeem ? (
              <div className="text-sm text-gray-400">Loading redemptions...</div>
            ) : redeemRows.length === 0 ? (
              <div className="text-sm text-gray-400">ไม่พบรายการ</div>
            ) : (
              <div className="space-y-2">
                {redeemRows.map((r) => {
                  const busy = actingRequestId === r.request_id;
                  const status = String(r.status ?? "").toUpperCase() as RedemptionStatus;

                  return (
                    <div key={r.request_id} className="border rounded-2xl p-4">
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <div className="flex items-start gap-3">
                          {r.reward_image_url ? (
                            <img
                              src={r.reward_image_url}
                              alt={r.reward_title}
                              className="w-14 h-14 rounded-xl object-cover border"
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-14 h-14 rounded-xl bg-gray-100 border" />
                          )}

                          <div>
                            <div className="text-sm font-bold text-gray-800">
                              {r.reward_title} <span className="text-xs text-gray-500 font-normal">x{r.qty}</span>
                            </div>

                            <div className="text-xs text-gray-500 mt-1">
                              ผู้ขอ:{" "}
                              <span className="font-bold text-gray-800">
                                {r.volunteer_code} {r.volunteer_name ? `• ${r.volunteer_name}` : ""}
                              </span>
                              {r.volunteer_branch ? <span className="ml-2">({r.volunteer_branch})</span> : null}
                            </div>
                            {r.phone_number ? (
  <div className="text-xs text-gray-500 mt-1">
    เบอร์โทร: <span className="font-bold text-gray-800">{r.phone_number}</span>
  </div>
) : null}


                            <div className="text-xs text-gray-500 mt-1">
                              ใช้แต้ม: <span className="font-bold text-gray-800">{r.points_used}</span>{" "}
                              {typeof r.reward_stock === "number" ? (
                                <span className="ml-2">
                                  คงเหลือสต็อก: <span className="font-bold text-gray-800">{r.reward_stock}</span>
                                </span>
                              ) : null}
                            </div>

                            <div className="text-xs text-gray-400 mt-1">
                              request_id: <span className="font-mono">{r.request_id}</span> •{" "}
                              {r.created_at ? new Date(r.created_at).toLocaleString("th-TH") : "-"}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <div
                            className={`text-xs font-bold px-3 py-2 rounded-xl border ${
                              status === "PENDING"
                                ? "bg-yellow-50 text-yellow-700 border-yellow-100"
                                : status === "APPROVED"
                                ? "bg-green-50 text-green-700 border-green-100"
                                : "bg-red-50 text-red-700 border-red-100"
                            }`}
                          >
                            {status}
                          </div>

                          {status === "PENDING" && (
                            <>
                              <button
                                onClick={() => handleApprove(r.request_id)}
                                disabled={busy}
                                className="inline-flex items-center gap-2 bg-green-600 text-white font-bold rounded-xl px-4 py-2 hover:bg-green-700 disabled:opacity-50"
                              >
                                <CheckCircle2 size={16} /> {busy ? "กำลังทำ..." : "Approve"}
                              </button>

                              <button
                                onClick={() => handleReject(r.request_id)}
                                disabled={busy}
                                className="inline-flex items-center gap-2 bg-red-600 text-white font-bold rounded-xl px-4 py-2 hover:bg-red-700 disabled:opacity-50"
                              >
                                <XCircle size={16} /> {busy ? "กำลังทำ..." : "Reject"}
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="mt-3 text-xs text-gray-400">
              * เรียก <span className="font-mono">/api/admin/redemptions</span> (ต้องมี Bearer token)
            </div>
          </div>
        </div>
      )}

      {/* ============================
          TAB: VOLUNTEER
      ============================ */}
      {activeTab === "VOLUNTEER" && (
        <>
          {/* Search */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <label className="text-sm text-gray-600">ค้นหารหัสพนักงาน / รหัสอาสา</label>
                <div className="relative mt-2">
                  <input
                    value={searchCode}
                    onChange={(e) => setSearchCode(e.target.value)}
                    onKeyDown={(e) => (e.key === "Enter" ? handleSearch() : null)}
                    className="w-full border rounded-xl p-3 pl-10 outline-none focus:ring-2 focus:ring-primary"
                    placeholder="เช่น 80010301 หรือ CF000001"
                  />
                  <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                </div>
              </div>

              <button
                onClick={handleSearch}
                disabled={loading}
                className="mt-7 px-4 py-3 rounded-xl bg-primary text-white font-bold hover:opacity-90 disabled:opacity-50"
              >
                {loading ? "กำลังค้นหา..." : "ค้นหา"}
              </button>
            </div>
          </div>

          {/* Create volunteer (when not found) */}
          {showCreate && (
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 font-bold text-gray-800 mb-3">
                <UserPlus size={18} /> เพิ่มอาสาใหม่ (กรณีไม่พบในระบบ)
              </div>

              <div className="grid md:grid-cols-3 gap-3">
                <div>
                  <label className="text-sm text-gray-600">รหัสอาสา</label>
                  <input
                    className="w-full mt-2 border rounded-xl p-3 outline-none focus:ring-2 focus:ring-primary font-mono"
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value)}
                    placeholder="เช่น V000001 หรือ EXT-123"
                  />
                </div>

                <div>
                  <label className="text-sm text-gray-600">ชื่อ-นามสกุล</label>
                  <input
                    className="w-full mt-2 border rounded-xl p-3 outline-none focus:ring-2 focus:ring-primary"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="กรอกชื่อจริง"
                  />
                </div>

                <div>
                  <label className="text-sm text-gray-600">สังกัด</label>
                  <select
                    className="w-full mt-2 border rounded-xl p-3 outline-none focus:ring-2 focus:ring-primary"
                    value={newBranch}
                    onChange={(e) => setNewBranch(e.target.value as any)}
                  >
                    <option value="BRANCH">BRANCH</option>
                    <option value="HO">HO</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-3 mt-4">
                <button
                  onClick={handleCreateVolunteer}
                  disabled={loading}
                  className="inline-flex items-center gap-2 bg-blue-600 text-white font-bold rounded-xl py-3 px-4 hover:bg-blue-700 disabled:opacity-50"
                >
                  <UserPlus size={18} /> สร้างอาสาใหม่
                </button>

                <button onClick={() => setShowCreate(false)} className="text-gray-500 hover:text-gray-800">
                  ยกเลิก
                </button>
              </div>

              <div className="mt-3 text-xs text-gray-400">
                * ระบบจะสร้างแต้มเริ่มต้น = 0 และสามารถเพิ่ม/หัก/โอนแต้มได้ทันที
              </div>
            </div>
          )}

          {/* Selected */}
          {v && (
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-gray-500">รหัส</div>
                    <div className="text-2xl font-bold font-mono">{v.empId}</div>
                    <div className="text-sm text-gray-500 mt-1">สังกัด: {v.type}</div>

                    <div className="mt-3 flex items-center gap-2">
                      <Shield size={16} className="text-gray-400" />
                      <div className="text-sm text-gray-600">บทบาท:</div>
                      <select
                        value={role}
                        onChange={(e) => handleChangeRole(e.target.value as VolunteerRole)}
                        className="border rounded-lg px-3 py-2 text-sm outline-none"
                        disabled={loading}
                      >
                        <option value="VOLUNTEER">VOLUNTEER</option>
                        <option value="STAFF">STAFF</option>
                        <option value="ADMIN">ADMIN</option>
                      </select>
                    </div>

                    <div className="mt-2 text-sm text-gray-500">
                      จำนวนครั้งกิจกรรม: <span className="font-bold text-gray-800">{activityCount}</span>
                      <button
                        onClick={() => refreshActivity(v.empId)}
                        className="ml-3 text-xs text-gray-500 hover:text-gray-800"
                        disabled={loadingActivity}
                      >
                        {loadingActivity ? "กำลังโหลด..." : "Refresh"}
                      </button>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-xs text-gray-500">แต้มคงเหลือ</div>
                    <div className="text-3xl font-bold text-primary">{points}</div>
                    <button
                      onClick={() => {
                        refreshPointsAndHistory(v.id, v.empId);
                        refreshActivity(v.empId);
                      }}
                      className="mt-2 inline-flex items-center gap-2 text-xs text-gray-500 hover:text-gray-800"
                    >
                      <RefreshCcw size={14} /> Refresh
                    </button>
                  </div>
                </div>

                <div className="mt-4 text-sm text-gray-500">
                  ไปดูหน้า Profile:{" "}
                  <Link className="text-primary font-bold" to={`/profile/${v.empId}`}>
                    /profile/{v.empId}
                  </Link>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <div className="font-bold text-gray-800 mb-3">เพิ่ม / หัก แต้ม</div>

                <label className="text-sm text-gray-600">จำนวนแต้ม</label>
                <input
                  type="number"
                  min="1"
                  className="w-full mt-2 border rounded-xl p-3 outline-none focus:ring-2 focus:ring-primary font-bold"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="เช่น 20"
                />

                <label className="text-sm text-gray-600 mt-3 block">หมายเหตุ (optional)</label>
                <input
                  className="w-full mt-2 border rounded-xl p-3 outline-none focus:ring-2 focus:ring-primary"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="เช่น เพิ่มแต้มจากกิจกรรม / ปรับแก้ข้อมูล"
                />

                <div className="mt-4 border rounded-xl p-3 bg-gray-50">
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={countAsActivity}
                      onChange={(e) => setCountAsActivity(e.target.checked)}
                    />
                    นับเป็น “กิจกรรมอาสา” ครั้งนี้
                  </label>

                  {countAsActivity && (
                    <div className="grid grid-cols-2 gap-3 mt-3">
                      <div>
                        <label className="text-xs text-gray-600">วันที่กิจกรรม</label>
                        <input
                          type="date"
                          value={activityDate}
                          onChange={(e) => setActivityDate(e.target.value)}
                          className="w-full mt-1 border rounded-lg px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-600">จำนวนครั้ง</label>
                        <input
                          type="number"
                          min={1}
                          value={activityTimes}
                          onChange={(e) => setActivityTimes(Number(e.target.value))}
                          className="w-full mt-1 border rounded-lg px-3 py-2 text-sm"
                        />
                      </div>
                      <div className="col-span-2 text-xs text-gray-500">
                        * ถ้า role = ADMIN ระบบจะบันทึกกิจกรรมเป็น ADMIN เพื่อขึ้น Leaderboard ฝั่ง Admin
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 mt-4">
                  <button
                    onClick={handleGive}
                    disabled={!canSubmit || loading}
                    className="inline-flex items-center justify-center gap-2 bg-green-600 text-white font-bold rounded-xl py-3 hover:bg-green-700 disabled:opacity-50"
                  >
                    <PlusCircle size={18} /> เพิ่ม
                  </button>

                  <button
                    onClick={handleDeduct}
                    disabled={!canSubmit || loading}
                    className="inline-flex items-center justify-center gap-2 bg-red-600 text-white font-bold rounded-xl py-3 hover:bg-red-700 disabled:opacity-50"
                  >
                    <MinusCircle size={18} /> หัก
                  </button>
                </div>
              </div>
            </div>
          )}

          {v && (
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <div className="font-bold text-gray-800">ประวัติกิจกรรมอาสา</div>
                <button
                  onClick={() => refreshActivity(v.empId)}
                  className="text-xs text-gray-500 hover:text-gray-800"
                  disabled={loadingActivity}
                >
                  {loadingActivity ? "กำลังโหลด..." : "Refresh"}
                </button>
              </div>

              {loadingActivity ? (
                <div className="text-sm text-gray-400">Loading activity...</div>
              ) : activityRows.length === 0 ? (
                <div className="text-sm text-gray-400">ยังไม่มีประวัติกิจกรรม</div>
              ) : (
                <div className="space-y-2">
                  {activityRows.map((a: any) => {
                    const id = String(a.id ?? "").trim();
                    return (
                      <div key={id} className="border rounded-xl p-3 flex items-center justify-between">
                        <div>
                          <div className="text-sm font-bold text-gray-800">
                            {a.status} • {a.activity_date}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            created: {a.created_at ? new Date(a.created_at).toLocaleString("th-TH") : "-"}
                          </div>
                        </div>

                        <button
                          onClick={() => handleVoidActivity(id)}
                          className="inline-flex items-center gap-2 text-sm text-red-600 hover:text-red-700"
                          disabled={loading || !id}
                          title="ลบ (void)"
                        >
                          <Trash2 size={16} /> ลบ
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="mt-3 text-xs text-gray-400">
                * การลบคือการ “void” ทำให้หายจาก Profile และ Leaderboard ทันที (ระบบนับเฉพาะ is_void=false)
              </div>
            </div>
          )}

          {v && (
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 font-bold text-gray-800 mb-3">
                <History size={18} /> ประวัติแต้ม (โอน/ปรับ)
              </div>

              {loadingHistory ? (
                <div className="text-sm text-gray-400">Loading history...</div>
              ) : history.length === 0 ? (
                <div className="text-sm text-gray-400">ยังไม่มีประวัติ</div>
              ) : (
                <div className="space-y-2">
                  {history.map((t: any) => (
                    <div key={t.id} className="border rounded-xl p-3 flex items-center justify-between">
                      <div>
                        <div className="text-sm font-bold text-gray-800">
                          {t.type} • {t.note ?? "-"}
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          {t.created_at ? new Date(t.created_at).toLocaleString("th-TH") : "-"}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          from: {t.from_volunteer_code ?? "-"} → to: {t.to_volunteer_code ?? "-"}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-lg font-bold text-primary">{t.amount}</div>
                        <div className="text-xs text-gray-400">แต้ม</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-3 text-xs text-gray-400">
                * (หมายเหตุ) ลบ “ประวัติแต้ม” แบบหายจริงต้องเพิ่มระบบ void ใน point_transactions
                แต่ตอนนี้ “ลบกิจกรรม” เพื่อให้ Leaderboard หาย = ทำงานครบแล้ว
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
