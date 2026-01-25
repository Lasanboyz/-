import React, { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Search,
  PlusCircle,
  MinusCircle,
  History,
  RefreshCcw,
  UserPlus,
} from "lucide-react";

import type { Volunteer } from "../types";

import {
  fetchVolunteerByCode,
  mapVolunteerRowToVolunteer,
  fetchVolunteerPointsByCode,
  adminGivePoints,
  adminDeductPoints,
  adminFetchPointHistory,
  createVolunteer, // ✅ ต้องมีใน dataService.ts
} from "../services/dataService";

type TxRow = any;

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

  // ===== Adjust points =====
  const [amount, setAmount] = useState<string>("");
  const [note, setNote] = useState<string>("");

  // ===== History =====
  const [history, setHistory] = useState<TxRow[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // ===== Create volunteer (when not found) =====
  const [showCreate, setShowCreate] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [newBranch, setNewBranch] = useState<"HO" | "BRANCH">("BRANCH");

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
    setAmount("");
    setNote("");
    setShowCreate(false);
    setNewCode("");
    setNewName("");
    setNewBranch("BRANCH");
  };

  const refreshPointsAndHistory = async (volunteerId: string, volunteerCode: string) => {
    // points
    const p = await fetchVolunteerPointsByCode(volunteerCode);
    setPoints(Number(p?.points ?? 0));

    // history
    setLoadingHistory(true);
    try {
      const rows = await adminFetchPointHistory(volunteerId);
      setHistory(rows);
    } finally {
      setLoadingHistory(false);
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
        // ✅ ไม่พบ -> เปิดฟอร์มสร้างใหม่ทันที
        setMsg(`ไม่พบรหัส "${code}" ในตาราง volunteers — สามารถเพิ่มอาสาใหม่ได้ด้านล่าง`);
        setShowCreate(true);
        setNewCode(code); // auto fill จากที่ค้นหา
        return;
      }

      const mapped = mapVolunteerRowToVolunteer(row);
      setV(mapped);

      await refreshPointsAndHistory(row.id, code);
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

    if (!code) {
      setMsg("กรุณากรอกรหัสอาสา");
      return;
    }
    if (!name) {
      setMsg("กรุณากรอกชื่อ-นามสกุล");
      return;
    }

    setLoading(true);
    setMsg(null);

    try {
      const created = await createVolunteer({
        volunteerCode: code,
        name,
        branch,
        isStaff: false,
      });

      // โหลดใหม่เหมือนค้นหาเจอ
      const row = await fetchVolunteerByCode(code);
      if (!row) throw new Error("สร้างแล้วแต่ค้นหาไม่เจอ (เช็ก RLS/insert result)");

      const mapped = mapVolunteerRowToVolunteer(row);
      setV(mapped);
      setShowCreate(false);

      await refreshPointsAndHistory(row.id, code);

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
        <button
          onClick={() => navigate("/")}
          className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-800"
        >
          <ArrowLeft size={18} /> กลับหน้าแรก
        </button>
        <div className="text-gray-300">|</div>
        <div className="font-bold text-gray-800">Admin Panel</div>
      </div>

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
                placeholder="เช่น 80006423 หรือ V000001"
              />
              <Search
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
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

        {msg && (
          <div className="mt-3 text-sm text-gray-700 bg-gray-50 border border-gray-100 rounded-xl p-3">
            {msg}
          </div>
        )}
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

            <button
              onClick={() => setShowCreate(false)}
              className="text-gray-500 hover:text-gray-800"
            >
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
              </div>

              <div className="text-right">
                <div className="text-xs text-gray-500">แต้มคงเหลือ</div>
                <div className="text-3xl font-bold text-primary">{points}</div>
                <button
                  onClick={() => refreshPointsAndHistory(v.id, v.empId)}
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

          {/* Adjust */}
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

      {/* History */}
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
                      {new Date(t.created_at).toLocaleString("th-TH")}
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
        </div>
      )}
    </div>
  );
};
