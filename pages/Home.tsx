import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, User, Gift, Trophy, Loader2 } from "lucide-react";
import { fetchVolunteerByCode } from "../services/dataService";
import type { Volunteer } from "../types";

export const Home: React.FC = () => {
  const navigate = useNavigate();
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [result, setResult] = useState<Volunteer | null>(null);

  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // ✅ Debounce (กันยิง Supabase ทุกตัวอักษร)
  useEffect(() => {
    const term = searchTerm.trim();

    // เคลียร์สถานะเมื่อยังไม่พิมพ์/พิมพ์น้อยเกิน
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

        const data = await fetchVolunteerByCode(term);

        if (cancelled) return;

        if (!data) {
          setResult(null);
          setNotFound(true);
          return;
        }

        const mapped: Volunteer = {
          id: data.id, // uuid
          empId: data.volunteer_code, // volunteer_code
          type: data.branch ?? "",
        };

        setResult(mapped);
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
    }, 350); // 350ms debounce

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchTerm]);

  const goToProfile = (empId: string) => {
    // ✅ route ใหม่: /profile/:id  และ id = volunteer_code
    navigate(`/profile/${empId}`);
  };

  const handleRedeemClick = () => {
    if (!searchInputRef.current) return;
    searchInputRef.current.focus();
    searchInputRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    alert("กรุณาค้นหารหัสพนักงานของคุณเพื่อเข้าสู่ระบบแลกของรางวัล");
  };

  const clearSearch = () => {
    setSearchTerm("");
    setResult(null);
    setLoading(false);
    setNotFound(false);
    setErrorMsg(null);
    searchInputRef.current?.focus();
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] space-y-10 pb-10">
      {/* Header */}
      <div className="text-center space-y-4 flex flex-col items-center">
        <div className="inline-flex items-center justify-center p-6 bg-white rounded-3xl shadow-xl mb-2 border border-pink-50 min-w-[120px] min-h-[120px]">
          <img
            src="/logo.png"
            alt="Logo"
            className="h-28 w-auto object-contain"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        </div>

        <h1 className="text-5xl md:text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-rose-400">
          อาสาชีวิต<br className="md:hidden" />
          หมุนต่อได้
        </h1>

        <p className="text-lg text-gray-500 font-medium max-w-lg mx-auto">
          แพลตฟอร์มสะสมความดี แลกรับความสุข
        </p>
      </div>

      {/* Search Box */}
      <div className="w-full max-w-md relative z-20">
        <div className="relative group">
          <input
            ref={searchInputRef}
            type="text"
            placeholder="ค้นหารหัสพนักงาน..."
            className="w-full pl-14 pr-12 py-5 rounded-full border-2 border-pink-100 bg-white focus:border-pink-500 focus:ring-4 focus:ring-pink-100 shadow-lg text-lg outline-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            inputMode="text"
            autoCapitalize="characters"
            autoCorrect="off"
          />
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-pink-300" size={28} />

          {/* Right icon (loading / clear) */}
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            {loading ? (
              <Loader2 className="animate-spin text-pink-400" size={22} />
            ) : searchTerm.trim().length > 0 ? (
              <button
                type="button"
                onClick={clearSearch}
                className="text-gray-400 hover:text-gray-600"
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
              <div>
                <div className="font-bold text-gray-800 text-lg font-mono">
                  รหัส: {result.empId}
                </div>
                <div className="text-sm text-gray-500">สังกัด: {result.type}</div>
              </div>
            </button>
          </div>
        )}

        {/* Messages */}
        {errorMsg && (
          <div className="text-center mt-4 text-red-500 bg-white/70 py-2 rounded-lg">
            {errorMsg}
          </div>
        )}

        {!errorMsg && notFound && searchTerm.trim().length >= 2 && (
          <div className="text-center mt-4 text-gray-400 bg-white/50 py-2 rounded-lg">
            ไม่พบรหัสพนักงาน
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="grid grid-cols-2 gap-6 w-full max-w-lg mt-4">
        <button
          onClick={handleRedeemClick}
          className="bg-white p-6 rounded-3xl shadow-md hover:shadow-xl transition flex flex-col items-center"
        >
          <Gift className="text-pink-500 w-8 h-8 mb-2" />
          <h3 className="font-bold text-gray-700">แลกของรางวัล</h3>
        </button>

        <button
          onClick={() => navigate("/leaderboard")}
          className="bg-white p-6 rounded-3xl shadow-md hover:shadow-xl transition flex flex-col items-center"
        >
          <Trophy className="text-yellow-600 w-8 h-8 mb-2" />
          <h3 className="font-bold text-gray-700">เช็กระดับอาสา</h3>
        </button>
      </div>
    </div>
  );
};
