import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Trophy, Calendar, Flag, Users, Briefcase, Crown } from "lucide-react";

import { supabase as supabaseClient } from "../services/supabaseClient";
import { getCurrentThaiYear, getRank, type LeaderboardMode } from "../services/dataService";

import type { Volunteer, RankConfig } from "../types";

interface LeaderboardItem {
  volunteer: Volunteer;
  points: number;
  activityCount: number;
  rank: RankConfig;
}

type ViewType = "VOLUNTEER" | "STAFF";

function normalizeCode(v: any) {
  return String(v ?? "").trim().replace(/\s+/g, "").toUpperCase();
}

// ✅ ใช้ role อย่างเดียว (ไม่ใช้ is_staff แล้ว)
function isStaffLike(row: any) {
  const role = String(row?.role ?? "").toUpperCase();
  return role === "ADMIN" || role === "STAFF";
}

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

  const highlightActivityCount = isAllYears || isNoScoreYear;
  const mode: LeaderboardMode = viewType === "STAFF" ? "ADMIN" : "VOLUNTEERS";

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        setLoading(true);
        setErrorMsg(null);

        if (!supabaseClient) {
          setItems([]);
          setErrorMsg("Supabase client not ready");
          return;
        }

        // =========================
        // 1) ✅ ดึงคะแนนจริงจาก volunteers.points (ไม่ select is_staff)
        // =========================
        const { data: vData, error: vError } = await supabaseClient
          .from("volunteers")
          .select("id, volunteer_code, name, branch, role, points");

        if (vError) throw vError;
        if (cancelled) return;

        const allVols = (vData ?? []).map((r: any) => ({
          id: r.id ?? normalizeCode(r.volunteer_code),
          volunteer_code: normalizeCode(r.volunteer_code),
          name: r.name ?? "",
          branch: r.branch ?? "",
          role: r.role ?? "",
          points: Number(r.points ?? 0),
        }));

        const vols =
          mode === "ADMIN"
            ? allVols.filter(isStaffLike)
            : allVols.filter((r) => !isStaffLike(r));

        // =========================
        // 2) ✅ นับ activity_count จาก activity_history
        // =========================
        let actQuery = supabaseClient
          .from("activity_history")
          .select("volunteer_code, thai_year, status")
          .eq("is_void", false);

        if (!isAllYears) actQuery = actQuery.eq("thai_year", selectedYear);

        actQuery =
          mode === "ADMIN"
            ? actQuery.eq("status", "ADMIN")
            : actQuery.eq("status", "VOLUNTEER");

        const { data: actData, error: actError } = await actQuery;
        if (actError) throw actError;
        if (cancelled) return;

        const activityCountByCode = new Map<string, number>();
        for (const a of actData ?? []) {
          const code = normalizeCode((a as any).volunteer_code);
          if (!code) continue;
          activityCountByCode.set(code, (activityCountByCode.get(code) ?? 0) + 1);
        }

        // =========================
        // 3) Merge -> LeaderboardItem
        // =========================
        const mapped: LeaderboardItem[] = vols.map((r) => {
          const empId = r.volunteer_code;
          const pointsRaw = Number(r.points ?? 0);
          const activityCount = Number(activityCountByCode.get(empId) ?? 0);

          const volunteer: Volunteer = {
            id: empId || crypto.randomUUID(),
            empId,
            name: r.name ?? "",
            type: r.branch ?? "",
          } as any;

          const pointsAfterRule = isNoScoreYear ? 0 : pointsRaw;
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
  }, [mode, selectedYear, highlightActivityCount, isNoScoreYear, isAllYears]);

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
              const isTop1 = index === 0;
              const isTop2 = index === 1;
              const isTop3 = index === 2;
              const isTop = index < 3;

              const name = (item.volunteer.name ?? "").trim();
              const branch = (item.volunteer.type ?? "").trim();
              const nameWithBranch = name && branch ? `${name} • ${branch}` : name || branch || "";

              const topBg =
                isTop1
                  ? "bg-gradient-to-r from-yellow-50 via-amber-50 to-white"
                  : isTop2
                  ? "bg-gradient-to-r from-slate-50 via-gray-50 to-white"
                  : isTop3
                  ? "bg-gradient-to-r from-orange-50 via-amber-50 to-white"
                  : "";

              const topRing =
                isTop1 ? "ring-1 ring-yellow-200" : isTop2 ? "ring-1 ring-gray-200" : isTop3 ? "ring-1 ring-orange-200" : "";

              const topShadow =
                isTop1
                  ? "shadow-[0_10px_25px_rgba(245,158,11,0.18)]"
                  : isTop2
                  ? "shadow-[0_10px_25px_rgba(100,116,139,0.14)]"
                  : isTop3
                  ? "shadow-[0_10px_25px_rgba(249,115,22,0.16)]"
                  : "";

              const crownColor = isTop1 ? "text-amber-500" : isTop2 ? "text-slate-400" : "text-orange-500";

              const badgeBg =
                isTop1
                  ? "bg-gradient-to-br from-amber-200 to-yellow-100 text-amber-700"
                  : isTop2
                  ? "bg-gradient-to-br from-slate-200 to-gray-100 text-slate-600"
                  : "bg-gradient-to-br from-orange-200 to-amber-100 text-orange-700";

              return (
                <div
                  key={`${item.volunteer.empId}_${index}`}
                  className={[
                    "p-4 flex items-center gap-4 transition animate-fade-in-up relative",
                    isTop ? `${topBg} ${topRing} ${topShadow} rounded-2xl mx-3 my-2` : "hover:bg-pink-50/50",
                  ].join(" ")}
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  {isTop && (
                    <div
                      className={[
                        "absolute -inset-0.5 rounded-2xl blur-xl opacity-40 pointer-events-none",
                        isTop1
                          ? "bg-gradient-to-r from-amber-200 via-yellow-100 to-transparent"
                          : isTop2
                          ? "bg-gradient-to-r from-slate-200 via-gray-100 to-transparent"
                          : "bg-gradient-to-r from-orange-200 via-amber-100 to-transparent",
                      ].join(" ")}
                    />
                  )}

                  <div className="relative flex-shrink-0">
                    {isTop ? (
                      <div className="w-12 h-12 rounded-2xl flex items-center justify-center font-extrabold text-xl shadow-sm bg-white/70">
                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${badgeBg}`}>
                          {index + 1}
                        </div>
                        <div className="absolute -top-2 -right-2 bg-white rounded-full p-1 shadow-sm">
                          <Crown size={16} className={crownColor} />
                        </div>
                      </div>
                    ) : (
                      <div className="w-10 h-10 flex items-center justify-center rounded-full font-bold text-gray-400 border border-gray-100 bg-white">
                        {index + 1}
                      </div>
                    )}
                  </div>

                  <div className="flex-grow min-w-0 relative">
                    <div className="min-w-0">
                      <div className="flex items-baseline gap-2 min-w-0">
                        <span className="font-mono text-lg font-extrabold text-gray-900 tracking-tight">
                          {item.volunteer.empId}
                        </span>
                      </div>

                      {nameWithBranch ? (
                        <div className="text-sm font-semibold text-gray-700 truncate -mt-0.5">{nameWithBranch}</div>
                      ) : (
                        <div className="text-xs text-gray-400 -mt-0.5">—</div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 mt-2">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${item.rank.color} flex items-center gap-1`}>
                        {item.rank.icon} {item.rank.name}
                      </span>

                      {isTop && (
                        <span className="text-[10px] font-bold text-gray-500 bg-white/70 px-2 py-0.5 rounded-full border border-gray-100">
                          TOP {index + 1}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0 flex flex-col items-end relative">
                    {highlightActivityCount ? (
                      <>
                        <div className="flex items-baseline gap-1 leading-none">
                          <span className="text-3xl font-extrabold text-pink-600">{item.activityCount}</span>
                          <span className="text-sm font-semibold text-gray-500">ครั้ง</span>
                        </div>

                        {!isNoScoreYear ? (
                          <div className="mt-1 text-[10px] text-gray-600 bg-white/70 px-2 py-0.5 rounded-full border border-gray-100">
                            รวม {item.points} คะแนน
                          </div>
                        ) : (
                          <div className="mt-1 text-[10px] text-gray-300">ไม่นำคะแนนมาคิด</div>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="flex items-baseline gap-1 leading-none">
                          <span className="text-3xl font-extrabold text-primary">{item.points}</span>
                          <span className="text-sm font-semibold text-gray-500">คะแนน</span>
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
