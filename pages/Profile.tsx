import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Award, Gift, History, Calendar } from 'lucide-react';
import { dataService, getCurrentThaiYear } from '../services/dataService';
import { Volunteer, Transaction, RankConfig } from '../types';

export const Profile: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [volunteer, setVolunteer] = useState<Volunteer | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(getCurrentThaiYear());
  
  // Stats
  const [annualPoints, setAnnualPoints] = useState(0);
  const [totalPoints, setTotalPoints] = useState(0);
  const [rank, setRank] = useState<RankConfig | null>(null);

  useEffect(() => {
    if (id) {
      const allVols = dataService.getVolunteers();
      const found = allVols.find(v => v.id === id);
      if (found) {
        setVolunteer(found);
        loadData(found.id);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, selectedYear]);

  const loadData = (volId: string) => {
    const allTxs = dataService.getTransactions().filter(t => t.volunteerId === volId);
    
    // Sort by date desc
    allTxs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setTransactions(allTxs);

    const annual = dataService.getVolunteerPoints(volId, selectedYear);
    setAnnualPoints(annual);
    setTotalPoints(dataService.getVolunteerPoints(volId));
    setRank(dataService.getRank(annual));
  };

  if (!volunteer) return <div className="p-8 text-center">Loading...</div>;

  // Filter Transactions for View
  const displayedTransactions = selectedYear === 0 
    ? transactions 
    : transactions.filter(t => t.thaiYear === selectedYear);

  const availableYears = Array.from(new Set(transactions.map(t => t.thaiYear))).sort((a: number, b: number) => b - a);
  if (!availableYears.includes(getCurrentThaiYear())) {
    availableYears.unshift(getCurrentThaiYear());
  }

  return (
    <div className="space-y-6">
      {/* Header Profile */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <Award size={120} />
        </div>
        
        <Link to="/" className="inline-flex items-center text-gray-500 hover:text-gray-800 mb-4">
          <ArrowLeft size={20} className="mr-1" /> ค้นหาใหม่
        </Link>

        <div className="relative z-10">
          <h1 className="text-2xl font-bold text-gray-900">{volunteer.name}</h1>
          <div className="flex items-center space-x-2 text-gray-500 mt-1">
            <span className="bg-gray-100 px-2 py-0.5 rounded text-xs font-mono">{volunteer.empId}</span>
            <span className="text-sm">• {volunteer.type}</span>
          </div>

          <div className="mt-6 flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 mb-1">ระดับประจำปี {selectedYear}</p>
              <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full ${rank?.color} font-bold text-sm`}>
                <span>{rank?.icon}</span>
                <span>{rank?.name}</span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500 mb-1">แต้มสะสมปีนี้</p>
              <span className="text-3xl font-bold text-primary">{annualPoints}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-blue-50 p-4 rounded-xl flex flex-col items-center justify-center text-center border border-blue-100">
           <span className="text-sm text-blue-600 font-medium mb-1">แต้มรวมทั้งหมด</span>
           <span className="text-2xl font-bold text-blue-800">{totalPoints}</span>
        </div>
        <Link to={`/rewards/${volunteer.id}`} className="bg-secondary p-4 rounded-xl flex flex-col items-center justify-center text-center text-white hover:bg-orange-400 transition shadow-sm">
           <Gift className="mb-1" />
           <span className="font-bold">แลกของรางวัล</span>
        </Link>
      </div>

      {/* Filter Year */}
      <div className="flex overflow-x-auto space-x-2 py-2 hide-scrollbar">
        {availableYears.map(y => (
          <button
            key={y}
            onClick={() => setSelectedYear(y)}
            className={`px-4 py-2 rounded-full whitespace-nowrap text-sm font-medium transition ${
              selectedYear === y 
              ? 'bg-gray-800 text-white shadow-md' 
              : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            ปี {y}
          </button>
        ))}
         <button
            onClick={() => setSelectedYear(0)} // 0 = All
            className={`px-4 py-2 rounded-full whitespace-nowrap text-sm font-medium transition ${
              selectedYear === 0
              ? 'bg-gray-800 text-white shadow-md' 
              : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            ทั้งหมด
          </button>
      </div>

      {/* History */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
            <History size={18} className="text-gray-400" />
            <h2 className="font-semibold text-gray-800">ประวัติรายการ {selectedYear === 0 ? "(ทั้งหมด)" : `(ปี ${selectedYear})`}</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {displayedTransactions.length === 0 ? (
            <div className="p-8 text-center text-gray-400">ยังไม่มีรายการในปีนี้</div>
          ) : (
            displayedTransactions.map(tx => (
              <div key={tx.id} className="p-4 flex justify-between items-start hover:bg-gray-50 transition">
                <div>
                  <div className="font-medium text-gray-800">{tx.description}</div>
                  <div className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                    <Calendar size={12} />
                    {new Date(tx.date).toLocaleDateString('th-TH')}
                    {tx.type === 'REDEMPTION' && <span className="text-red-400">• แลกรางวัล</span>}
                    {tx.type === 'BONUS' && <span className="text-orange-400">• โบนัส</span>}
                  </div>
                </div>
                <div className={`font-bold ${tx.amount > 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {tx.amount > 0 ? '+' : ''}{tx.amount}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
