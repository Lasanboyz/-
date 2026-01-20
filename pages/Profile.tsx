import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
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
} from 'lucide-react';

// ✅ ใช้ Supabase fetch แทน local dataService
import { fetchVolunteerByCode, getCurrentThaiYear } from '../services/dataService';

import { Volunteer, Transaction, RankConfig } from '../types';

export const Profile: React.FC = () => {
  // ✅ ตอนนี้ id = volunteer_code (เช่น 80010301)
  const { id } = useParams<{ id: string }>();

  const [volunteer, setVolunteer] = useState<Volunteer | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(getCurrentThaiYear());

  // Stats
  const [annualPoints, setAnnualPoints] = useState(0);
  const [totalPoints, setTotalPoints] = useState(0);
  const [rank, setRank] = useState<RankConfig | null>(null);

  // Transfer Modal State (ยังไม่ทำ Supabase transfer ในรอบนี้)
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferReceiverId, setTransferReceiverId] = useState('');
  const [transferAmount, setTransferAmount] = useState('');

  // ✅ ถ้าปีที่เลือกอยู่ในช่วงที่คุณตั้งให้ “ไม่ระบุ”
  const isNoScoreYear = selectedYear >= 2557 && selectedYear <= 2568;

  // ===============================
  // ✅ LOAD จาก Supabase (points มาจากคอลัมน์ points)
  // ===============================
  useEffect(() => {
    if (!id) return;

    const volunteerCode = id.replace(/^v_/, '').trim(); // ตัด v_ ออก
const data = await fetchVolunteerByCode(volunteerCode);

      if (!data) {
        setVolunteer(null);
        setAnnualPoints(0);
        setTotalPoints(0);
        setTransactions([]);
        setRank(null);
        return;
      }

      const mappedVolunteer: Volunteer = {
        id: data.id, // uuid จาก Supabase
        empId: data.volunteer_code, // รหัสพนักงาน
        type: data.branch ?? '',
      };

      setVolunteer(mappedVolunteer);

      // ✅ ตอนนี้แต้มอ่านจาก Supabase โดยตรง
      const pts = Number(data.points ?? 0);
      setTotalPoints(pts);

      // ถ้าตอนนี้ยังไม่มีตาราง transactions ใน Supabase
      // ให้ annualPoints = points ไปก่อน (หรือจะทำ 0 ก็ได้ตาม logic ของคุณ)
      setAnnualPoints(pts);

      // ✅ คำนวน rank แบบง่าย (ถ้า RankConfig ของคุณพึ่งพา dataService เดิมมาก)
      // ถ้าคุณมี rank config อยู่ใน dataService เดิม ให้บอกผม เดี๋ยวผมผูกให้
      // ตอนนี้ใส่ fallback กันพัง:
      const annualCount = 0;
      const computedRank: RankConfig = {
        name: pts >= 200 ? 'ผู้พิชิตตำนาน' : pts >= 50 ? 'ผู้เริ่มต้นแข็งแกร่ง' : 'ผู้เริ่มต้นแบ่งปัน',
        color: pts >= 200 ? 'bg-yellow-100 text-yellow-800' : pts >= 50 ? 'bg-green-100 text-green-800' : 'bg-lime-100 text-lime-800',
        icon: '🏅',
      };
      setRank(computedRank);

      // ✅ ยังไม่มี transactions → ให้เป็นว่าง
      setTransactions([]);
    };

    run();
  }, [id, selectedYear]);

  // ✅ Transfer ยังไม่ผูก Supabase ในรอบนี้ (ไม่งั้นแต้มจะไม่ตรง)
  const handleTransferSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!volunteer) return;

    const amount = parseInt(transferAmount);
    if (isNaN(amount) || amount <= 0) {
      alert('กรุณาระบุจำนวนแต้มที่ถูกต้อง');
      return;
    }

    if (
      !confirm(
        `ยืนยันการโอน ${amount} แต้ม ให้รหัส ${transferReceiverId}?\n\n⚠️ เมื่อโอนแล้วจะไม่สามารถเรียกคืนได้!`
      )
    ) {
      return;
    }

    alert('ตอนนี้ระบบโอนแต้มยังไม่ได้ผูกกับ Supabase (กำลังอ่านแต้มจาก Supabase แล้ว) — ถ้าจะให้โอนได้จริง เดี๋ยวผมทำฟังก์ชันให้ต่อเลย');
  };

  if (!id) return <div className="p-8 text-center">Missing profile id</div>;
  if (!volunteer) return <div className="p-8 text-center">Loading...</div>;

  // Filter Transactions for View (ตอนนี้ยังว่าง)
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
      {/* Header Profile */}
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
                  rank?.color ?? 'bg-gray-100 text-gray-700'
                } font-bold text-sm`}
              >
                <span>{rank?.icon ?? '🏷️'}</span>
                <span>{rank?.name ?? '-'}</span>
              </div>
            </div>

            <div className="text-right">
              <p className="text-sm text-gray-500 mb-1">แต้มสะสมปีนี้</p>
              <span className={`text-3xl font-bold ${isNoScoreYear ? 'text-gray-400' : 'text-primary'}`}>
                {isNoScoreYear ? 'ไม่ระบุ' : annualPoints}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
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

        {/* ✅ สำคัญ: routes ของคุณถ้าใช้ empId ให้ส่ง empId ไปด้วย */}
        <Link
          to={`/rewards/${volunteer.empId}`}
          className="bg-secondary p-4 rounded-xl flex flex-col items-center justify-center text-center text-white hover:bg-pink-400 transition shadow-sm"
        >
          <Gift className="mb-1" size={24} />
          <span className="font-bold">แลกรางวัล</span>
        </Link>
      </div>

      {/* Year Filter */}
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
            <option value={0}>ทั้งหมด</option>
            {availableYears.map((year) => (
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

      {/* Transaction List */}
      <div className="space-y-3">
        {displayedTransactions.length === 0 ? (
          <div className="text-center py-10 text-gray-400 bg-white rounded-xl border border-dashed border-gray-200">
            ตอนนี้ยังไม่มีประวัติกิจกรรม (transactions) ใน Supabase
          </div>
        ) : (
          displayedTransactions.map((tx) => (
            <div
              key={tx.id}
              className="bg-white p-4 rounded-xl shadow-sm border border-gray-50 flex justify-between items-center hover:shadow-md transition"
            >
              <div>
                <div className="font-bold text-gray-800 text-sm">{tx.description}</div>
                <div className="text-xs text-gray-400 mt-1">
                  {new Date(tx.date).toLocaleDateString('th-TH')} • {tx.type}
                </div>
              </div>
              <div className={`font-bold text-lg ${tx.amount > 0 ? 'text-green-500' : 'text-red-500'}`}>
                {tx.amount > 0 ? '+' : ''}
                {tx.amount}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Transfer Modal */}
      {showTransferModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 relative shadow-2xl">
            <button
              onClick={() => setShowTransferModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
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
                  ตอนนี้ยังไม่ได้ผูก “โอนแต้ม” กับ Supabase — ถ้าต้องการให้โอนได้จริง เดี๋ยวผมทำให้ต่อ
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
                  max={totalPoints}
                  placeholder={`สูงสุด ${totalPoints}`}
                  className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-bold text-lg"
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                />
              </div>

              <button
                type="submit"
                className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-200 transition"
              >
                ยืนยันการโอน
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
