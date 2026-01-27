import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Award,
  Gift,
  History,
  Calendar,
  Send,
  X,
  AlertTriangle,
  User,
} from "lucide-react";

import { supabase as supabaseClient } from "../services/supabaseClient";
import {
  fetchVolunteerByCode,
  getCurrentThaiYear,
  mapVolunteerRowToVolunteer,
  transferPoints,
  fetchVolunteerPointsByCode,
} from "../services/dataService";
import type { Volunteer, Transaction, RankConfig } from "../types";

const POINTS_PER_ACTIVITY = 20;

type TxViewRow = any; // point_transactions_view row

export const Profile: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [volunteer, setVolunteer] = useState<Volunteer | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(getCurrentThaiYear());

  const [annualPoints, setAnnualPoints] = useState(0);
  const [totalPoints, setTotalPoints] = useState(0);
  const [rank, setRank] = useState<RankConfig | null>(null);

  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferReceiverId, setTransferReceiverId] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [transferSubmitting, setTransferSubmitting] = useState(false);

  const [reloadTick, setReloadTick] = useState(0);

  const volunteerCode = useMemo(() => {
    if (!id) return "";
    return id.replace(/^v_/, "").trim().toUpperCase();
  }, [id]);

  const isNoScoreYear = selectedYear >= 2557 && selectedYear <= 2568;

  const computeRank = (points: number, activityCount: number = 0): RankConfig => {
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
  };

  const toThaiYearFromDate = (dateLike: string) => {
    const d = new Date(dateLike);
    return d.getFullYear() + 543;
  };

  const sumPointsWithRule = (txs: Transaction[], year?: number) => {
    return txs
      .filter((t) => (year ? t.thaiYear === year : true))
      .reduce((sum, t) => {
        if (t.thaiYear >= 2557 && t.thaiYear <= 2568) return sum;

        // ✅ กันบวกซ้ำจากกิจกรรม (Activity จะไม่เอามานับรวมแต้มปี เพราะ DB points เป็นตัวจริง)
        if (String(t.type).toUpperCase() === "ACTIVITY") return sum;

        return sum + Number(t.amount ?? 0);
      }, 0);
  };

  const countActivities = (txs: Transaction[], year: number) => {
    return txs.filter((t) => t.type === "ACTIVITY" && t.thaiYear === year).length;
  };

