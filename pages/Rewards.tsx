import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle, Phone, X } from "lucide-react";
import { dataService } from "../services/dataService";
import { Volunteer, Reward, RedemptionRequest } from "../types";

export const Rewards: React.FC = () => {
  const { volunteerId } = useParams<{ volunteerId: string }>();
  const navigate = useNavigate();

  const [volunteer, setVolunteer] = useState<Volunteer | null>(null);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [currentPoints, setCurrentPoints] = useState(0);
  const [pendingRequests, setPendingRequests] = useState<RedemptionRequest[]>([]);
  const [successMsg, setSuccessMsg] = useState("");

  // Loading / error UI state (กันค้าง Loading)
  const [pageLoading, setPageLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  // Modal State
  const [selectedReward, setSelectedReward] = useState<Reward | null>(null);
  const [phoneNumber, setPhoneNumber] = useState("");

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        setPageLoading(true);
        setLoadError("");

        if (!volunteerId) {
          if (!cancelled) setLoadError("ไม่พบรหัสผู้ใช้งานในลิงก์ กรุณากลับไปค้นหาใหม่");
          return;
        }

        // ✅ คง dataService เหมือนเดิม แค่ “หาได้ทั้ง id และ empId”
        const allVols = dataService.getVolunteers();
        const v = allVols.find((i) => i.id === volunteerId || i.empId === volunteerId);

        if (!v) {
          if (!cancelled) {
            setVolunteer(null);
            setRewards(dataService.getRewards()); // ให้ยังเห็นรายการของรางวัลได้ (optional)
            setPendingRequests([]);
            setCurrentPoints(0);
            setLoadError("ไม่พบข้อมูลผู้ใช้งาน กรุณากลับไปค้นหาใหม่");
          }
          return;
        }

        if (cancelled) return;

        setVolunteer(v);
        setCurrentPoints(dataService.getVolunteerPoints(v.id));
        setRewards(dataService.getRewards());

        const reqs = dataService
          .getRequests()
          .filter((r) => r.volunteerId === v.id && r.status === "PENDING");
        setPendingRequests(reqs);
      } catch (e: any) {
        if (!cancelled) {
          setLoadError(e?.message ?? "โหลดข้อมูลไม่สำเร็จ");
        }
      } finally {
        if (!cancelled) setPageLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [volunteerId]);

  const pendingMap = useMemo(() => {
    const set = new Set<string>();
    pendingRequests.forEach((p) => set.add(p.rewardId));
    return set;
  }, [pendingRequests]);

  const initiateRedeem = (reward: Reward) => {
    if (currentPoints < reward.cost) {
      alert("คะแนนของคุณไม่เพียงพอ");
      return;
    }
    setSelectedReward(reward);
    setPhoneNumber("");
  };

  const confirmRedeem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!volunteer || !selectedReward) return;

    if (!phoneNumber.trim()) {
      alert("กรุณากรอกเบอร์โทรศัพท์");
      return;
    }

    const newReq: RedemptionRequest = {
      id: "req_" + Date.now(),
      volunteerId: volunteer.id,
      rewardId: selectedReward.id,
      status: "PENDING",
      requestDate: new Date().toISOString(),
      phoneNumber: phoneNumber.trim(),
    };

    // ✅ คงเดิม
    dataService.addRequest(newReq);
    setPendingRequests([...pendingRequests, newReq]);
    setSuccessMsg(`ส่งคำขอแลก "${selectedReward.name}" แล้ว!`);

    setSelectedReward(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
    setTimeout(() => setSuccessMsg(""), 4000);
  };

  // =========================
  // UI: Loading / Error
  // =========================
  if (pageLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center space-y-2">
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
            onClick={() => navigate(-1)}
            className="inline-flex items-center justify-center gap-2 w-full bg-primary text-white font-bold py-3 rounded-xl hover:bg-pink-600 transition"
          >
            <ArrowLeft size={18} /> กลับไปหน้าก่อนหน้า
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
            <div className="font-bold text-gray-800">{volunteer?.empId ?? "-"}</div>
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
              const r = rewards.find((rw) => rw.id === req.rewardId);
              return (
                <li
                  key={req.id}
                  className="text-amber-900 flex items-center justify-between gap-3 bg-white/60 rounded-xl px-3 py-2"
                >
                  <span className="truncate">• {r?.name || "Unknown Reward"}</span>
                  <span className="text-xs opacity-70 shrink-0">
                    {new Date(req.requestDate).toLocaleDateString("th-TH")}
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

            <div className="bg-pink-50 border border-pink-100 rounded-2xl p-4 mb-5">
              <div className="text-sm text-pink-800 font-bold">ข้อมูลติดต่อ</div>
              <div className="text-xs text-pink-800/80 mt-1">
                กรอกเบอร์โทร เพื่อให้ทีมงานติดต่อส่งมอบของรางวัล
              </div>
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
                className="w-full bg-primary text-white font-extrabold py-3.5 rounded-2xl hover:bg-pink-600 shadow-lg shadow-pink-200 transition"
              >
                ยืนยันการแลก
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
