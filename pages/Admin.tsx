import React, { useState, useEffect } from 'react';
import { dataService, getCurrentThaiYear } from '../services/dataService';
import { Volunteer, Transaction, Reward, RedemptionRequest } from '../types';
import { Users, PlusCircle, CheckCircle, XCircle, Settings as SettingsIcon, Download, LogOut, Phone } from 'lucide-react';

const ADMIN_PASSCODE = 'NTL-Volunteer-2569';

export const Admin: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passcode, setPasscode] = useState('');
  const [activeTab, setActiveTab] = useState<'users' | 'points' | 'requests' | 'rewards'>('points');

  useEffect(() => {
    if (sessionStorage.getItem('admin_auth') === 'true') {
        setIsAuthenticated(true);
    }
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (passcode === ADMIN_PASSCODE) {
      setIsAuthenticated(true);
      sessionStorage.setItem('admin_auth', 'true');
    } else {
      alert('รหัสผ่านไม่ถูกต้อง');
    }
  };

  const handleLogout = () => {
      setIsAuthenticated(false);
      sessionStorage.removeItem('admin_auth');
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-sm border border-pink-100">
          <h2 className="text-2xl font-bold text-center mb-6 text-gray-800">Admin Access</h2>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Passcode</label>
              <input
                type="password"
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="Enter passcode"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-gray-900 text-white py-3 rounded-lg font-semibold hover:bg-gray-800 transition"
            >
              เข้าสู่ระบบ
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-gray-900 text-white p-4 rounded-xl shadow-lg">
        <h1 className="text-xl font-bold flex items-center gap-2">
            <SettingsIcon size={20} />
            Admin Dashboard
        </h1>
        <button onClick={handleLogout} className="text-gray-300 hover:text-white flex items-center gap-1 text-sm">
            <LogOut size={16} /> ออกจากระบบ
        </button>
      </div>

      {/* Tabs */}
      <div className="flex space-x-2 overflow-x-auto pb-2">
        <TabButton active={activeTab === 'points'} onClick={() => setActiveTab('points')} icon={<PlusCircle size={18} />} label="เติมแต้ม" />
        <TabButton active={activeTab === 'users'} onClick={() => setActiveTab('users')} icon={<Users size={18} />} label="อาสา" />
        <TabButton active={activeTab === 'requests'} onClick={() => setActiveTab('requests')} icon={<CheckCircle size={18} />} label="คำขอแลกของ" />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 min-h-[400px]">
        {activeTab === 'points' && <AdminPoints />}
        {activeTab === 'users' && <AdminUsers />}
        {activeTab === 'requests' && <AdminRequests />}
      </div>
    </div>
  );
};