// ✅ map point_transactions_view -> Transaction (handle transfer/deduct/adjustment/redeem)
const mapTxViewToTransaction = (t: TxViewRow, myVolunteerId: string): Transaction => {
  const txType = String(t.type ?? "transfer").toLowerCase(); // transfer | deduct | adjustment | redeem
  const amountAbs = Math.abs(Number(t.amount ?? 0));
  const createdAt = t.created_at ?? new Date().toISOString();
  const thaiYear = toThaiYearFromDate(createdAt);

  const fromId = t.from_volunteer_id ?? null;
  const toId = t.to_volunteer_id ?? null;

  // ออก/เข้า สำหรับ transfer (เท่านั้น)
  const isOut = fromId && String(fromId) === String(myVolunteerId);

  let signedAmount = amountAbs;

  if (txType === "transfer") {
    signedAmount = isOut ? -amountAbs : +amountAbs;
  } else if (txType === "deduct") {
    signedAmount = -amountAbs;
  } else if (txType === "adjustment") {
    signedAmount = +amountAbs;
  } else if (txType === "redeem") {
    // ✅ แลกของรางวัล = แต้มออกเสมอ
    signedAmount = -amountAbs;
  } else {
    // เผื่อ type อื่นๆในอนาคต: ถ้า from เป็นเราให้ถือว่าออก
    if (fromId && String(fromId) === String(myVolunteerId)) signedAmount = -amountAbs;
  }

  let desc = t.note ?? "-";
  if (txType === "transfer") {
    desc = isOut
      ? `โอนให้ ${t.to_name ?? t.to_volunteer_code ?? "-"}`
      : `ได้รับจาก ${t.from_name ?? t.from_volunteer_code ?? "-"}`;
  } else if (txType === "deduct") {
    desc = `หักแต้ม • ${t.note ?? "admin deduct"}`;
  } else if (txType === "adjustment") {
    desc = `ปรับแต้ม • ${t.note ?? "admin give"}`;
  } else if (txType === "redeem") {
    desc = `แลกรางวัล • ${t.note ?? "redeem"}`;
  }

  return {
    id: t.id,
    volunteerId: myVolunteerId,
    amount: signedAmount,
    type: txType.toUpperCase(), // TRANSFER | DEDUCT | ADJUSTMENT | REDEEM
    description: desc,
    date: createdAt,
    thaiYear,
    createdBy: "system",
    relatedId: isOut ? toId : fromId,
  } as any;
};

  useEffect(() => {
    if (!volunteerCode) {
      setLoading(false);
      setErrorMsg("Missing volunteer code");
      return;
    }

    let cancelled = false;

    const run = async () => {
      try {
        setLoading(true);
        setErrorMsg(null);

        const vRow = await fetchVolunteerByCode(volunteerCode);
        if (cancelled) return;

        if (!vRow) {
          setVolunteer(null);
          setTransactions([]);
          setAnnualPoints(0);
          setTotalPoints(0);
          setRank(null);
          setErrorMsg("ไม่พบข้อมูลอาสา/รหัสพนักงานนี้");
          return;
        }

        const mappedVolunteer: Volunteer = mapVolunteerRowToVolunteer(vRow);
        setVolunteer(mappedVolunteer);

        if (!supabaseClient) {
          setTransactions([]);
          setAnnualPoints(0);
          setTotalPoints(0);
          setRank(computeRank(0, 0));
          return;
        }

        // 1) activity_history -> +20/ครั้ง
        const { data: actData } = await supabaseClient
          .from("activity_history")
          .select("activity_date, thai_year, status")
          .eq("volunteer_code", volunteerCode)
          .eq("is_void", false)
          .order("activity_date", { ascending: false });

        const activityTx: Transaction[] = (actData ?? []).map((a: any, idx: number) => {
          const thaiYear =
            Number(a.thai_year) ||
            (a.activity_date ? toThaiYearFromDate(a.activity_date) : getCurrentThaiYear());

          return {
            id: `act_${thaiYear}_${idx}`,
            volunteerId: mappedVolunteer.id,
            amount: POINTS_PER_ACTIVITY,
            type: "ACTIVITY",
            description:
              String(a?.status ?? "").toUpperCase() === "ADMIN"
                ? "ร่วมกิจกรรมอาสา (ทีมงาน/Admin)"
                : "ร่วมกิจกรรมอาสา",
            date: a.activity_date ?? new Date().toISOString(),
            thaiYear,
            createdBy: "system",
          };
        });

        // 2) point_transactions_view -> TRANSFER/DEDUCT/ADJUSTMENT
        const { data: txData, error: txError } = await supabaseClient
          .from("point_transactions_view")
          .select("*")
          .or(`from_volunteer_id.eq.${vRow.id},to_volunteer_id.eq.${vRow.id}`)
          .order("created_at", { ascending: false });

        if (txError) console.error("TX load error:", txError);

        const pointTx: Transaction[] = (txData ?? []).map((t: any) =>
          mapTxViewToTransaction(t, vRow.id)
        );

        const allTx = [...pointTx, ...activityTx].sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        );

        setTransactions(allTx);

        // ✅ totalPoints ยึด DB points เป็นหลัก
        const latest = await fetchVolunteerPointsByCode(volunteerCode);
        const totalFromDb = Number(latest?.points ?? 0);
        setTotalPoints(totalFromDb);

        const currentYear = getCurrentThaiYear();
        const annual = sumPointsWithRule(allTx, currentYear);
        setAnnualPoints(annual);

        const activityCountThisYear = countActivities(allTx, currentYear);
        setRank(computeRank(annual, activityCountThisYear));
      } catch (err: any) {
        if (cancelled) return;
        console.error("Profile load error:", err);
        setErrorMsg(err?.message ?? "โหลดข้อมูลไม่สำเร็จ");
        setVolunteer(null);
        setTransactions([]);
        setAnnualPoints(0);
        setTotalPoints(0);
        setRank(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [volunteerCode, reloadTick]);

  useEffect(() => {
    if (!transactions || transactions.length === 0) {
      setAnnualPoints(0);
      setRank(computeRank(0, 0));
      return;
    }

    const currentYear = getCurrentThaiYear();
    const effectiveYear = selectedYear === 0 ? currentYear : selectedYear;

    const pts = sumPointsWithRule(transactions, effectiveYear);
    const activityCount = countActivities(transactions, effectiveYear);

    setAnnualPoints(pts);
    setRank(computeRank(pts, activityCount));
  }, [selectedYear, transactions]);

  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!volunteer) return;

    const toCode = String(transferReceiverId ?? "").trim().toUpperCase();
    const amount = Number(transferAmount ?? 0);

    if (!toCode) return alert("กรุณาระบุรหัสพนักงานผู้รับ");
    if (toCode === String(volunteer.empId).trim().toUpperCase()) return alert("ห้ามโอนให้ตัวเอง");
    if (!Number.isFinite(amount) || amount <= 0) return alert("กรุณาระบุจำนวนแต้มที่ถูกต้อง");
    if (amount > Math.max(totalPoints, 0)) return alert(`แต้มไม่พอ (โอนได้สูงสุด ${totalPoints})`);

    const receiverRow = await fetchVolunteerByCode(toCode);
    if (!receiverRow) return alert("ไม่พบรหัสผู้รับในระบบ");

    if (
      !confirm(
        `ยืนยันการโอน ${amount} แต้ม ให้รหัส ${toCode}?\n\n⚠️ เมื่อโอนแล้วจะไม่สามารถเรียกคืนได้!`
      )
    )
      return;

    try {
      setTransferSubmitting(true);

      await transferPoints({
        fromVolunteerCode: volunteer.empId,
        toVolunteerCode: toCode,
        amount,
        note: `transfer by ${volunteer.empId}`,
      });

      setShowTransferModal(false);
      setTransferReceiverId("");
      setTransferAmount("");
      setReloadTick((x) => x + 1);

      alert("โอนแต้มสำเร็จ ✅");
    } catch (err: any) {
      console.error("transfer error:", err);
      alert(err?.message ?? "โอนไม่สำเร็จ");
    } finally {
      setTransferSubmitting(false);
    }
  };

  if (loading) return <div className="p-8 text-center">Loading...</div>;

  if (errorMsg) {
    return (
      <div className="p-8 text-center space-y-4">
        <div className="text-gray-700 font-semibold">{errorMsg}</div>
        <Link to="/" className="inline-flex items-center text-gray-500 hover:text-gray-800">
          <ArrowLeft size={20} className="mr-1" /> กลับไปหน้าแรก
        </Link>
      </div>
    );
  }

  if (!volunteer) {
    return (
      <div className="p-8 text-center space-y-4">
        <div className="text-gray-700 font-semibold">ไม่พบข้อมูล</div>
        <Link to="/" className="inline-flex items-center text-gray-500 hover:text-gray-800">
          <ArrowLeft size={20} className="mr-1" /> กลับไปหน้าแรก
        </Link>
      </div>
    );
  }

  const displayedTransactions =
    selectedYear === 0 ? transactions : transactions.filter((t) => t.thaiYear === selectedYear);

  const availableYears = Array.from(new Set(transactions.map((t) => t.thaiYear))).sort(
    (a: number, b: number) => b - a
  );

  if (!availableYears.includes(getCurrentThaiYear())) {
    availableYears.unshift(getCurrentThaiYear());
  }

  return (
    <div className="space-y-6 relative">
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <Award size={120} />
        </div>

        <Link to="/" className="inline-flex items-center text-gray-500 hover:text-gray-800 mb-4">
          <ArrowLeft size={20} className="mr-1" /> ค้นหาใหม่
        </Link>

        <div className="relative z-10">
          <h1 className="text-3xl font-bold text-gray-900 font-mono tracking-wide">
            {volunteer.empId}
          </h1>

          <div className="flex flex-wrap items-center gap-3 text-gray-500 mt-2">
            <span className="text-sm">สังกัด: {volunteer.type}</span>
          </div>

          <div className="mt-6 flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 mb-1">ระดับประจำปี {selectedYear}</p>
              <div
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full ${
                  rank?.color ?? "bg-gray-100 text-gray-700"
                } font-bold text-sm`}
              >
                <span>{rank?.icon ?? "🏷️"}</span>
                <span>{rank?.name ?? "-"}</span>
              </div>
            </div>

            <div className="text-right">
              <p className="text-sm text-gray-500 mb-1">แต้มสะสมปีนี้</p>
              <span className={`text-3xl font-bold ${isNoScoreYear ? "text-gray-400" : "text-primary"}`}>
                {isNoScoreYear ? "ไม่ระบุ" : annualPoints}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-blue-50 p-4 rounded-xl flex flex-col justify-between border border-blue-100 relative overflow-hidden">
          <div className="text-center z-10">
            <span className="text-sm text-blue-600 font-medium mb-1 block">แต้มรวมทั้งหมด</span>
            <span className="text-2xl font-bold text-blue-800 block">{totalPoints}</span>
          </div>

          <button
            onClick={() => setShowTransferModal(true)}
            className="mt-3 w-full bg-blue-600 text-white text-xs py-2 rounded-lg hover:bg-blue-700 flex items-center justify-center gap-1 shadow-sm transition z-10"
          >
            <Send size={12} /> โอนแต้มให้เพื่อน
          </button>
        </div>

        {/* ✅ เปลี่ยนจาก /rewards/:volunteerCode -> /rewards (ไม่ส่ง code ใน URL แล้ว) */}
        <Link
          to="/rewards"
          state={{ volunteerCode: volunteer.empId }} // เผื่อหน้า Rewards อยากใช้ (optional)
          className="bg-secondary p-4 rounded-xl flex flex-col items-center justify-center text-center text-white hover:bg-pink-400 transition shadow-sm"
        >
          <Gift className="mb-1" size={24} />
          <span className="font-bold">แลกรางวัล</span>
        </Link>
      </div>

      <div className="flex items-center justify-between mt-8 mb-4">
        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
          <History size={20} className="text-primary" /> ประวัติกิจกรรม
        </h2>

        <div className="relative">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="appearance-none bg-white border border-pink-200 text-gray-700 py-1.5 pl-3 pr-8 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm shadow-sm"
          >
            <option value={getCurrentThaiYear()}>{getCurrentThaiYear()}</option>
            <option value={0}>ทั้งหมด</option>
            {availableYears
              .filter((y) => y !== getCurrentThaiYear())
              .map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
          </select>

          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-pink-500">
            <Calendar size={14} />
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {displayedTransactions.length === 0 ? (
          <div className="text-center py-10 text-gray-400 bg-white rounded-xl border border-dashed border-gray-200">
            ไม่มีรายการในปี {selectedYear}
          </div>
        ) : (
          displayedTransactions.map((tx: any) => (
            <div
              key={tx.id}
              className="bg-white p-4 rounded-xl shadow-sm border border-gray-50 flex justify-between items-center hover:shadow-md transition"
            >
              <div>
                <div className="font-bold text-gray-800 text-sm">{tx.description}</div>
                <div className="text-xs text-gray-400 mt-1">
                  {new Date(tx.date).toLocaleDateString("th-TH")} • {tx.type}
                </div>
              </div>

              <div className={`font-bold text-lg ${tx.amount >= 0 ? "text-green-500" : "text-red-500"}`}>
                {tx.amount >= 0 ? "+" : ""}
                {tx.amount}
              </div>
            </div>
          ))
        )}
      </div>

      {showTransferModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 relative shadow-2xl">
            <button
              onClick={() => setShowTransferModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
              disabled={transferSubmitting}
            >
              <X size={24} />
            </button>

            <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Send size={20} className="text-blue-600" /> โอนแต้มให้เพื่อน
            </h3>

            <div className="bg-blue-50 border border-blue-100 p-3 rounded-lg mb-4 text-sm text-blue-800 flex items-start gap-2">
              <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold">ข้อควรระวัง</p>
                <p className="text-xs opacity-80">
                  โอนแล้วเรียกคืนไม่ได้ กรุณาตรวจสอบ “รหัสผู้รับ” และ “จำนวนแต้ม” ให้ถูกต้องก่อนกดโอน
                </p>
              </div>
            </div>

            <form onSubmit={handleTransferSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  รหัสพนักงานเพื่อน (ผู้รับ)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="ระบุรหัสพนักงาน"
                    className="w-full pl-10 p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    value={transferReceiverId}
                    onChange={(e) => setTransferReceiverId(e.target.value)}
                    disabled={transferSubmitting}
                  />
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">จำนวนแต้มที่โอน</label>
                <input
                  type="number"
                  required
                  min="1"
                  max={Math.max(totalPoints, 1)}
                  placeholder={`สูงสุด ${totalPoints}`}
                  className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-bold text-lg"
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                  disabled={transferSubmitting}
                />
              </div>

              <button
                type="submit"
                disabled={transferSubmitting}
                className={`w-full font-bold py-3 rounded-xl shadow-lg transition ${
                  transferSubmitting
                    ? "bg-gray-300 text-gray-600"
                    : "bg-blue-600 text-white hover:bg-blue-700 shadow-blue-200"
                }`}
              >
                {transferSubmitting ? "กำลังโอน..." : "ยืนยันการโอน"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
