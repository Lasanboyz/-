import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Trophy,
  Medal,
  Calendar,
  Flag,
  Users,
  Briefcase,
} from "lucide-react";

import {
  fetchLeaderboardSummary,
  getCurrentThaiYear,
  getRank,
  type LeaderboardMode,
} from "../services/dataService";

import type { Volunteer, RankConfig } from "../types";

interface LeaderboardItem {
  volunteer: Volunteer;
  points: number;
  activityCount: number;
  rank: RankConfig;
}

type ViewType = "VOLUNTEER" | "STAFF";

export const Leaderboard: React.FC = () => {
  const navigate = useNavigate();

  const [items, setItems] = useState<LeaderboardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const currentThaiYear = getCurrentThaiYear();
  const maxYear = Math.max(currentThaiYear, 2570);
  const minYear = 2557;
  const yearOptions = useMemo(
    () => Array.from({ length: maxYear - minYear + 1 }, (_, i) => maxYear - i),
    [maxYear]
  );

  const [selectedYear, setSelectedYear] = useState<number>(currentThaiYear);
  const [viewType, setViewType] = useState<ViewType>("VOLUNTEER");

  const isNoScoreYear = selectedYear >= 2557 && selectedYear <= 2568;
  const isAllYears = selectedYear === 0;

  const highlightActivityCount = isNoScoreYear || isAllYears;

  const mode: LeaderboardMode = viewType === "STAFF" ? "ADMIN" : "VOLUNTEERS";

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        setLoading(true);
        setErrorMsg(null);

        // ✅ ดึงจาก activity_history แล้วคำนวณเอง (แก้ปัญหา view/SQL)
        const rows: any[] = await fetchLeaderboardSummary(mode, selectedYear);

        if (cancelled) return;

        const mapped: LeaderboardItem[] = (rows ?? []).map((r: any) => {
          const empId = r.volunteer_code ?? "";

          const points = Number(r.points ?? 0);
          const activityCount = Number(r.activity_count ?? 0);

          const volunteer: Volunteer = {
            id: empId, // ใช้เป็น key พอ
            empId,
            name: r.name ?? "",
            type: r.branch ?? "",
            ...(typeof r.is_staff === "boolean" ? { isStaff: r.is_staff } : {}),
          } as any;

          // ปีไม่คิดคะแนน -> points ต้องเป็น 0 (ฟังก์ชันด้านบนคุมไว้แล้ว แต่กันไว้ซ้ำ)
          const pointsAfterRule =
            selectedYear !== 0 && selectedYear >= 2557 && selectedYear <= 2568 ? 0 : points;

          const rank = getRank(pointsAfterRule, activityCount);

          return {
            volunteer,
            points: pointsAfterRule,
            activityCount,
            rank,
          };
        });

        // sort
        mapped.sort((a, b) =>
          highlightActivityCount ? b.activityCount - a.activityCount : b.points - a.points
        );

        setItems(mapped);
      } catch (e: any) {
        if (cancelled) return;
        console.error("Leaderboard load error:", e);
        setErrorMsg(e?.message ?? "โหลดข้อมูลไม่สำเร็จ");
        setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [mode, selectedYear, highlightActivityCount]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => navigate(-1)}
            className="p-2 bg-white rounded-full text-gray-500 hover:text-primary shadow-sm"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">จัดอันดับอาสา</h1>
            <p className="text-xs text-gray-500">รวมพลังสร้างสรรค์สังคม</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <div className="relative flex-grow sm:flex-grow-0">
            <select
              value={viewType}
              onChange={(e) => setViewType(e.target.value as ViewType)}
              className="w-full appearance-none bg-white border border-pink-200 text-gray-700 py-2 pl-4 pr-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary shadow-sm font-medium"
            >
              <option value="VOLUNTEER">รายชื่ออาสา</option>
              <option value="STAFF">ทีมงาน / Admin</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-pink-500">
              {viewType === "VOLUNTEER" ? <Users size={16} /> : <Briefcase size={16} />}
            </div>
          </div>

          <div className="relative flex-grow sm:flex-grow-0">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="w-full appearance-none bg-white border border-pink-200 text-gray-700 py-2 pl-4 pr-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary shadow-sm font-medium"
            >
              <option value={0}>รวมทุกปี (ทั้งหมด)</option>
              {yearOptions.map((year) => (
                <option key={year} value={year}>
                  ประจำปี {year}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-pink-500">
              <Calendar size={16} />
            </div>
          </div>
        </div>
      </div>

      <div
        className={`rounded-3xl p-6 text-white shadow-lg text-center relative overflow-hidden transition-all duration-500 ${
          viewType === "VOLUNTEER"
            ? "bg-gradient-to-br from-pink-500 to-rose-400"
            : "bg-gradient-to-br from-purple-600 to-indigo-500"
        }`}
      >
        <div className="absolute top-0 right-0 p-4 opacity-20">
          <Trophy size={140} />
        </div>

        <h2 className="text-xl font-bold relative z-10">
          {isAllYears
            ? viewType === "VOLUNTEER"
              ? "สุดยอดอาสาตลอดกาล"
              : "สุดยอดทีมงานตลอดกาล"
            : `${viewType === "VOLUNTEER" ? "สุดยอดอาสาแห่งปี" : "สุดยอดทีมงานแห่งปี"} ${selectedYear}`}
        </h2>

        <p className="text-white/80 text-sm relative z-10 mt-1">
          {highlightActivityCount ? "เรียงตามจำนวนครั้งที่เข้าร่วมกิจกรรม" : "เรียงตามคะแนนสะสมสูงสุด"}
        </p>

        {isNoScoreYear && !isAllYears && (
          <div className="mt-2 inline-block bg-white/20 px-3 py-1 rounded-full text-xs font-medium backdrop-blur-sm relative z-10">
            ปีนี้งดเว้นคะแนน (นับจำนวนครั้ง)
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-pink-100 overflow-hidden min-h-[300px]">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full py-12 text-gray-400">
            <Trophy size={48} className="mb-2 opacity-20" />
            <p>กำลังโหลดข้อมูล...</p>
          </div>
        ) : errorMsg ? (
          <div className="flex flex-col items-center justify-center h-full py-12 text-gray-400">
            <Trophy size={48} className="mb-2 opacity-20" />
            <p>{errorMsg}</p>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-12 text-gray-400">
            <Trophy size={48} className="mb-2 opacity-20" />
            <p>ยังไม่มีข้อมูลกิจกรรมในปี {selectedYear}</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {items
              .filter((i) => (highlightActivityCount ? i.activityCount > 0 : i.points > 0))
              .map((item, index) => (
                <div
                  key={`${item.volunteer.empId}_${index}`}
                  className="p-4 flex items-center gap-4 hover:bg-pink-50/50 transition animate-fade-in-up"
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  <div
                    className={`w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-full font-bold text-lg ${
                      index === 0
                        ? "bg-yellow-100 text-yellow-600 shadow-sm"
                        : index === 1
                        ? "bg-gray-100 text-gray-600 shadow-sm"
                        : index === 2
                        ? "bg-orange-100 text-orange-600 shadow-sm"
                        : "bg-white text-gray-400 border border-gray-100"
                    }`}
                  >
                    {index < 3 ? <Medal size={20} /> : index + 1}
                  </div>

                  <div className="flex-grow min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-lg font-bold text-gray-800">
                        {item.volunteer.empId}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full ${item.rank.color} flex items-center gap-1`}
                      >
                        {item.rank.icon} {item.rank.name}
                      </span>
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0 flex flex-col items-end">
                    {highlightActivityCount ? (
                      <>
                        <div className="flex items-center gap-1 text-2xl font-bold text-pink-600 leading-none">
                          {item.activityCount}
                          <span className="text-sm font-medium text-gray-500 mt-1">ครั้ง</span>
                        </div>

                        {!isNoScoreYear ? (
                          <div className="mt-1 text-[10px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                            รวม {item.points} คะแนน
                          </div>
                        ) : (
                          <div className="mt-1 text-[10px] text-gray-300">ไม่นำคะแนนมาคิด</div>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-1 text-2xl font-bold text-primary leading-none">
                          {item.points}
                          <span className="text-sm font-medium text-gray-500 mt-1">คะแนน</span>
                        </div>
                        <div className="mt-1 text-xs text-pink-600 bg-pink-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Flag size={10} /> {item.activityCount} ครั้ง
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
};
