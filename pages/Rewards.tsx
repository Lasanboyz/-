// pages/Rewards.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle, Phone, X, Loader2 } from "lucide-react";
import { fetchVolunteerPointsByCode } from "../services/dataService";

// ✅ Local images (Vite: import from src/assets)
import bagImg from "../src/assets/กระเป๋าภารกิจคนอาสา.png";
import fanImg from "../src/assets/พัดลมพลังช้าง.png";
import umbrellaImg from "../src/assets/ร่มนักสู้แดดฝน.png";
import hatImg from "../src/assets/หมวกกันแดดสายเท่.png";
import richGlassImg from "../src/assets/แก้วน้ำคนรวย.png";

type AuthVolunteer = {
  id: string;
  volunteer_code: string;
  name: string;
  branch: string;
  role?: string | null;
  points?: number | null;
};

type ApiReward = {
  id: string;
  title: string;
  description?: string | null;
  cost_points: number;
  stock: number;
  image_url?: string | null;
  is_active?: boolean | null;
  sort_order?: number | null;
};

type RewardUI = {
  id: string;
  name: string;
  description?: string | null;
  cost: number;
  stock: number;
  imageUrl: string;
};

type PendingReq = {
  id: string;
  reward_id: string;
  reward_title?: string | null;
  qty?: number | null;
  status: string;
  created_at: string;
};

// ✅ Map: reward title keyword -> local image
const rewardImages: Record<string, string> = {
  "กระเป๋าภารกิจคนอาสา": bagImg,
  "แก้วน้ำคนรวย": richGlassImg,
  "พัดลมพลังช้าง": fanImg,
  "ร่มนักสู้แดดฝน": umbrellaImg,
  "หมวกกันแดดสายเท่": hatImg,
};

// ✅ Safe placeholder (no external URL)
const placeholderSvg =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800">
    <rect width="100%" height="100%" fill="#f3f4f6"/>
    <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle"
      font-family="Arial" font-size="36" fill="#9ca3af">
      NO IMAGE
    </text>
  </svg>
