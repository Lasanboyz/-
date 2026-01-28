import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Trophy, Medal, Calendar, Flag, Users, Briefcase } from "lucide-react";

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

  const isAllYears = selectedYear === 0;
  const isNoScoreYear = !isAllYears && selectedYear >= 2557 && selectedYear <= 2568;

  // ปีงดคะแนน หรือ รวมทุกปี => ไฮไลต์จำนวนครั้ง
  const highlightActivityCount = isAllYears || isNoScoreYear;

  const mode: LeaderboardMode = viewType === "STAFF" ? "ADMIN" : "VOLUNTEERS";

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        setLoading(true);
        setErrorMsg(null);

        const rows: any[] = await fetchLeaderboardSummary(mode, selectedYear);
        if (cancelled) return;

        // debug (เอาออกทีหลังได้)
        console.log("[Leaderboard] mode/year/rows:", mode, selectedYear, rows?.length ?? 0);

        const mapped: LeaderboardItem[] = (rows ?? []).map((r: any) => {
          const empId = String(r.volunteer_code ?? "").trim();

          const points = Number(r.points ?? 0);
          const activityCount = Number(r.activity_count ?? 0);

          const volunteer: Volunteer = {
            id: empId || crypto.randomUUID(), // กัน key ว่าง
            empId,
            name: r.name ?? "",
            type: r.branch ?? "", // 👈 ใช้เป็นสาขา
            ...(typeof r.is_staff === "boolean" ? { isStaff: r.is_staff } : {}),
          } as any;

          // กันซ้ำ: ปีงดคะแนน -> 0
          const pointsAfterRule = isNoScoreYear ? 0 : points;

          const rank = getRank(pointsAfterRule, activityCount);

          return { volunteer, points: pointsAfterRule, activityCount, rank };
        });

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
  }, [mode, selectedYear, highlightActivityCount, isNoScoreYear]);

  // ใช้ใน render (กัน list ว่างเพราะ filter)
  const visibleItems = useMemo(() => {
    return items.filter((i) => (highlightActivityCount ? i.activityCount > 0 : i.points > 0));
  }, [items, highlightActivityCount]);

  const emptyText = isAllYears ? "ยังไม่มีข้อมูลกิจกรรม" : `ยังไม่มีข้อมูลกิจกรรมในปี ${selectedYear}`;

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

        {isNoScoreYear && (
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
        ) : visibleItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-12 text-gray-400">
            <Trophy size={48} className="mb-2 opacity-20" />
            <p>{emptyText}</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {visibleItems.map((item, index) => {
              const isTop3 = index < 3;
              const isTop1 = index === 0;
              const isTop2 = index === 1;
              const isTop3rd = index === 2;

              const name = (item.volunteer.name ?? "").trim();
              const branch = (item.volunteer.type ?? "").trim();
              const nameWithBranch =
                name && branch ? `${name} • ${branch}` : name || branch || "";

              // Glow พื้นหลัง Top 3 (ใช้ gradient แบบนุ่มๆ)
              const topGlow =
                isTop1
                  ? "bg-gradient-to-r from-yellow-50 via-amber-50 to-white"
                  : isTop2
                  ? "bg-gradient-to-r from-slate-50 via-gray-50 to-white"
                  : isTop3rd
                  ? "bg-gradient-to-r from-orange-50 via-amber-50 to-white"
                  : "";

              // ring highlight
              const topRing =
                isTop1
                  ? "ring-1 ring-yellow-200"
                  : isTop2
                  ? "ring-1 ring-gray-200"
                  : isTop3rd
                  ? "ring-1 ring-orange-200"
                  : "";

              // crown color
              const crownColor =
                isTop1
                  ? "text-yellow-600"
                  : isTop2
                  ? "text-gray-500"
                  : "text-orange-600";

              return (
                <div
                  key={`${item.volunteer.empId}_${index}`}
                  className={`p-4 flex items-center gap-4 hover:bg-pink-50/50 transition animate-fade-in-up relative ${topGlow} ${topRing}`}
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  {/* crown icon on Top 3 */}
                  {isTop3 && (
                    <div className="absolute top-2 right-2 opacity-90">
                      <Trophy size={18} className={crownColor} />
                    </div>
                  )}

                  <div
                    className={`w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-full font-bold text-lg ${
                      isTop1
                        ? "bg-yellow-100 text-yellow-600 shadow-sm"
                        : isTop2
                        ? "bg-gray-100 text-gray-600 shadow-sm"
                        : isTop3rd
                        ? "bg-orange-100 text-orange-600 shadow-sm"
                        : "bg-white text-gray-400 border border-gray-100"
                    }`}
                  >
                    {isTop3 ? <Medal size={20} /> : index + 1}
                  </div>

                  {/* ✅ Mobile Pro + ชื่อ • สาขา */}
                  <div className="flex-grow min-w-0">
                    <div className="min-w-0">
                      {/* แถวบน: รหัส */}
                      <div className="flex items-baseline gap-2 min-w-0">
                        <span className="font-mono text-lg font-bold text-gray-800">
                          {item.volunteer.empId}
                        </span>

                        {/* จอใหญ่: โชว์ชื่อ • สาขา ข้างๆรหัส */}
                        {nameWithBranch ? (
                          <span className="hidden sm:inline text-sm font-semibold text-gray-700 truncate">
                            {nameWithBranch}
                          </span>
                        ) : null}
                      </div>

                      {/* มือถือ: โชว์ชื่อ • สาขา บรรทัดใหม่ */}
                      {nameWithBranch ? (
                        <div className="sm:hidden text-sm text-gray-600 truncate -mt-0.5">
                          {nameWithBranch}
                        </div>
                      ) : null}
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
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
