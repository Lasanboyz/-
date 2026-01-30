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

type VolunteerRow = {
  id: any;
  volunteer_code: any;
  name: any;
  branch: any;
  role: any;
  points: any;
};

type ActivityRow = {
  volunteer_code: any;
  thai_year: any;
  status: any; // "ADMIN" | "VOLUNTEER" | null
};

// ---- Code normalize (สำคัญมาก) ----
// 1) trim/remove spaces
// 2) uppercase
// 3) รองรับกรณีเป็น number -> pad 8 หลัก (กัน leading zero หาย)
function normalizeCode(v: any) {
  if (v === null || v === undefined) return "";

  // If it is a number, it already lost leading zeros; pad to 8 as a practical default.
  if (typeof v === "number" && Number.isFinite(v)) {
    const s = String(Math.trunc(v));
    return s.padStart(8, "0").toUpperCase();
  }

  const raw = String(v).trim().replace(/\s+/g, "").toUpperCase();

  // If it's all digits and short, try padStart to 8 (common employee/volunteer code length)
  if (/^\d+$/.test(raw) && raw.length > 0 && raw.length < 8) {
    return raw.padStart(8, "0");
  }

  return raw;
}

function normalizeRole(role: any): "ADMIN" | "VOLUNTEER" {
  const r = String(role ?? "").toUpperCase().trim();
  return r === "ADMIN" || r === "STAFF" ? "ADMIN" : "VOLUNTEER";
}

function isStaffLikeByRole(role: any) {
  const r = String(role ?? "").toUpperCase().trim();
  return r === "ADMIN" || r === "STAFF";
}

/**
 * ✅ PostgREST limit ~1000 rows ต่อ request
 * ทำ helper ดึงแบบ paginate จนครบ
 */
async function fetchAll<T>(
  makeQuery: (from: number, to: number) => any,
  pageSize = 1000,
  maxPages = 80 // กันลูปไม่จบ (80k rows)
): Promise<T[]> {
  const out: T[] = [];
  for (let page = 0; page < maxPages; page++) {
    const from = page * pageSize;
    const to = from + pageSize - 1;

    const { data, error } = await makeQuery(from, to);
    if (error) throw error;

    const rows = (data ?? []) as T[];
    out.push(...rows);

    if (rows.length < pageSize) break;
  }
  return out;
}

function pickBetterVolunteer(a: VolunteerRow, b: VolunteerRow): VolunteerRow {
  // เลือกแถวที่ "ดีที่สุด" เมื่อ volunteer_code ซ้ำ
  const aName = String(a.name ?? "").trim();
  const bName = String(b.name ?? "").trim();
  const aBranch = String(a.branch ?? "").trim();
  const bBranch = String(b.branch ?? "").trim();
  const aPts = Number(a.points ?? 0);
  const bPts = Number(b.points ?? 0);

  // Prefer non-empty name
  if (!!aName !== !!bName) return aName ? a : b;
  // Prefer non-empty branch
  if (!!aBranch !== !!bBranch) return aBranch ? a : b;
  // Prefer higher points (just in case)
  if (aPts !== bPts) return aPts > bPts ? a : b;

  // Prefer ADMIN/STAFF row if one is staff-like (rare)
  const aStaff = isStaffLikeByRole(a.role);
  const bStaff = isStaffLikeByRole(b.role);
  if (aStaff !== bStaff) return aStaff ? a : b;

  return a; // stable
}

function effectiveStatus(rowStatus: any, roleByCode: Map<string, "ADMIN" | "VOLUNTEER">, code: string): "ADMIN" | "VOLUNTEER" {
  const s = String(rowStatus ?? "").toUpperCase().trim();
  if (s === "ADMIN" || s === "VOLUNTEER") return s as any;
  return roleByCode.get(code) ?? "VOLUNTEER";
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
        // 1) ✅ ดึง volunteers ให้ครบทุกแถว (paginate) + dedupe
        // =========================
        const vRows = await fetchAll<VolunteerRow>(
          (from, to) =>
            supabaseClient
              .from("volunteers")
              .select("id, volunteer_code, name, branch, role, points")
              .range(from, to),
          1000
        );

        if (cancelled) return;

        // normalize + dedupe by volunteer_code
        const bestByCode = new Map<string, VolunteerRow>();

        for (const r of vRows ?? []) {
          const code = normalizeCode(r.volunteer_code);
          if (!code) continue;

          const normalized: VolunteerRow = {
            ...r,
            volunteer_code: code,
            name: String(r.name ?? "").trim(),
            branch: String(r.branch ?? "").trim(),
            role: String(r.role ?? "").trim(),
            points: Number(r.points ?? 0),
          };

          const existing = bestByCode.get(code);
          bestByCode.set(code, existing ? pickBetterVolunteer(existing, normalized) : normalized);
        }

        const dedupedVols = Array.from(bestByCode.values()).map((r) => ({
          id: r.id ?? r.volunteer_code,
          volunteer_code: normalizeCode(r.volunteer_code),
          name: String(r.name ?? "").trim(),
          branch: String(r.branch ?? "").trim(),
          role: String(r.role ?? "").trim(),
          points: Number(r.points ?? 0),
        }));

        // roleByCode (ใช้ตัดสิน status NULL และแบ่ง viewType)
        const roleByCode = new Map<string, "ADMIN" | "VOLUNTEER">();
        for (const v of dedupedVols) {
          roleByCode.set(v.volunteer_code, normalizeRole(v.role));
        }

        const vols =
          mode === "ADMIN"
            ? dedupedVols.filter((r) => isStaffLikeByRole(r.role))
            : dedupedVols.filter((r) => !isStaffLikeByRole(r.role));

        // =========================
        // 2) ✅ ดึง activity_history ให้ครบทุกแถวตามเงื่อนไข (paginate)
        //    ❗ไม่ filter status ที่ query แล้ว (กัน status NULL / กัน import พัง)
        // =========================
        const actRows = await fetchAll<ActivityRow>(
          (from, to) => {
            let q = supabaseClient
              .from("activity_history")
              .select("volunteer_code, thai_year, status")
              .eq("is_void", false)
              .range(from, to);

            if (!isAllYears) q = q.eq("thai_year", selectedYear);
            return q;
          },
          1000
        );

        if (cancelled) return;

        const activityCountByCode = new Map<string, number>();

        for (const a of actRows ?? []) {
          const code = normalizeCode(a.volunteer_code);
          if (!code) continue;

          // decide effective status
          const s = effectiveStatus(a.status, roleByCode, code);

          if (mode === "ADMIN" && s !== "ADMIN") continue;
          if (mode !== "ADMIN" && s !== "VOLUNTEER") continue;

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
            id: empId || (typeof crypto !== "undefined" ? crypto.randomUUID() : `${Date.now()}_${Math.random()}`),
            empId,
            name: (r.name ?? "").trim(), // ถ้าหายจริงๆ แสดงว่าข้อมูลใน DB ว่าง
            type: (r.branch ?? "").trim(),
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
              const nameWithBranch =
                name && branch ? `${name} • ${branch}` : name || branch || "";

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
                  key={item.volunteer.empId} // ✅ stable หลัง dedupe แล้ว
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
                        <div className="text-xs text-gray-400 -mt-0.5">ไม่พบชื่อ/สาขา</div>
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
