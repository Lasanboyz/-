import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Trophy, Medal } from 'lucide-react';
import { dataService } from '../services/dataService';
import { Volunteer, RankConfig } from '../types';

interface LeaderboardItem {
  volunteer: Volunteer;
  points: number;
  rank: RankConfig;
}

export const Leaderboard: React.FC = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<LeaderboardItem[]>([]);
  const targetYear = 2569; // 2026 AD

  useEffect(() => {
    const volunteers = dataService.getVolunteers();
    
    const calculated = volunteers.map(vol => {
      // Calculate points specifically for 2569
      const points = dataService.getVolunteerPoints(vol.id, targetYear);
      return {
        volunteer: vol,
        points: points,
        rank: dataService.getRank(points)
      };
    });

    // Sort by points desc
    calculated.sort((a, b) => b.points - a.points);
    setItems(calculated);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-2">
        <button onClick={() => navigate(-1)} className="p-2 bg-white rounded-full text-gray-500 hover:text-primary shadow-sm">
          <ArrowLeft size={20} />
        </button>
        <div>
            <h1 className="text-2xl font-bold text-gray-800">จัดอันดับอาสา</h1>
            <p className="text-xs text-gray-500">ประจำปี {targetYear} (2026)</p>
        </div>
      </div>

      <div className="bg-gradient-to-br from-pink-500 to-rose-400 rounded-3xl p-6 text-white shadow-lg text-center relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-20">
             <Trophy size={140} />
        </div>
        <h2 className="text-xl font-bold relative z-10">สุดยอดอาสาแห่งปี {targetYear}</h2>
        <p className="text-pink-100 text-sm relative z-10 mt-1">ใครแต้มเยอะสุดอยู่บนสุด!</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-pink-100 overflow-hidden">
         {items.length === 0 ? (
             <div className="p-8 text-center text-gray-400">ยังไม่มีข้อมูลคะแนนในปี {targetYear}</div>
         ) : (
            <div className="divide-y divide-gray-50">
                {items.map((item, index) => (
                    <div key={item.volunteer.id} className="p-4 flex items-center gap-4 hover:bg-pink-50/50 transition">
                        <div className={`w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-full font-bold text-lg ${
                            index === 0 ? 'bg-yellow-100 text-yellow-600' :
                            index === 1 ? 'bg-gray-100 text-gray-600' :
                            index === 2 ? 'bg-orange-100 text-orange-600' :
                            'bg-white text-gray-400 border border-gray-100'
                        }`}>
                            {index < 3 ? <Medal size={20} /> : index + 1}
                        </div>
                        
                        <div className="flex-grow min-w-0">
                            <div className="flex items-center gap-2">
                                <span className="font-mono text-xs text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">{item.volunteer.empId}</span>
                                <h3 className="font-bold text-gray-800 truncate">{item.volunteer.name}</h3>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                                <span className={`text-[10px] px-2 py-0.5 rounded-full ${item.rank.color} flex items-center gap-1`}>
                                    {item.rank.icon} {item.rank.name}
                                </span>
                            </div>
                        </div>

                        <div className="text-right flex-shrink-0">
                            <span className="block text-xl font-bold text-primary">{item.points}</span>
                            <span className="text-[10px] text-gray-400">คะแนน</span>
                        </div>
                    </div>
                ))}
            </div>
         )}
      </div>
    </div>
  );
};