// components/PinLogin.tsx
import { useMemo, useState } from "react";
import type { KeyboardEvent } from "react";
import { Eye, EyeOff, Lock, IdCard } from "lucide-react";

export default function PinLogin({ onSuccess }: { onSuccess: (data: any) => void }) {
  const [code, setCode] = useState("");
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const canSubmit = useMemo(() => {
    const c = code.trim();
    const p = pin.trim();
    return c.length >= 2 && /^\d{4}$/.test(p);
  }, [code, pin]);

  const login = async () => {
    if (loading) return;
    setError("");
    setLoading(true);

    try {
      const r = await fetch("/api/auth/loginPin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          volunteer_code: code.trim().replace(/\s+/g, "").toUpperCase(),
          pin: pin.trim(),
        }),
      });

      const data = await r.json().catch(() => ({}));

      if (!r.ok) {
        setError(data?.error || "เข้าสู่ระบบไม่สำเร็จ");
        return;
      }

      localStorage.setItem("auth_token", data.token);
      localStorage.setItem("auth_volunteer", JSON.stringify(data.volunteer));
      onSuccess(data.volunteer);
    } catch (e: any) {
      setError(e?.message || "เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setLoading(false);
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") login();
  };

  return (
    <div className="min-h-[100dvh] w-full relative overflow-hidden">
      {/* Soft background (mobile friendly) */}
      <div className="absolute inset-0 bg-gradient-to-b from-pink-50 via-rose-50 to-white" />
      <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-pink-200/40 blur-3xl" />
      <div className="absolute -bottom-28 -right-24 w-80 h-80 rounded-full bg-rose-200/40 blur-3xl" />

      {/* Content */}
      <div className="relative z-10 px-4 pt-10 pb-8 sm:pt-14">
        <div className="mx-auto w-full max-w-sm sm:max-w-md">
          {/* Card */}
          <div className="bg-white/85 backdrop-blur-xl rounded-[28px] border border-pink-100 shadow-[0_12px_40px_rgba(236,72,153,0.12)] p-5 sm:p-7">
            {/* Header */}
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-pink-50 to-rose-50 border border-pink-100 flex items-center justify-center shadow-sm">
                <Lock className="text-pink-500" />
              </div>

              <div className="min-w-0">
                <h2 className="text-[20px] sm:text-2xl font-extrabold text-gray-800 leading-tight">
                  เข้าสู่ระบบอาสา
                </h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  เพื่อดูโปรไฟล์ คะแนน และแลกของรางวัล
                </p>
              </div>
            </div>

            {/* Inputs */}
            <div className="mt-6 space-y-4">
              {/* Code */}
              <div>
                <label className="text-sm font-semibold text-gray-700">รหัสพนักงาน</label>
                <div className="relative mt-2">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                    <IdCard size={18} />
                  </span>
                  <input
                    value={code}
                    onChange={(e) => {
                      // mobile friendly: clean spaces + uppercase while typing
                      const v = e.target.value.replace(/\s+/g, "").toUpperCase();
                      setCode(v);
                    }}
                    onKeyDown={onKeyDown}
                    placeholder="เช่น 80010301 หรือ CF123456"
                    className="w-full pl-11 pr-4 py-3.5 rounded-2xl border-2 border-pink-100 bg-white
                               focus:border-pink-500 focus:ring-4 focus:ring-pink-100 outline-none transition
                               text-[15px] sm:text-base"
                    inputMode="text"
                    autoCapitalize="characters"
                    autoCorrect="off"
                  />
                </div>
                <div className="mt-2 text-xs text-gray-400">
                  รองรับทั้งเลขล้วน และรหัสขึ้นต้นด้วยตัวอักษร (เช่น CF)
                </div>
              </div>

              {/* PIN */}
              <div>
                <label className="text-sm font-semibold text-gray-700">PIN 4 หลัก</label>
                <div className="relative mt-2">
                  <input
                    value={pin}
                    onChange={(e) => {
                      // keep only digits, max 4
                      const v = e.target.value.replace(/\D/g, "").slice(0, 4);
                      setPin(v);
                    }}
                    onKeyDown={onKeyDown}
                    placeholder="กรอก PIN 4 หลัก"
                    type={showPin ? "text" : "password"}
                    className="w-full pl-4 pr-12 py-3.5 rounded-2xl border-2 border-pink-100 bg-white
                               focus:border-pink-500 focus:ring-4 focus:ring-pink-100 outline-none transition
                               text-[15px] sm:text-base tracking-widest"
                    inputMode="numeric"
                    maxLength={4}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl
                               border border-gray-200 bg-white hover:bg-gray-50 text-gray-500
                               flex items-center justify-center transition active:scale-[0.98]"
                    aria-label="Toggle PIN"
                  >
                    {showPin ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>

                {/* Note */}
                <div className="mt-3 rounded-2xl border border-pink-100 bg-pink-50/40 px-4 py-3 text-xs text-gray-600 leading-relaxed">
                  <span className="font-semibold text-gray-700">หมายเหตุ:</span>{" "}
                  PIN ตั้งได้ <span className="font-semibold">ครั้งแรกเท่านั้น</span> หากยังไม่มี PIN หรือ
                  ลืม PIN ให้ติดต่อผู้ดูแล/ทีมงานเพื่อรีเซ็ตให้
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              {/* Button */}
              <button
                onClick={login}
                disabled={!canSubmit || loading}
                className="w-full py-3.5 rounded-2xl font-extrabold text-white
                           bg-gradient-to-r from-pink-500 to-rose-400
                           shadow-[0_10px_24px_rgba(236,72,153,0.25)]
                           hover:shadow-[0_12px_30px_rgba(236,72,153,0.30)]
                           active:scale-[0.99]
                           disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
              </button>

              <div className="text-center text-xs text-gray-400">
                กด <span className="font-semibold">Enter</span> เพื่อเข้าสู่ระบบได้
              </div>
            </div>
          </div>

          {/* Footer hint */}
          <div className="text-center mt-4 text-xs text-gray-400">
            เพื่อความปลอดภัย กรุณาไม่บอกรหัส PIN ให้ผู้อื่น
          </div>
        </div>
      </div>
    </div>
  );
}
