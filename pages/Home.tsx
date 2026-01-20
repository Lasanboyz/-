import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, User, Gift, Trophy } from 'lucide-react';
import { dataService } from '../services/dataService';
import { Volunteer } from '../types';

export const Home: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [results, setResults] = useState<Volunteer[]>([]);
  const navigate = useNavigate();
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setVolunteers(dataService.getVolunteers());
  }, []);

  useEffect(() => {
    if (searchTerm.trim() === '') {
      setResults([]);
      return;
    }
    const lowerTerm = searchTerm.toLowerCase();
    // Search ONLY by empId
    const filtered = volunteers.filter(
      v => v.empId.toLowerCase().includes(lowerTerm)
    );
    setResults(filtered);
  }, [searchTerm, volunteers]);

  const handleRedeemClick = () => {
    if (searchInputRef.current) {
        searchInputRef.current.focus();
        searchInputRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        alert("กรุณาค้นหารหัสพนักงานของคุณเพื่อเข้าสู่ระบบแลกของรางวัล");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] space-y-10 pb-10">
      
      {/* Big Title Section */}
      <div className="text-center space-y-4 animate-fade-in-up flex flex-col items-center">
        {/* Logo Container */}
        <div className="inline-flex items-center justify-center p-6 bg-white rounded-3xl shadow-xl mb-2 border border-pink-50 min-w-[120px] min-h-[120px]">
             <img 
                src="/logo.png" 
                alt="Logo" 
                className="h-28 w-auto object-contain"
                style={{
                    filter: 'brightness(0) saturate(100%) invert(39%) sepia(35%) saturate(1682%) hue-rotate(303deg) brightness(96%) contrast(91%)'
                }}
                onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    const fallback = document.getElementById('logo-fallback');
                    if (fallback) fallback.classList.remove('hidden');
                }}
             />
             <span id="logo-fallback" className="hidden text-6xl">💖</span>
        </div>
        
        <h1 className="text-5xl md:text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-rose-400 drop-shadow-sm leading-tight py-2">
          อาสาชีวิต<br className="md:hidden"/>หมุนต่อได้
        </h1>
        <p className="text-lg text-gray-500 font-medium max-w-lg mx-auto">
            แพลตฟอร์มสะสมความดี แลกรับความสุข<br/>สำหรับพนักงานใจอาสาทุกคน
        </p>
      </div>

      {/* Search Section */}
      <div className="w-full max-w-md relative z-20">
        <div className="relative group">
          <input
            ref={searchInputRef}
            type="text"
            placeholder="ค้นหารหัสพนักงาน..."
            className="w-full pl-14 pr-4 py-5 rounded-full border-2 border-pink-100 bg-white focus:border-primary focus:ring-4 focus:ring-pink-100 transition shadow-lg text-lg outline-none placeholder-gray-300 text-gray-700"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-pink-300 group-focus-within:text-primary transition" size={28} />
        </div>

        {results.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-3 bg-white rounded-2xl shadow-xl border border-pink-100 overflow-hidden z-30 max-h-80 overflow-y-auto">
            {results.map(volunteer => (
              <button
                key={volunteer.id}
                onClick={() => navigate(`/profile/${volunteer.id}`)}
                className="w-full px-5 py-4 text-left hover:bg-pink-50 flex items-center gap-4 transition border-b border-gray-50 last:border-0"
              >
                <div className="bg-pink-100 p-3 rounded-full text-pink-500">
                    <User size={24} />
                </div>
                <div>
                  <div className="font-bold text-gray-800 text-lg font-mono">รหัส: {volunteer.empId}</div>
                  <div className="text-sm text-gray-500">
                    {volunteer.type}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
        
        {searchTerm.length > 1 && results.length === 0 && (
           <div className="text-center mt-4 text-gray-400 bg-white/50 py-2 rounded-lg">
             ไม่พบรหัสพนักงานที่ค้นหา
           </div>
        )}
      </div>

      {/* Menu Grid */}
      <div className="grid grid-cols-2 gap-6 w-full max-w-lg mt-4">
        <button 
            onClick={handleRedeemClick}
            className="bg-white p-6 rounded-3xl shadow-md border-2 border-transparent hover:border-pink-200 hover:shadow-xl transition transform hover:-translate-y-1 flex flex-col items-center justify-center group"
        >
            <div className="bg-pink-100 p-4 rounded-full mb-3 group-hover:bg-pink-200 transition">
                <Gift className="text-pink-500 w-8 h-8" />
            </div>
            <h3 className="font-bold text-gray-700 text-lg">แลกของรางวัล</h3>
            <p className="text-xs text-gray-400 mt-1">ค้นหาเพื่อแลก</p>
        </button>

        <button 
            onClick={() => navigate('/leaderboard')}
            className="bg-white p-6 rounded-3xl shadow-md border-2 border-transparent hover:border-yellow-200 hover:shadow-xl transition transform hover:-translate-y-1 flex flex-col items-center justify-center group"
        >
            <div className="bg-yellow-100 p-4 rounded-full mb-3 group-hover:bg-yellow-200 transition">
                <Trophy className="text-yellow-600 w-8 h-8" />
            </div>
            <h3 className="font-bold text-gray-700 text-lg">เช็กระดับอาสา</h3>
            <p className="text-xs text-gray-400 mt-1">ดูอันดับ</p>
        </button>
      </div>
    </div>
  );
};