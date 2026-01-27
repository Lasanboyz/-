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
    <div className="min-h-[75vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="bg-white/90 backdrop-blur rounded-3xl border border-pink-100 shadow-xl p-6 md:p-8">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-pink-50 border border-pink-100 flex items-center justify-center">
              <Lock className="text-pink-500" />
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-extrabold text-gray-800">เข้าสู่ระบบอาสา</h2>
              <p className="text-sm text-gray-500">เพื่อดูโปรไฟล์ คะแนน และแลกของรางวัล</p>
            </div>
          </div>

          {/* Inputs */}
          <div className="space-y-4">
            <div>
              <label className="text-sm font-semibold text-gray-700">ใส่รหัสพนักงาน</label>
              <div className="relative mt-2">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                  <IdCard size={18} />
                </span>
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder="เช่น 80010301 หรือ CF123456"
                  className="w-full pl-11 pr-4 py-3 rounded-2xl border-2 border-pink-100 bg-white focus:border-pink-500 focus:ring-4 focus:ring-pink-100 outline-none transition"
                  inputMode="text"
                  autoCapitalize="characters"
                  autoCorrect="off"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-700">PIN 4 หลัก</label>
              <div className="relative mt-2">
                <input
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder="กรอก PIN 4 หลัก"
                  type={showPin ? "text" : "password"}
                  className="w-full pl-4 pr-12 py-3 rounded-2xl border-2 border-pink-100 bg-white focus:border-pink-500 focus:ring-4 focus:ring-pink-100 outline-none transition"
                  inputMode="numeric"
                  maxLength={4}
                />
                <button
                  type="button"
                  onClick={() => setShowPin((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-500 flex items-center justify-center transition"
                  aria-label="Toggle PIN"
                >
                  {showPin ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              {/* Note */}
              <div className="mt-2 text-xs text-gray-500 leading-relaxed">
                <span className="font-semibold text-gray-700">หมายเหตุ:</span>{" "}
                PIN จะตั้งได้ <span className="font-semibold">ครั้งแรกเท่านั้น</span>. หากยังไม่มี PIN หรือ
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
              className="w-full py-3 rounded-2xl font-extrabold text-white bg-gradient-to-r from-pink-500 to-rose-400 shadow-lg hover:shadow-xl active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed transition"
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
  );
}