`);

const getLocalRewardImage = (title: string): string | null => {
  if (!title) return null;
  // match by "includes" so you don't need exact full title
  const hit = Object.entries(rewardImages).find(([key]) => title.includes(key));
  return hit?.[1] ?? null;
};

export const Rewards: React.FC = () => {
  const navigate = useNavigate();

  const [me, setMe] = useState<AuthVolunteer | null>(() => {
    try {
      const raw = localStorage.getItem("auth_volunteer");
      return raw ? (JSON.parse(raw) as AuthVolunteer) : null;
    } catch {
      return null;
    }
  });

  const token = useMemo(() => localStorage.getItem("auth_token") || "", []);

  const [rewards, setRewards] = useState<RewardUI[]>([]);
  const [currentPoints, setCurrentPoints] = useState<number>(() =>
    Number(me?.points ?? 0)
  );

  const [pendingRequests, setPendingRequests] = useState<PendingReq[]>([]);
  const [successMsg, setSuccessMsg] = useState("");

  // Loading / error UI state
  const [pageLoading, setPageLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  // Modal State
  const [selectedReward, setSelectedReward] = useState<RewardUI | null>(null);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [redeemLoading, setRedeemLoading] = useState(false);

  const normalizePhone = (s: string) => s.replace(/\s+/g, "").trim();

  // ✅ ดึงแต้มจริงจาก DB แล้ว sync กลับไป localStorage
  const refreshPointsFromDb = async (overrideMe?: AuthVolunteer | null) => {
    try {
      const who = overrideMe ?? me;
      const code = String(who?.volunteer_code ?? "").trim().toUpperCase();
      if (!code) return;

      const latest = await fetchVolunteerPointsByCode(code);
      const pts = Number((latest as any)?.points ?? 0);

      setCurrentPoints(pts);

      // sync auth_volunteer ให้หน้าอื่นๆใช้ค่าล่าสุด
      try {
        const raw = localStorage.getItem("auth_volunteer");
        const v = raw ? (JSON.parse(raw) as AuthVolunteer) : null;
        if (v) {
          const next = { ...v, points: pts };
          localStorage.setItem("auth_volunteer", JSON.stringify(next));
          setMe(next);
        }
      } catch {
        // ignore
      }
    } catch {
      // ถ้าดึงไม่ได้ก็ไม่ให้พัง ใช้ค่าเดิมไปก่อน
    }
  };

  // -------------------------
  // Guard: must login
  // -------------------------
  useEffect(() => {
    if (!token || !me?.id) {
      navigate("/", { replace: true });
    }
  }, [token, me?.id, navigate]);

  // -------------------------
  // Load rewards + pending + points(DB)
  // -------------------------
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        setPageLoading(true);
        setLoadError("");

        // 0) refresh points from DB (ก่อน) เพื่อให้ UI บนสุดตรง
        await refreshPointsFromDb();

        // 1) rewards list
        const r1 = await fetch("/api/rewards/list", {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });

        const d1 = await r1.json().catch(() => ({}));
        if (!r1.ok) throw new Error(d1?.error || "โหลดรายการของรางวัลไม่สำเร็จ");

        const mapped: RewardUI[] = (d1?.rewards || []).map((x: ApiReward) => {
          const localImg = getLocalRewardImage(x.title);
          return {
            id: x.id,
            name: x.title,
            description: x.description ?? null,
            cost: Number(x.cost_points ?? 0),
            stock: Number(x.stock ?? 0),
            // ✅ Priority: local image > DB image_url > placeholder
            imageUrl: localImg || x.image_url || placeholderSvg,
          };
        });

        // 2) pending requests
        let pending: PendingReq[] = [];
        try {
          const r2 = await fetch("/api/rewards/myRequests", {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
          });

          const d2 = await r2.json().catch(() => ({}));
          if (r2.ok) {
            pending = (d2?.requests || []).filter(
              (x: PendingReq) => x.status === "PENDING"
            );
          }
        } catch {
          pending = [];
        }

        if (cancelled) return;

        setRewards(mapped);
        setPendingRequests(pending);

        // 3) refresh points from DB (หลัง)
        await refreshPointsFromDb();
      } catch (e: any) {
        if (!cancelled) setLoadError(e?.message ?? "โหลดข้อมูลไม่สำเร็จ");
      } finally {
        if (!cancelled) setPageLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // pending map: ป้องกันแลกซ้ำ “ของชิ้นเดียวกัน” ระหว่างรออนุมัติ
  const pendingMap = useMemo(() => {
    const set = new Set<string>();
    pendingRequests.forEach((p) => set.add(p.reward_id));
    return set;
  }, [pendingRequests]);

  const initiateRedeem = (reward: RewardUI) => {
    if (reward.stock <= 0) {
      alert("ของรางวัลหมด");
      return;
    }
    if (currentPoints < reward.cost) {
      alert("คะแนนของคุณไม่เพียงพอ");
      return;
    }
    if (pendingMap.has(reward.id)) {
      alert("ของรางวัลชิ้นนี้มีคำขอค้างอยู่แล้ว");
      return;
    }

    setSelectedReward(reward);
    setPhoneNumber("");
  };

  const confirmRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReward) return;

    const phone = normalizePhone(phoneNumber);
    if (!phone) {
      alert("กรุณากรอกเบอร์โทรศัพท์");
      return;
    }

    if (redeemLoading) return;
    setRedeemLoading(true);

    try {
      const r = await fetch("/api/rewards/redeem", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          reward_id: selectedReward.id,
          qty: 1,
          phone_number: phone,
        }),
      });

      const data = await r.json().catch(() => ({}));

      if (!r.ok) {
        throw new Error(data?.error || "แลกของรางวัลไม่สำเร็จ");
      }

      // ✅ หลังแลก: ให้ยึดแต้มจริงจาก DB (กันไม่ตรง)
      await refreshPointsFromDb();

      // เพิ่ม pending list ทันที
      const reqId = data?.request?.id || data?.request_id || "req_" + Date.now();
      const createdAt = data?.request?.created_at || new Date().toISOString();

      setPendingRequests((prev) => [
        {
          id: reqId,
          reward_id: selectedReward.id,
          reward_title: selectedReward.name,
          status: "PENDING",
          created_at: createdAt,
        },
        ...prev,
      ]);

      setSuccessMsg(`ส่งคำขอแลก "${selectedReward.name}" แล้ว!`);
      setSelectedReward(null);

      window.scrollTo({ top: 0, behavior: "smooth" });
      window.setTimeout(() => setSuccessMsg(""), 4000);

      // refresh rewards stock — โหลดใหม่แบบเบาๆ
      try {
        const r1 = await fetch("/api/rewards/list");
        const d1 = await r1.json().catch(() => ({}));
        if (r1.ok) {
          const mapped: RewardUI[] = (d1?.rewards || []).map((x: ApiReward) => {
            const localImg = getLocalRewardImage(x.title);
            return {
              id: x.id,
              name: x.title,
              description: x.description ?? null,
              cost: Number(x.cost_points ?? 0),
              stock: Number(x.stock ?? 0),
              imageUrl: localImg || x.image_url || placeholderSvg,
            };
          });
          setRewards(mapped);
        }
      } catch {
        // ignore
      }
    } catch (err: any) {
      alert(err?.message || "เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setRedeemLoading(false);
    }
  };

  // =========================
  // UI: Loading / Error
  // =========================
  if (pageLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="animate-spin inline-block" />
          <div className="text-gray-700 font-semibold">Loading...</div>
          <div className="text-gray-400 text-sm">กำลังดึงข้อมูลของรางวัล</div>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-gray-100 shadow-sm rounded-2xl p-6 text-center space-y-3">
          <div className="text-gray-900 font-extrabold text-lg">เกิดข้อผิดพลาด</div>
          <div className="text-gray-600 text-sm">{loadError}</div>

          <button
            onClick={() => navigate("/")}
            className="inline-flex items-center justify-center gap-2 w-full bg-primary text-white font-bold py-3 rounded-xl hover:bg-pink-600 transition"
          >
            <ArrowLeft size={18} /> กลับไปหน้าแรก
          </button>
        </div>
      </div>
    );
  }

  // =========================
  // Main UI
  // =========================
  return (
    <div className="space-y-5 relative">
      {/* Sticky Top Bar */}
      <div className="sticky top-0 z-20 bg-white/85 backdrop-blur border-b border-gray-100 -mx-4 px-4 py-3">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-1.5 text-gray-600 hover:text-primary transition"
          >
            <ArrowLeft size={20} />
            <span className="font-medium">กลับ</span>
          </button>

          <div className="text-right">
            <p className="text-[11px] text-gray-500">คะแนนคงเหลือ (รวม)</p>
            <p className="text-2xl font-extrabold text-pink-500 leading-none">{currentPoints}</p>
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900">ของรางวัลแบ่งปันสุข</h1>
            <p className="text-sm text-gray-500 mt-1">เลือกของรางวัลที่ชอบ แล้วกดยืนยันเพื่อส่งคำขอแลก</p>
          </div>

          <div className="shrink-0 text-right">
            <div className="text-[11px] text-gray-500">ผู้ใช้งาน</div>
            <div className="font-bold text-gray-800">{me?.volunteer_code ?? "-"}</div>
          </div>
        </div>
      </div>

      {/* Success */}
      {successMsg && (
        <div className="bg-green-50 border border-green-200 text-green-800 p-4 rounded-2xl flex items-start gap-2 shadow-sm">
          <CheckCircle className="mt-0.5" size={20} />
          <div className="flex-1">
            <div className="font-semibold">สำเร็จ</div>
            <div className="text-sm opacity-90">{successMsg}</div>
          </div>
        </div>
      )}

      {/* Pending List */}
      {pendingRequests.length > 0 && (
        <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-amber-900 text-sm">รายการรออนุมัติ</h3>
            <span className="text-xs font-bold text-amber-900/80 bg-amber-100 px-2 py-1 rounded-full">
              {pendingRequests.length} รายการ
            </span>
          </div>

          <ul className="text-sm space-y-2 mt-3">
            {pendingRequests.map((req) => {
              const r = rewards.find((rw) => rw.id === req.reward_id);
              const name = r?.name || req.reward_title || "Unknown Reward";
              return (
                <li
                  key={req.id}
                  className="text-amber-900 flex items-center justify-between gap-3 bg-white/60 rounded-xl px-3 py-2"
                >
                  <span className="truncate">• {name}</span>
                  <span className="text-xs opacity-70 shrink-0">
                    {new Date(req.created_at).toLocaleDateString("th-TH")}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Rewards Grid */}
      {rewards.length === 0 ? (
        <div className="text-center py-14 text-gray-400 bg-white rounded-2xl border border-dashed border-gray-200">
          ตอนนี้ยังไม่มีของรางวัล
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {rewards.map((reward) => {
            const isPending = pendingMap.has(reward.id);
            const canAfford = currentPoints >= reward.cost;
            const outOfStock = reward.stock <= 0;

            const buttonText = outOfStock
              ? "สินค้าหมด"
              : !canAfford
              ? "คะแนนไม่พอ"
              : isPending
              ? "รออนุมัติ"
              : "แลกของรางวัล";

            const disabled = !canAfford || outOfStock || isPending;

            return (
              <div
                key={reward.id}
                className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col hover:shadow-md transition"
              >
                <div className="h-48 bg-gray-100 relative">
                  <img
                    src={reward.imageUrl}
                    alt={reward.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />

                  <div className="absolute top-3 left-3 flex gap-2">
                    {isPending && (
                      <span className="text-xs font-bold bg-amber-500 text-white px-2 py-1 rounded-full shadow-sm">
                        รออนุมัติ
                      </span>
                    )}
                    {outOfStock && (
                      <span className="text-xs font-bold bg-gray-700 text-white px-2 py-1 rounded-full shadow-sm">
                        หมด
                      </span>
                    )}
                  </div>

                  <div className="absolute top-3 right-3 bg-black/60 text-white text-xs px-2 py-1 rounded-full backdrop-blur-sm">
                    เหลือ {reward.stock} ชิ้น
                  </div>
                </div>

                <div className="p-4 flex-grow flex flex-col justify-between">
                  <div>
                    <h3 className="font-extrabold text-gray-900 text-lg leading-snug">{reward.name}</h3>
                    {reward.description && (
                      <p className="mt-1 text-xs text-gray-500 line-clamp-2">{reward.description}</p>
                    )}

                    <div className="mt-2 flex items-center justify-between">
                      <div className="text-pink-600 font-extrabold text-xl">
                        {reward.cost} <span className="text-sm font-bold">คะแนน</span>
                      </div>

                      {!canAfford && !outOfStock && (
                        <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                          ขาด {reward.cost - currentPoints}
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => initiateRedeem(reward)}
                    disabled={disabled}
                    className={`mt-4 w-full py-3 rounded-xl font-bold transition ${
                      disabled
                        ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                        : "bg-primary text-white hover:bg-pink-600 shadow-lg shadow-pink-200"
                    }`}
                  >
                    {buttonText}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Phone Number Modal */}
      {selectedReward && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl relative animate-fade-in-up border border-gray-100">
            <button
              onClick={() => setSelectedReward(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <X size={24} />
            </button>

            <div className="mb-5">
              <h3 className="text-xl font-extrabold text-gray-900 mb-1">ยืนยันการแลกรางวัล</h3>
              <p className="text-gray-500 text-sm">
                “{selectedReward.name}” ใช้{" "}
                <span className="font-bold text-pink-600">{selectedReward.cost}</span> คะแนน
              </p>
            </div>

            <form onSubmit={confirmRedeem} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">เบอร์โทรศัพท์</label>
                <div className="relative">
                  <input
                    type="tel"
                    required
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 rounded-2xl border border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary outline-none font-semibold"
                    placeholder="08x-xxx-xxxx"
                  />
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                </div>
              </div>

              <button
                type="submit"
                disabled={redeemLoading}
                className="w-full bg-primary text-white font-extrabold py-3.5 rounded-2xl hover:bg-pink-600 shadow-lg shadow-pink-200 transition disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {redeemLoading ? "กำลังส่งคำขอ..." : "ยืนยันการแลก"}
              </button>

              <button
                type="button"
                onClick={() => setSelectedReward(null)}
                className="w-full bg-white border border-gray-200 text-gray-700 font-bold py-3 rounded-2xl hover:bg-gray-50 transition"
              >
                ยกเลิก
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
