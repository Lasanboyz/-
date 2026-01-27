// pages/Home.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, User, Gift, Trophy, Loader2, LogOut } from "lucide-react";
import { fetchVolunteerByCode, mapVolunteerRowToVolunteer } from "../services/dataService";
import PinLogin from "../components/PinLogin";

// ✅ type สำหรับข้อมูลที่ได้จาก /api/auth/loginPin
type AuthVolunteer = {
  id: string;
  volunteer_code: string;
  name: string;
  branch: string;
  role?: string | null;
  points?: number | null;
};

// ✅ กันชน: ไม่ผูกกับ types/Volunteer ที่อาจไม่ตรง schema ในโปรเจกต์
type VolunteerLite = {
  empId: string;
  type: string;
  [k: string]: any;
};

export const Home: React.FC = () => {
  const navigate = useNavigate();
  const searchInputRef = useRef<HTMLInputElement>(null);

  // ✅ Auth state (อ่านจาก localStorage)
  const [me, setMe] = useState<AuthVolunteer | null>(() => {
    try {
      const raw = localStorage.getItem("auth_volunteer");
      return raw ? (JSON.parse(raw) as AuthVolunteer) : null;
    } catch {
      return null;
    }
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [result, setResult] = useState<VolunteerLite | null>(null);

  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // UI toast
  const [toast, setToast] = useState<string>("");
  const [logoFailed, setLogoFailed] = useState(false);

  const trimmed = useMemo(() => searchTerm.trim(), [searchTerm]);

  // ✅ logout
  const logout = () => {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_volunteer");
    setMe(null);
    setSearchTerm("");
    setResult(null);
    setLoading(false);
    setNotFound(false);
    setErrorMsg(null);
  };

  // ✅ Debounce search (ยิง supabase เมื่อ login แล้วเท่านั้น)
  useEffect(() => {
    if (!me) return;

    const term = searchTerm.trim();

    if (term.length < 2) {
      setResult(null);
      setLoading(false);
      setNotFound(false);
      setErrorMsg(null);
      return;
    }

    let cancelled = false;

    const timer = setTimeout(async () => {
      try {
        setLoading(true);
        setErrorMsg(null);
        setNotFound(false);

        const normalized = term.replace(/\s+/g, "").toUpperCase();

        const data = await fetchVolunteerByCode(normalized);
        if (cancelled) return;

        if (!data) {
          setResult(null);
          setNotFound(true);
          return;
        }

        // ✅ map จาก dataService (กัน schema เปลี่ยน)
        const mapped = mapVolunteerRowToVolunteer(data) as any;

        // ✅ กันพัง ถ้า mapped ไม่มี field ที่หน้า Home ใช้
        const lite: VolunteerLite = {
          empId: mapped.empId ?? mapped.volunteer_code ?? normalized,
          type: mapped.type ?? mapped.branch ?? "-",
          ...mapped,
        };

        setResult(lite);
        setNotFound(false);
      } catch (err: any) {
        if (cancelled) return;
        console.error("fetchVolunteerByCode error:", err);
        setResult(null);
        setNotFound(false);
        setErrorMsg(err?.message ?? "เกิดข้อผิดพลาดในการค้นหา");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchTerm, me]);

  const goToProfile = (empId: string) => {
    navigate(`/profile/${empId}`);
  };

  const handleRedeemClick = () => {
    if (!me) {
      setToast("กรุณาเข้าสู่ระบบก่อน เพื่อใช้งานการแลกของรางวัล");
      window.setTimeout(() => setToast(""), 3500);
      return;
    }

    searchInputRef.current?.focus();
    searchInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    setToast("กรุณาค้นหารหัสพนักงานของคุณก่อน เพื่อเข้าสู่ระบบแลกของรางวัล");
    window.setTimeout(() => setToast(""), 3500);
  };

  const clearSearch = () => {
    setSearchTerm("");
    setResult(null);
    setLoading(false);
    setNotFound(false);
    setErrorMsg(null);
    searchInputRef.current?.focus();
  };

  // ✅ ถ้ายังไม่ login → ให้แสดง PinLogin ก่อน
  if (!me) {
    return <PinLogin onSuccess={(v: any) => setMe(v as AuthVolunteer)} />;
  }

  return (
    <div className="relative">
      {/* soft background */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-pink-50 via-rose-50/40 to-white" />

      {/* top bar (mini) */}
      <div className="w-full max-w-5xl mx-auto px-4 pt-4">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            สวัสดี, <span className="font-semibold text-gray-800">{me.name}</span>{" "}
            <span className="text-gray-400">({me.branch})</span>
          </div>
          <button
            onClick={logout}
            className="inline-flex items-center gap-2 text-sm px-3 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition"
          >
            <LogOut size={16} />
            ออกจากระบบ
          </button>
        </div>
      </div>

      {/* toast */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50">
          <div className="bg-white/95 backdrop-blur border border-pink-100 shadow-lg rounded-full px-4 py-2 text-sm text-gray-700 flex items-center gap-2">
            <span className="text-pink-500">💗</span>
            <span className="font-medium">{toast}</span>
          </div>
        </div>
      )}

      <div className="flex flex-col items-center justify-center min-h-[75vh] space-y-10 pb-10 px-4">
        {/* Header */}
        <div className="text-center space-y-4 flex flex-col items-center">
          <div className="relative">
            <div className="inline-flex items-center justify-center bg-white rounded-[28px] shadow-xl border border-pink-50 min-w-[120px] min-h-[120px] px-6">
              {!logoFailed ? (
                <img
                  src="/logo.png"
                  alt="Logo"
                  className="h-24 w-auto object-contain"
                  onError={() => setLogoFailed(true)}
                />
              ) : (
                <div className="text-[64px] leading-none">💗</div>
              )}
            </div>
            <div className="absolute -inset-6 -z-10 bg-pink-200/20 blur-2xl rounded-full" />
          </div>

          <h1 className="text-5xl md:text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-rose-400 drop-shadow-sm">
            อาสาชีวิต
            <br className="md:hidden" />
            หมุนต่อได้
          </h1>

          <p className="text-base md:text-lg text-gray-500 font-medium max-w-lg mx-auto">
            แพลตฟอร์มสะสมความดี แลกรับความสุขของชาวอาสา
          </p>
        </div>

        {/* Search Box */}
        <div className="w-full max-w-md relative z-20">
          <div className="relative group">
            <input
              ref={searchInputRef}
              type="text"
              placeholder="ค้นหารหัสพนักงาน..."
              className="w-full pl-14 pr-12 py-5 rounded-full border-2 border-pink-100 bg-white/90 backdrop-blur focus:bg-white focus:border-pink-500 focus:ring-4 focus:ring-pink-100 shadow-lg text-lg outline-none transition"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              inputMode="text"
              autoCapitalize="characters"
              autoCorrect="off"
            />

            <div className="absolute left-5 top-1/2 -translate-y-1/2">
              <div className="w-10 h-10 rounded-full bg-pink-50 flex items-center justify-center border border-pink-100">
                <Search className="text-pink-400" size={20} />
              </div>
            </div>

            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              {loading ? (
                <Loader2 className="animate-spin text-pink-400" size={22} />
              ) : trimmed.length > 0 ? (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="w-9 h-9 rounded-full border border-gray-200 bg-white hover:bg-gray-50 text-gray-500 flex items-center justify-center transition"
                  aria-label="Clear search"
                >
                  ✕
                </button>
              ) : null}
            </div>
          </div>

          {/* Result dropdown */}
          {result && (
            <div className="absolute top-full left-0 right-0 mt-3 bg-white rounded-2xl shadow-xl border border-pink-100 overflow-hidden z-30">
              <button
                onClick={() => goToProfile(result.empId)}
                className="w-full px-5 py-4 text-left hover:bg-pink-50 flex items-center gap-4 transition"
              >
                <div className="bg-pink-100 p-3 rounded-full text-pink-500">
                  <User size={24} />
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-gray-800 text-lg font-mono truncate">
                    รหัส: {result.empId}
                  </div>
                  <div className="text-sm text-gray-500 truncate">สังกัด: {result.type}</div>
                </div>

                <div className="ml-auto text-xs font-bold text-pink-600 bg-pink-50 border border-pink-100 px-3 py-1 rounded-full">
                  ดูโปรไฟล์
                </div>
              </button>
            </div>
          )}

          {/* Messages */}
          {errorMsg && (
            <div className="text-center mt-4 text-red-600 bg-white/70 py-2 rounded-xl border border-red-100">
              {errorMsg}
            </div>
          )}

          {!errorMsg && notFound && trimmed.length >= 2 && (
            <div className="text-center mt-4 text-gray-500 bg-white/70 py-2 rounded-xl border border-gray-100">
              ไม่พบรหัสพนักงาน
            </div>
          )}

          <div className="text-center mt-3 text-xs text-gray-400">* ระบบจะค้นหาให้อัตโนมัติ</div>
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-2 gap-6 w-full max-w-lg mt-2">
          <button
            onClick={handleRedeemClick}
            className="bg-white/90 backdrop-blur p-6 rounded-3xl shadow-md hover:shadow-xl transition flex flex-col items-center border border-pink-50 active:scale-[0.99]"
          >
            <div className="w-12 h-12 rounded-2xl bg-pink-50 border border-pink-100 flex items-center justify-center mb-3">
              <Gift className="text-pink-500 w-7 h-7" />
            </div>
            <h3 className="font-extrabold text-gray-800">แลกของรางวัล</h3>
            <p className="text-xs text-gray-500 mt-1">ค้นหารหัสก่อนเพื่อเข้าใช้งาน</p>
          </button>

          <button
            onClick={() => navigate("/leaderboard")}
            className="bg-white/90 backdrop-blur p-6 rounded-3xl shadow-md hover:shadow-xl transition flex flex-col items-center border border-pink-50 active:scale-[0.99]"
          >
            <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center mb-3">
              <Trophy className="text-yellow-600 w-7 h-7" />
            </div>
            <h3 className="font-extrabold text-gray-800">เช็กระดับอาสา</h3>
            <p className="text-xs text-gray-500 mt-1">ดูอันดับและระดับประจำปี</p>
          </button>
        </div>
      </div>
    </div>
  );
};