const TabButton: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; label: string }> = ({ active, onClick, icon, label }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition whitespace-nowrap ${
      active ? 'bg-primary text-white shadow-md' : 'bg-white text-gray-600 border border-gray-200 hover:bg-pink-50'
    }`}
  >
    {icon} {label}
  </button>
);

/* --- Sub Components --- */

const AdminPoints: React.FC = () => {
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [selectedVolId, setSelectedVolId] = useState('');
  const [activityType, setActivityType] = useState<'COMMUNITY' | 'FOLLOWUP'>('COMMUNITY');
  const [bonusMultiple, setBonusMultiple] = useState(false);
  const [bonusContinuous, setBonusContinuous] = useState(false);
  const [customNote, setCustomNote] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [yearOverride, setYearOverride] = useState(getCurrentThaiYear());

  useEffect(() => {
    setVolunteers(dataService.getVolunteers());
  }, []);

  const calculateTotal = () => {
    let base = activityType === 'COMMUNITY' ? 20 : 25;
    if (bonusMultiple) base += 10;
    if (bonusContinuous) base += 5;
    return base;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVolId) return alert('กรุณาเลือกอาสา');

    const total = calculateTotal();
    const vol = volunteers.find(v => v.id === selectedVolId);
    
    // Create Transaction
    const tx: Transaction = {
      id: 'tx_' + Date.now(),
      volunteerId: selectedVolId,
      amount: total,
      type: 'ACTIVITY',
      description: `${activityType === 'COMMUNITY' ? 'ร่วมกิจกรรมชุมชน' : 'กิจกรรมติดตามผล'} ${customNote ? `(${customNote})` : ''}`,
      date: new Date(date).toISOString(),
      thaiYear: yearOverride,
      createdBy: 'Admin'
    };
    
    dataService.addTransaction(tx);

    alert(`บันทึกสำเร็จ: +${total} แต้ม ให้คุณ ${vol?.name}`);
    
    // Reset minimal
    setBonusMultiple(false);
    setBonusContinuous(false);
    setCustomNote('');
  };

  return (
    <div className="max-w-xl mx-auto">
      <h2 className="text-xl font-bold mb-6 text-gray-800">เพิ่มคะแนนกิจกรรม</h2>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">เลือกอาสา</label>
          <select 
            className="w-full p-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary outline-none"
            value={selectedVolId}
            onChange={e => setSelectedVolId(e.target.value)}
            required
          >
            <option value="">-- เลือกชื่อ หรือ รหัส --</option>
            {volunteers.map(v => (
              <option key={v.id} value={v.id}>{v.name} ({v.empId})</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">ประเภทกิจกรรมหลัก</label>
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setActivityType('COMMUNITY')}
              className={`p-4 rounded-xl border-2 transition ${activityType === 'COMMUNITY' ? 'border-primary bg-green-50 text-primary' : 'border-gray-200 hover:border-gray-300'}`}
            >
              <div className="font-bold">กิจกรรมชุมชน</div>
              <div className="text-sm opacity-80">+20 แต้ม</div>
            </button>
            <button
              type="button"
              onClick={() => setActivityType('FOLLOWUP')}
              className={`p-4 rounded-xl border-2 transition ${activityType === 'FOLLOWUP' ? 'border-primary bg-green-50 text-primary' : 'border-gray-200 hover:border-gray-300'}`}
            >
              <div className="font-bold">ติดตามผล</div>
              <div className="text-sm opacity-80">+25 แต้ม</div>
            </button>
          </div>
        </div>

        <div className="bg-gray-50 p-4 rounded-xl space-y-3">
          <label className="block text-sm font-medium text-gray-700">Bonus & เพิ่มเติม</label>
          <label className="flex items-center space-x-3 cursor-pointer">
            <input type="checkbox" checked={bonusMultiple} onChange={e => setBonusMultiple(e.target.checked)} className="w-5 h-5 text-primary rounded focus:ring-primary" />
            <span>ร่วมหลายบทบาทในครั้งเดียว (+10)</span>
          </label>
          <label className="flex items-center space-x-3 cursor-pointer">
            <input type="checkbox" checked={bonusContinuous} onChange={e => setBonusContinuous(e.target.checked)} className="w-5 h-5 text-primary rounded focus:ring-primary" />
            <span>ร่วมกิจกรรมต่อเนื่องในปี (+5)</span>
          </label>
        </div>

        <div className="grid grid-cols-2 gap-4">
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">วันที่ทำกิจกรรม</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full p-2 border rounded-lg" />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">ปีงบประมาณ (พ.ศ.)</label>
                <input type="number" value={yearOverride} onChange={e => setYearOverride(Number(e.target.value))} className="w-full p-2 border rounded-lg" />
            </div>
        </div>

         <div>
           <label className="block text-sm font-medium text-gray-700 mb-2">หมายเหตุ (Optional)</label>
           <input type="text" value={customNote} onChange={e => setCustomNote(e.target.value)} placeholder="เช่น สถานที่, รายละเอียดเพิ่มเติม" className="w-full p-2 border rounded-lg" />
        </div>

        <div className="pt-4 border-t">
          <div className="flex justify-between items-center mb-4">
            <span className="text-gray-600">คะแนนสุทธิที่จะได้รับ</span>
            <span className="text-3xl font-bold text-primary">+{calculateTotal()}</span>
          </div>
          <button type="submit" className="w-full bg-primary text-white font-bold py-4 rounded-xl hover:bg-pink-600 shadow-lg shadow-pink-200 transition">
            บันทึกคะแนน
          </button>
        </div>
      </form>
    </div>
  );
};

const AdminRequests: React.FC = () => {
  const [requests, setRequests] = useState<RedemptionRequest[]>([]);
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);

  const loadData = () => {
    setRequests(dataService.getRequests().sort((a,b) => new Date(b.requestDate).getTime() - new Date(a.requestDate).getTime()));
    setVolunteers(dataService.getVolunteers());
    setRewards(dataService.getRewards());
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleStatusChange = (req: RedemptionRequest, newStatus: 'APPROVED' | 'REJECTED') => {
    if (newStatus === 'APPROVED') {
       const reward = rewards.find(r => r.id === req.rewardId);
       if (!reward) return;

       const confirm = window.confirm(`อนุมัติให้ ${volunteers.find(v => v.id === req.volunteerId)?.name} แลก ${reward.name}?\nระบบจะหัก ${reward.cost} คะแนน`);
       if (!confirm) return;

       const tx: Transaction = {
         id: 'tx_red_' + Date.now(),
         volunteerId: req.volunteerId,
         amount: -reward.cost,
         type: 'REDEMPTION',
         description: `แลกของรางวัล: ${reward.name}`,
         date: new Date().toISOString(),
         thaiYear: getCurrentThaiYear(),
         createdBy: 'Admin'
       };
       dataService.addTransaction(tx);
    }
    
    const updated = { ...req, status: newStatus };
    dataService.updateRequest(updated);
    loadData();
  };

  const exportCSV = () => {
    const header = "Date,Volunteer Name,Phone,Reward,Status\n";
    const rows = requests.map(r => {
        const vName = volunteers.find(v => v.id === r.volunteerId)?.name || 'Unknown';
        const rName = rewards.find(rw => rw.id === r.rewardId)?.name || 'Unknown';
        return `${new Date(r.requestDate).toLocaleDateString()},${vName},${r.phoneNumber || '-'},${rName},${r.status}`;
    }).join("\n");
    
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "redemption_requests.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-800">คำขอแลกของรางวัล</h2>
        <button onClick={exportCSV} className="flex items-center gap-2 text-sm text-gray-600 hover:text-primary border px-3 py-1.5 rounded-lg">
            <Download size={16} /> Export CSV
        </button>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
            <thead>
                <tr className="border-b text-gray-500 text-sm">
                    <th className="py-2">วันที่</th>
                    <th className="py-2">อาสา / เบอร์โทร</th>
                    <th className="py-2">ของรางวัล</th>
                    <th className="py-2">สถานะ</th>
                    <th className="py-2 text-right">จัดการ</th>
                </tr>
            </thead>
            <tbody className="divide-y">
                {requests.map(req => {
                    const vol = volunteers.find(v => v.id === req.volunteerId);
                    const rew = rewards.find(r => r.id === req.rewardId);
                    return (
                        <tr key={req.id} className="hover:bg-gray-50">
                            <td className="py-3 text-sm">{new Date(req.requestDate).toLocaleDateString('th-TH')}</td>
                            <td className="py-3">
                                <div className="font-medium text-gray-800">{vol?.name}</div>
                                <div className="text-xs text-gray-500 mb-1">{vol?.empId}</div>
                                {req.phoneNumber && (
                                    <div className="flex items-center text-xs text-pink-600 bg-pink-50 px-2 py-0.5 rounded w-fit">
                                        <Phone size={10} className="mr-1"/> {req.phoneNumber}
                                    </div>
                                )}
                            </td>
                            <td className="py-3 text-gray-700">{rew?.name}</td>
                            <td className="py-3">
                                <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                                    req.status === 'PENDING' ? 'bg-orange-100 text-orange-600' :
                                    req.status === 'APPROVED' ? 'bg-green-100 text-green-600' :
                                    'bg-red-100 text-red-600'
                                }`}>
                                    {req.status}
                                </span>
                            </td>
                            <td className="py-3 text-right space-x-2">
                                {req.status === 'PENDING' && (
                                    <>
                                        <button onClick={() => handleStatusChange(req, 'APPROVED')} className="text-green-600 hover:bg-green-100 p-1 rounded"><CheckCircle size={20} /></button>
                                        <button onClick={() => handleStatusChange(req, 'REJECTED')} className="text-red-500 hover:bg-red-100 p-1 rounded"><XCircle size={20} /></button>
                                    </>
                                )}
                            </td>
                        </tr>
                    )
                })}
            </tbody>
        </table>
      </div>
    </div>
  );
};

