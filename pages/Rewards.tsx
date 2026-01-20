import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle, Phone, X } from 'lucide-react';
import { dataService } from '../services/dataService';
import { Volunteer, Reward, RedemptionRequest } from '../types';

export const Rewards: React.FC = () => {
  const { volunteerId } = useParams<{ volunteerId: string }>();
  const navigate = useNavigate();
  const [volunteer, setVolunteer] = useState<Volunteer | null>(null);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [currentPoints, setCurrentPoints] = useState(0);
  const [pendingRequests, setPendingRequests] = useState<RedemptionRequest[]>([]);
  const [successMsg, setSuccessMsg] = useState('');
  
  // Modal State
  const [selectedReward, setSelectedReward] = useState<Reward | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');

  useEffect(() => {
    if (volunteerId) {
      const allVols = dataService.getVolunteers();
      const v = allVols.find(i => i.id === volunteerId);
      if (v) {
        setVolunteer(v);
        setCurrentPoints(dataService.getVolunteerPoints(v.id)); 
      }
      setRewards(dataService.getRewards());
      const reqs = dataService.getRequests().filter(r => r.volunteerId === volunteerId && r.status === 'PENDING');
      setPendingRequests(reqs);
    }
  }, [volunteerId]);

  const initiateRedeem = (reward: Reward) => {
    if (currentPoints < reward.cost) {
        alert("คะแนนของคุณไม่เพียงพอ");
        return;
    }
    setSelectedReward(reward);
    setPhoneNumber('');
  }

  const confirmRedeem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!volunteer || !selectedReward) return;
    if (!phoneNumber.trim()) {
        alert("กรุณากรอกเบอร์โทรศัพท์");
        return;
    }

    const newReq: RedemptionRequest = {
        id: 'req_' + Date.now(),
        volunteerId: volunteer.id,
        rewardId: selectedReward.id,
        status: 'PENDING',
        requestDate: new Date().toISOString(),
        phoneNumber: phoneNumber.trim()
    };

    dataService.addRequest(newReq);
    setPendingRequests([...pendingRequests, newReq]);
    setSuccessMsg(`ส่งคำขอแลก "${selectedReward.name}" แล้ว!`);
    
    setSelectedReward(null); // Close modal
    window.scrollTo({ top: 0, behavior: 'smooth' });

    setTimeout(() => setSuccessMsg(''), 4000);
  };

  if (!volunteer) return <div className="p-8 text-center">Loading...</div>;

  return (
    <div className="space-y-6 relative">
      <div className="flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="flex items-center text-gray-500 hover:text-primary">
          <ArrowLeft size={20} className="mr-1" /> กลับ
        </button>
        <div className="text-right">
          <p className="text-xs text-gray-500">คะแนนคงเหลือ (รวม)</p>
          <p className="text-2xl font-bold text-pink-500">{currentPoints}</p>
        </div>
      </div>

      <h1 className="text-2xl font-bold text-gray-800">ของรางวัลแบ่งปันสุข</h1>
      
      {successMsg && (
        <div className="bg-green-100 border border-green-200 text-green-700 p-4 rounded-xl flex items-center animate-bounce shadow-sm">
          <CheckCircle className="mr-2" size={20} />
          {successMsg}
        </div>
      )}

      {/* Pending List */}
      {pendingRequests.length > 0 && (
        <div className="bg-orange-50 border border-orange-100 p-4 rounded-xl">
            <h3 className="font-semibold text-orange-800 text-sm mb-2">รายการรออนุมัติ ({pendingRequests.length})</h3>
            <ul className="text-sm space-y-1">
                {pendingRequests.map(req => {
                    const r = rewards.find(rw => rw.id === req.rewardId);
                    return (
                        <li key={req.id} className="text-orange-700 flex justify-between">
                            <span>- {r?.name || 'Unknown Reward'}</span>
                            <span className="opacity-70">{new Date(req.requestDate).toLocaleDateString('th-TH')}</span>
                        </li>
                    )
                })}
            </ul>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {rewards.map(reward => {
          const isPending = pendingRequests.some(p => p.rewardId === reward.id);
          const canAfford = currentPoints >= reward.cost;

          return (
            <div key={reward.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col hover:shadow-md transition">
              <div className="h-44 bg-gray-100 relative">
                  <img src={reward.imageUrl} alt={reward.name} className="w-full h-full object-cover" />
                  <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full backdrop-blur-sm">
                      เหลือ {reward.stock} ชิ้น
                  </div>
              </div>
              <div className="p-4 flex-grow flex flex-col justify-between">
                <div>
                  <h3 className="font-bold text-gray-800 text-lg">{reward.name}</h3>
                  <p className="text-pink-500 font-bold mt-1 text-xl">{reward.cost} คะแนน</p>
                </div>
                <button
                  onClick={() => initiateRedeem(reward)}
                  disabled={!canAfford || reward.stock <= 0}
                  className={`mt-4 w-full py-3 rounded-xl font-semibold transition ${
                    !canAfford 
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-primary text-white hover:bg-pink-600 shadow-lg shadow-pink-200'
                  }`}
                >
                  {reward.stock <= 0 ? 'สินค้าหมด' : canAfford ? 'แลกของรางวัล' : 'คะแนนไม่พอ'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Phone Number Modal */}
      {selectedReward && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl relative animate-fade-in-up">
                <button 
                    onClick={() => setSelectedReward(null)}
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
                >
                    <X size={24} />
                </button>
                
                <h3 className="text-xl font-bold text-gray-800 mb-1">ยืนยันการแลกรางวัล</h3>
                <p className="text-gray-500 text-sm mb-6">"{selectedReward.name}" ใช้ {selectedReward.cost} คะแนน</p>
                
                <form onSubmit={confirmRedeem} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            กรุณากรอกเบอร์โทรศัพท์เพื่อติดต่อรับของ
                        </label>
                        <div className="relative">
                            <input 
                                type="tel" 
                                required
                                value={phoneNumber}
                                onChange={(e) => setPhoneNumber(e.target.value)}
                                className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                                placeholder="08x-xxx-xxxx"
                            />
                            <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                        </div>
                    </div>
                    
                    <button 
                        type="submit"
                        className="w-full bg-primary text-white font-bold py-3.5 rounded-xl hover:bg-pink-600 shadow-lg shadow-pink-200 transition"
                    >
                        ยืนยันการแลก
                    </button>
                </form>
            </div>
        </div>
      )}
    </div>
  );
};