const AdminUsers: React.FC = () => {
    const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
    const [newName, setNewName] = useState('');
    const [newEmpId, setNewEmpId] = useState('');
    const [newType, setNewType] = useState<'HO'|'Branch'>('HO');

    useEffect(() => {
        setVolunteers(dataService.getVolunteers());
    }, []);

    const handleAdd = (e: React.FormEvent) => {
        e.preventDefault();
        const newVol: Volunteer = {
            id: 'v_' + Date.now(),
            name: newName,
            empId: newEmpId,
            type: newType
        };
        dataService.saveVolunteer(newVol);
        setVolunteers(dataService.getVolunteers());
        setNewName('');
        setNewEmpId('');
    };

    return (
        <div>
            <h2 className="text-xl font-bold text-gray-800 mb-6">จัดการข้อมูลอาสา</h2>
            <form onSubmit={handleAdd} className="bg-gray-50 p-4 rounded-xl mb-6 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div>
                    <label className="text-xs text-gray-500">ชื่อ-นามสกุล</label>
                    <input type="text" required value={newName} onChange={e => setNewName(e.target.value)} className="w-full p-2 border rounded" placeholder="สมศรี ดีใจ" />
                </div>
                <div>
                    <label className="text-xs text-gray-500">รหัสพนักงาน</label>
                    <input type="text" required value={newEmpId} onChange={e => setNewEmpId(e.target.value)} className="w-full p-2 border rounded" placeholder="123456" />
                </div>
                <div>
                    <label className="text-xs text-gray-500">สังกัด</label>
                    <select value={newType} onChange={e => setNewType(e.target.value as any)} className="w-full p-2 border rounded">
                        <option value="HO">HO (สำนักงานใหญ่)</option>
                        <option value="Branch">Branch (สาขา)</option>
                    </select>
                </div>
                <button type="submit" className="bg-gray-800 text-white p-2 rounded hover:bg-black">เพิ่มอาสา</button>
            </form>
            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead>
                        <tr className="border-b text-sm text-gray-500">
                            <th className="py-2">ชื่อ</th>
                            <th className="py-2">รหัส</th>
                            <th className="py-2">สังกัด</th>
                            <th className="py-2">แต้มรวม</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {volunteers.map(v => (
                            <tr key={v.id}>
                                <td className="py-2">{v.name}</td>
                                <td className="py-2 font-mono text-sm text-gray-500">{v.empId}</td>
                                <td className="py-2"><span className="bg-gray-100 text-xs px-2 py-1 rounded">{v.type}</span></td>
                                <td className="py-2 font-bold">{dataService.getVolunteerPoints(v.id)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}