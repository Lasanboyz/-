import { supabase } from "../services/supabaseClient";
import React, { useState, useEffect, useRef } from 'react';
import { dataService, getCurrentThaiYear } from '../services/dataService';
import { Volunteer, Transaction, Reward, RedemptionRequest } from '../types';
import { Users, PlusCircle, CheckCircle, XCircle, Settings as SettingsIcon, Download, LogOut, Phone, History, Calendar, Flag, Briefcase, Search, Upload, FileSpreadsheet, AlertTriangle } from 'lucide-react';
import * as XLSX from 'xlsx';

const ADMIN_PASSCODE = 'NTL-Volunteer-2569';

export const Admin: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passcode, setPasscode] = useState('');
  const [activeTab, setActiveTab] = useState<'users' | 'points' | 'requests' | 'history'>('points');

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
      <div className="flex space-x-2 overflow-x-auto pb-2 hide-scrollbar">
        <TabButton active={activeTab === 'points'} onClick={() => setActiveTab('points')} icon={<PlusCircle size={18} />} label="จัดการแต้ม" />
        <TabButton active={activeTab === 'users'} onClick={() => setActiveTab('users')} icon={<Users size={18} />} label="รายชื่อ" />
        <TabButton active={activeTab === 'history'} onClick={() => setActiveTab('history')} icon={<History size={18} />} label="ประวัติกิจกรรม" />
        <TabButton active={activeTab === 'requests'} onClick={() => setActiveTab('requests')} icon={<CheckCircle size={18} />} label="คำขอแลกของ" />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 min-h-[400px]">
        {activeTab === 'points' && <AdminPoints />}
        {activeTab === 'users' && <AdminUsers />}
        {activeTab === 'history' && <AdminHistory />}
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
  
  // Mode State: GIVE = Activity Points, ADJUST = Correction/Deduction
  const [mode, setMode] = useState<'GIVE' | 'ADJUST'>('GIVE');

  // GIVE Mode State
  const [activityType, setActivityType] = useState<'COMMUNITY' | 'FOLLOWUP'>('COMMUNITY');
  const [basePoints, setBasePoints] = useState<number>(20); 
  const [bonusMultiple, setBonusMultiple] = useState(false);
  const [bonusContinuous, setBonusContinuous] = useState(false);
  
  // ADJUST Mode State
  const [adjustAmount, setAdjustAmount] = useState<string>(''); // String to handle minus sign input easier

  // Shared State
  const [customNote, setCustomNote] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  // Search State
  const [searchTerm, setSearchTerm] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setVolunteers(dataService.getVolunteers());
    
    // Close dropdown when clicking outside
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredVolunteers = volunteers.filter(v => 
    v.empId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handlePreset = (type: 'COMMUNITY' | 'FOLLOWUP') => {
      setActivityType(type);
      setBasePoints(type === 'COMMUNITY' ? 20 : 25);
  };

  const calculateTotalGive = () => {
    let total = Number(basePoints) || 0;
    if (bonusMultiple) total += 10;
    if (bonusContinuous) total += 5;
    return total;
  };

  const handleSelectVolunteer = (vol: Volunteer) => {
    setSelectedVolId(vol.id);
    setSearchTerm(vol.empId);
    setShowDropdown(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVolId) return alert('กรุณาเลือกอาสา');

    const selectedDate = new Date(date);
    const autoThaiYear = selectedDate.getFullYear() + 543;
    const vol = volunteers.find(v => v.id === selectedVolId);
    
    let amount = 0;
    let type: Transaction['type'] = 'ACTIVITY';
    let description = '';

    if (mode === 'GIVE') {
        amount = calculateTotalGive();
        type = 'ACTIVITY';
        description = `${activityType === 'COMMUNITY' ? 'ร่วมกิจกรรมชุมชน' : 'กิจกรรมติดตามผล'} ${customNote ? `(${customNote})` : ''}`;
    } else {
        amount = Number(adjustAmount);
        if (isNaN(amount) || amount === 0) return alert('กรุณาระบุจำนวนแต้มที่ถูกต้อง');
        if (!customNote) return alert('กรุณาระบุเหตุผลการปรับปรุงแต้ม (ช่องหมายเหตุ)');
        type = 'ADJUSTMENT';
        description = `ปรับปรุงแต้ม: ${customNote}`;
    }
    
    // Create Transaction
    const tx: Transaction = {
      id: 'tx_' + Date.now(),
      volunteerId: selectedVolId,
      amount: amount,
      type: type,
      description: description,
      date: selectedDate.toISOString(),
      thaiYear: autoThaiYear,
      createdBy: 'Admin'
    };
    
    dataService.addTransaction(tx);

    let msg = `บันทึกสำเร็จ: ${amount > 0 ? '+' : ''}${amount} แต้ม ให้รหัส ${vol?.empId}`;
    if (autoThaiYear >= 2557 && autoThaiYear <= 2568) {
        msg += `\n(หมายเหตุ: ปี ${autoThaiYear} อยู่ในช่วงงดเว้นคะแนน ระบบจะบันทึกแต่ไม่นำมาคำนวณ)`;
    }
    alert(msg);
    
    // Reset minimal
    setBonusMultiple(false);
    setBonusContinuous(false);
    setCustomNote('');
    setAdjustAmount('');
  };

  return (
    <div className="max-w-xl mx-auto">
      <h2 className="text-xl font-bold mb-4 text-gray-800">จัดการคะแนน (Points Management)</h2>
      
      {/* Mode Switcher */}
      <div className="flex bg-gray-100 p-1 rounded-xl mb-6">
        <button
            type="button"
            onClick={() => setMode('GIVE')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition flex items-center justify-center gap-2 ${mode === 'GIVE' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
            <PlusCircle size={16} /> เพิ่มแต้มกิจกรรม
        </button>
        <button
            type="button"
            onClick={() => setMode('ADJUST')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition flex items-center justify-center gap-2 ${mode === 'ADJUST' ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
            <SettingsIcon size={16} /> ปรับปรุง/ลดแต้ม
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* Searchable Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <label className="block text-sm font-medium text-gray-700 mb-2">ค้นหารหัสพนักงาน (empId)</label>
          <div className="relative">
            <input
                type="text"
                className={`w-full p-3 pl-10 rounded-lg border focus:ring-2 focus:ring-primary outline-none ${!selectedVolId ? 'border-gray-300' : 'border-green-50'}`}
                placeholder="พิมพ์รหัสพนักงาน..."
                value={searchTerm}
                onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setShowDropdown(true);
                    setSelectedVolId(''); // Reset selection on type
                }}
                onFocus={() => setShowDropdown(true)}
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            {selectedVolId && (
                <CheckCircle className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500" size={20} />
            )}
          </div>
          
          {showDropdown && searchTerm && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                {filteredVolunteers.length > 0 ? (
                    filteredVolunteers.slice(0, 50).map(vol => ( // Limit to 50 for performance
                        <button
                            key={vol.id}
                            type="button"
                            onClick={() => handleSelectVolunteer(vol)}
                            className="w-full text-left px-4 py-3 hover:bg-pink-50 border-b border-gray-50 last:border-0 flex items-center justify-between group"
                        >
                            <div>
                                <div className="font-bold text-gray-800 group-hover:text-primary font-mono">{vol.empId}</div>
                                <div className="text-xs text-gray-500 flex items-center gap-2">
                                    <span>{vol.type}</span>
                                </div>
                            </div>
                            {vol.isStaff && <span className="text-[10px] bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full">Staff</span>}
                        </button>
                    ))
                ) : (
                    <div className="p-4 text-center text-gray-400 text-sm">ไม่พบข้อมูล</div>
                )}
            </div>
          )}
        </div>

        {/* Dynamic Content based on Mode */}
        {mode === 'GIVE' ? (
            <div className="animate-fade-in space-y-6">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">ประเภทกิจกรรมหลัก (เลือกเพื่อตั้งค่าเริ่มต้น)</label>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <button
                        type="button"
                        onClick={() => handlePreset('COMMUNITY')}
                        className={`p-4 rounded-xl border-2 transition ${activityType === 'COMMUNITY' ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 hover:border-gray-300'}`}
                        >
                        <div className="font-bold">กิจกรรมชุมชน</div>
                        <div className="text-xs opacity-70">ตั้งค่า 20 แต้ม</div>
                        </button>
                        <button
                        type="button"
                        onClick={() => handlePreset('FOLLOWUP')}
                        className={`p-4 rounded-xl border-2 transition ${activityType === 'FOLLOWUP' ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 hover:border-gray-300'}`}
                        >
                        <div className="font-bold">ติดตามผล</div>
                        <div className="text-xs opacity-70">ตั้งค่า 25 แต้ม</div>
                        </button>
                    </div>

                    <label className="block text-sm font-medium text-gray-700 mb-2">คะแนนตั้งต้น (แก้ไขได้)</label>
                    <div className="relative">
                        <input
                            type="number"
                            value={basePoints}
                            onChange={(e) => setBasePoints(Number(e.target.value))}
                            className="w-full p-3 text-lg font-bold text-green-600 border-2 border-gray-300 rounded-xl focus:border-green-500 focus:ring-4 focus:ring-green-100 outline-none transition"
                        />
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">แต้ม</div>
                    </div>
                </div>

                <div className="bg-gray-50 p-4 rounded-xl space-y-3">
                    <label className="block text-sm font-medium text-gray-700">Bonus & เพิ่มเติม (บวกเพิ่ม)</label>
                    <label className="flex items-center space-x-3 cursor-pointer">
                        <input type="checkbox" checked={bonusMultiple} onChange={e => setBonusMultiple(e.target.checked)} className="w-5 h-5 text-green-600 rounded focus:ring-green-500" />
                        <span>ร่วมหลายบทบาทในครั้งเดียว (+10)</span>
                    </label>
                    <label className="flex items-center space-x-3 cursor-pointer">
                        <input type="checkbox" checked={bonusContinuous} onChange={e => setBonusContinuous(e.target.checked)} className="w-5 h-5 text-green-600 rounded focus:ring-green-500" />
                        <span>ร่วมกิจกรรมต่อเนื่องในปี (+5)</span>
                    </label>
                </div>
            </div>
        ) : (
            <div className="animate-fade-in space-y-6 bg-orange-50 p-5 rounded-xl border border-orange-100">
                <div className="flex items-start gap-2 text-orange-800 text-sm mb-2">
                    <AlertTriangle size={18} className="mt-0.5 flex-shrink-0" />
                    <p>โหมดปรับปรุงแต้ม: ใช้สำหรับกรณีหักคะแนน หรือแก้ไขคะแนนที่ผิดพลาด กรุณาระบุเครื่องหมายลบ (-) หากต้องการลดแต้ม</p>
                </div>
                <div>
                    <label className="block text-sm font-bold text-orange-800 mb-2">จำนวนแต้มปรับปรุง (ใส่ - เพื่อลดแต้ม)</label>
                    <input
                        type="number"
                        value={adjustAmount}
                        onChange={(e) => setAdjustAmount(e.target.value)}
                        placeholder="-20 หรือ 20"
                        className="w-full p-3 text-xl font-bold text-gray-800 border-2 border-orange-200 rounded-xl focus:border-orange-500 focus:ring-4 focus:ring-orange-100 outline-none transition bg-white"
                    />
                </div>
            </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">วันที่ทำรายการ</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full p-2 border rounded-lg" />
            </div>
             <div>
               <label className="block text-sm font-medium text-gray-700 mb-2">
                   {mode === 'GIVE' ? 'หมายเหตุ (Optional)' : 'เหตุผลการปรับปรุง (Required)'}
               </label>
               <input 
                    type="text" 
                    value={customNote} 
                    onChange={e => setCustomNote(e.target.value)} 
                    placeholder={mode === 'GIVE' ? "เช่น สถานที่, รายละเอียด" : "ระบุสาเหตุ..."}
                    className={`w-full p-2 border rounded-lg ${mode === 'ADJUST' && !customNote ? 'border-orange-300 bg-orange-50' : ''}`}
                    required={mode === 'ADJUST'}
               />
            </div>
        </div>
        <p className="text-xs text-gray-400 -mt-2">ระบบจะบันทึกเป็นปี พ.ศ. {new Date(date).getFullYear() + 543} โดยอัตโนมัติ</p>

        <div className="pt-4 border-t">
          {mode === 'GIVE' && (
            <div className="flex justify-between items-center mb-4">
                <span className="text-gray-600">คะแนนสุทธิที่จะได้รับ</span>
                <span className="text-3xl font-bold text-green-600">+{calculateTotalGive()}</span>
            </div>
          )}
          <button 
            type="submit" 
            disabled={!selectedVolId} 
            className={`w-full text-white font-bold py-4 rounded-xl shadow-lg transition ${
                !selectedVolId ? 'bg-gray-300 cursor-not-allowed' :
                mode === 'GIVE' ? 'bg-green-600 hover:bg-green-700 shadow-green-200' : 'bg-orange-600 hover:bg-orange-700 shadow-orange-200'
            }`}
          >
            {mode === 'GIVE' ? 'ยืนยันการเติมแต้ม' : 'บันทึกการปรับปรุง'}
          </button>
        </div>
      </form>
    </div>
  );
};

const AdminHistory: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  
  // Year Filter Logic
  const currentThaiYear = getCurrentThaiYear();
  const maxYear = Math.max(currentThaiYear, 2570);
  const minYear = 2557;
  const yearOptions = Array.from({ length: maxYear - minYear + 1 }, (_, i) => maxYear - i);
  const [filterYear, setFilterYear] = useState<number>(2569); // Default filter

  useEffect(() => {
    const allTxs = dataService.getTransactions();
    // Sort by date descending (latest first)
    allTxs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setTransactions(allTxs);
    setVolunteers(dataService.getVolunteers());
  }, []);

  // Filter transactions
  const filteredTransactions = transactions.filter(t => t.thaiYear === filterYear);

  const exportHistoryCSV = () => {
    const header = "Date,ThaiYear,EmpId,Type,Description,Points,Created By\n";
    const rows = filteredTransactions.map(t => {
        const vol = volunteers.find(v => v.id === t.volunteerId);
        const vEmpId = vol?.empId || 'Unknown';
        // Clean description to avoid CSV breaks
        const safeDesc = t.description.replace(/,/g, ' ');
        return `${new Date(t.date).toLocaleDateString()},${t.thaiYear},${vEmpId},${t.type},${safeDesc},${t.amount},${t.createdBy}`;
    }).join("\n");
    
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `activity_history_${filterYear}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
            <h2 className="text-xl font-bold text-gray-800">ประวัติกิจกรรม (History)</h2>
            
            <div className="flex gap-2">
                 <div className="relative">
                    <select 
                        value={filterYear} 
                        onChange={(e) => setFilterYear(Number(e.target.value))}
                        className="appearance-none bg-white border border-gray-300 text-gray-700 py-1.5 pl-3 pr-8 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm h-full"
                    >
                        {yearOptions.map(year => (
                            <option key={year} value={year}>ปี {year}</option>
                        ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                        <Calendar size={14} />
                    </div>
                </div>
                
                <button onClick={exportHistoryCSV} className="flex items-center gap-2 text-sm text-gray-600 hover:text-primary border border-gray-300 px-3 py-1.5 rounded-lg bg-white">
                    <Download size={16} /> CSV
                </button>
            </div>
        </div>

        <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="border-b text-gray-500 text-xs uppercase tracking-wider bg-gray-50">
                        <th className="py-3 px-2 rounded-tl-lg">วันที่</th>
                        <th className="py-3 px-2">รหัสพนักงาน</th>
                        <th className="py-3 px-2">รายการ</th>
                        <th className="py-3 px-2 text-right rounded-tr-lg">คะแนน</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {filteredTransactions.length === 0 ? (
                         <tr>
                            <td colSpan={4} className="py-8 text-center text-gray-400">
                                ไม่พบรายการกิจกรรมในปี {filterYear}
                            </td>
                         </tr>
                    ) : (
                        filteredTransactions.map(tx => {
                            const vol = volunteers.find(v => v.id === tx.volunteerId);
                            // Visual indication if points are effectively ignored
                            const isIgnoredYear = tx.thaiYear >= 2557 && tx.thaiYear <= 2568;
                            
                            return (
                                <tr key={tx.id} className="hover:bg-gray-50 transition group">
                                    <td className="py-3 px-2 text-sm text-gray-600 whitespace-nowrap">
                                        {new Date(tx.date).toLocaleDateString('th-TH')}
                                    </td>
                                    <td className="py-3 px-2">
                                        <div className="font-medium text-gray-800 font-mono flex items-center gap-1">
                                            {vol?.empId}
                                            {vol?.isStaff && <Briefcase size={12} className="text-purple-500"/>}
                                        </div>
                                    </td>
                                    <td className="py-3 px-2">
                                        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] mr-2 ${
                                            tx.type === 'ACTIVITY' ? 'bg-blue-50 text-blue-600' :
                                            tx.type === 'REDEMPTION' ? 'bg-red-50 text-red-600' :
                                            tx.type === 'ADJUSTMENT' ? 'bg-orange-50 text-orange-600' :
                                            'bg-gray-100 text-gray-600'
                                        }`}>
                                            {tx.type}
                                        </span>
                                        <span className="text-sm text-gray-700">{tx.description}</span>
                                        {isIgnoredYear && <span className="ml-2 text-xs text-gray-400">(งดเว้น)</span>}
                                    </td>
                                    <td className={`py-3 px-2 text-right font-bold text-sm ${
                                        tx.amount > 0 ? 'text-green-600' : 'text-red-500'
                                    }`}>
                                        {isIgnoredYear ? <span className="text-gray-400">0*</span> : (tx.amount > 0 ? '+' : '') + tx.amount}
                                    </td>
                                </tr>
                            );
                        })
                    )}
                </tbody>
            </table>
        </div>
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
  
         const confirm = window.confirm(`อนุมัติการแลก ${reward.name}?\nระบบจะหัก ${reward.cost} คะแนน`);
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
      const header = "Date,EmpId,Phone,Reward,Status\n";
      const rows = requests.map(r => {
          const vEmpId = volunteers.find(v => v.id === r.volunteerId)?.empId || 'Unknown';
          const rName = rewards.find(rw => rw.id === r.rewardId)?.name || 'Unknown';
          return `${new Date(r.requestDate).toLocaleDateString()},${vEmpId},${r.phoneNumber || '-'},${rName},${r.status}`;
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
                      <th className="py-2">รหัส / เบอร์โทร</th>
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
                                  <div className="font-medium text-gray-800 font-mono">{vol?.empId}</div>
                                  {req.phoneNumber && (
                                      <div className="flex items-center text-xs text-pink-600 bg-pink-50 px-2 py-0.5 rounded w-fit mt-1">
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
    const [newEmpId, setNewEmpId] = useState('');
    const [newType, setNewType] = useState<'HO'|'Branch'>('HO');
    const [isStaff, setIsStaff] = useState(false);
    const [importWithPoints, setImportWithPoints] = useState(false); // Checkbox state
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setVolunteers(dataService.getVolunteers());
    }, []);

    const handleAdd = (e: React.FormEvent) => {
        e.preventDefault();
        const newVol: Volunteer = {
            id: 'v_' + Date.now(),
            name: newEmpId, // Use empId as name
            empId: newEmpId,
            type: newType,
            isStaff: isStaff
        };
        dataService.saveVolunteer(newVol);
        setVolunteers(dataService.getVolunteers());
        setNewEmpId('');
        setIsStaff(false);
    };

    const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            const bstr = evt.target?.result;
            const wb = XLSX.read(bstr, { type: 'binary' });
            const wsname = wb.SheetNames[0];
            const ws = wb.Sheets[wsname];
            // NEW FORMAT: No., Date, empId, type, Status
            const data = XLSX.utils.sheet_to_json(ws) as any[];
            
            let count = 0;
            let txCount = 0;
            const currentYear = getCurrentThaiYear();

            data.forEach((row) => {
                if (row.empId) {
                    const empIdStr = String(row.empId);
                    // Check existing
                    const existing = volunteers.find(v => v.empId === empIdStr);
                    const volId = existing ? existing.id : 'v_' + empIdStr + '_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
                    
                    // Determine Type and Staff Status
                    const rawType = String(row.type || 'HO').trim().toUpperCase();
                    let finalType: 'HO' | 'Branch' = 'HO';
                    let finalIsStaff = false;

                    if (rawType === 'ADMIN') {
                        finalType = 'HO';
                        finalIsStaff = true;
                    } else if (rawType === 'BRANCH') {
                        finalType = 'Branch';
                        finalIsStaff = false;
                    } else {
                        finalType = 'HO';
                        finalIsStaff = false;
                    }

                    const newVol: Volunteer = {
                        id: volId,
                        empId: empIdStr,
                        name: empIdStr, // Use ID as name as requested
                        type: finalType,
                        isStaff: finalIsStaff
                    };
                    
                    dataService.saveVolunteer(newVol); 
                    count++;

                    // Import Points using "Status" column
                    if (importWithPoints) {
                        let activityDesc = 'ร่วมกิจกรรมอาสา';
                        // Check "Status" column
                        if (row.Status) {
                             activityDesc = String(row.Status).trim();
                        }

                        // Try parsing Date
                        let txDate = new Date();
                        let txYear = currentYear;
                        
                        // Enhanced Date Parsing (Supports BE and AD)
                        if (row.Date) {
                             if (typeof row.Date === 'number') {
                                const dateObj = new Date((row.Date - (25567 + 2)) * 86400 * 1000);
                                txDate = dateObj;
                             } else if (typeof row.Date === 'string') {
                                const parts = row.Date.split('/');
                                if (parts.length === 3) {
                                    let y = parseInt(parts[2]);
                                    let m = parseInt(parts[1]);
                                    let d = parseInt(parts[0]);
                                    
                                    // AUTO-DETECT BE YEAR (e.g. 2569)
                                    // If Year > 2400, assume it's Buddhist Era and convert to AD for JS Date object
                                    if (y > 2400) {
                                        y = y - 543;
                                    }
                                    txDate = new Date(y, m - 1, d);
                                }
                             }
                             
                             if (!isNaN(txDate.getTime())) {
                                 // Simple AD + 543 Logic
                                 txYear = txDate.getFullYear() + 543;
                             } else {
                                 txDate = new Date();
                             }
                        }
                        
                        const tx: Transaction = {
                            id: 'tx_imp_' + empIdStr + '_' + Date.now() + Math.random().toString(36).substr(2, 5),
                            volunteerId: volId,
                            amount: 20,
                            type: 'ACTIVITY',
                            description: activityDesc,
                            date: txDate.toISOString(),
                            thaiYear: txYear,
                            createdBy: 'Import'
                        };
                        dataService.addTransaction(tx);
                        txCount++;
                    }
                }
            });
            
            let msg = `นำเข้าข้อมูลสำเร็จ ${count} รายการ`;
            if (importWithPoints) {
                msg += `\nและบันทึกแต้มจากคอลัมน์ "Status" ${txCount} รายการ`;
            }
            alert(msg);
            
            setVolunteers(dataService.getVolunteers());
            if (fileInputRef.current) fileInputRef.current.value = '';
        };
        reader.readAsBinaryString(file);
    };

    const downloadTemplate = () => {
        // NEW TEMPLATE: No., Date, empId, type, Status
        const ws = XLSX.utils.json_to_sheet([
            { 
                "No.": 1, 
                "Date": "19/12/2024",
                "empId": "80010301", 
                "type": "ADMIN", 
                "Status": "สำรวจชุมชน"
            },
            { 
                "No.": 2, 
                "Date": "20/12/2569", // Example showing BE support
                "empId": "80067890", 
                "type": "Branch", 
                "Status": "ติดตามผล"
            }
        ]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Template");
        XLSX.writeFile(wb, "volunteer_import_template_v3.xlsx");
    };

    return (
        <div>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <h2 className="text-xl font-bold text-gray-800">จัดการรายชื่อ (รหัสพนักงาน)</h2>
                
                <div className="flex gap-2">
                    <button onClick={downloadTemplate} className="flex items-center gap-2 text-sm text-green-600 hover:text-green-700 bg-green-50 border border-green-200 px-3 py-2 rounded-lg transition">
                        <FileSpreadsheet size={16} /> Template V3
                    </button>
                    <label className="flex items-center gap-2 text-sm text-white bg-green-600 hover:bg-green-700 px-3 py-2 rounded-lg cursor-pointer shadow transition">
                        <Upload size={16} /> Import Excel
                        <input 
                            type="file" 
                            accept=".xlsx, .xls, .csv" 
                            className="hidden" 
                            ref={fileInputRef}
                            onChange={handleImportExcel}
                        />
                    </label>
                </div>
            </div>

            {/* Import Options */}
            <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200 mb-6 flex items-start gap-3">
                 <div className="mt-0.5"><Flag className="text-yellow-600" size={18}/></div>
                 <div className="flex-1">
                     <p className="text-sm font-bold text-yellow-800 mb-1">Options สำหรับการ Import:</p>
                     <label className="flex items-center space-x-2 cursor-pointer">
                        <input 
                            type="checkbox" 
                            checked={importWithPoints} 
                            onChange={e => setImportWithPoints(e.target.checked)} 
                            className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                        />
                        <span className="text-sm text-gray-700">บันทึกแต้มอัตโนมัติจากคอลัมน์ "Status" (+20 แต้ม)</span>
                    </label>
                 </div>
            </div>

            <form onSubmit={handleAdd} className="bg-gray-50 p-4 rounded-xl mb-6 space-y-4 border border-gray-200">
                <div className="text-sm font-bold text-gray-700 mb-2">เพิ่มรายชื่อ (รายบุคคล)</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                </div>
                
                <div className="flex items-center justify-between">
                     <label className="flex items-center space-x-2 cursor-pointer text-gray-700 bg-white px-3 py-2 rounded border border-gray-200">
                        <input 
                            type="checkbox" 
                            checked={isStaff} 
                            onChange={e => setIsStaff(e.target.checked)} 
                            className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                        />
                        <span className="text-sm font-medium">กำหนดเป็นทีมงาน (Admin/Staff)</span>
                        <Briefcase size={14} className="text-purple-500 ml-1"/>
                    </label>

                    <button type="submit" className="bg-gray-800 text-white px-6 py-2 rounded hover:bg-black transition">เพิ่มรหัส</button>
                </div>
            </form>

            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead>
                        <tr className="border-b text-sm text-gray-500">
                            <th className="py-2">รหัสพนักงาน</th>
                            <th className="py-2">สังกัด</th>
                            <th className="py-2 text-center">กิจกรรม (ครั้ง)</th>
                            <th className="py-2 text-right">แต้มรวม</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {volunteers.slice(0, 10).map(v => ( // Show only first 10 for performance
                            <tr key={v.id} className="hover:bg-gray-50 text-sm">
                                <td className="py-2 font-mono font-medium text-gray-800 flex items-center gap-2">
                                    {v.empId}
                                    {v.isStaff && <span className="bg-purple-100 text-purple-600 text-[10px] px-1.5 py-0.5 rounded border border-purple-200">Staff</span>}
                                </td>
                                <td className="py-2"><span className="bg-gray-100 text-xs px-2 py-1 rounded">{v.type}</span></td>
                                <td className="py-2 text-center text-primary font-medium">
                                    {dataService.getVolunteerActivityCount(v.id)}
                                </td>
                                <td className="py-2 font-bold text-right">{dataService.getVolunteerPoints(v.id)}</td>
                            </tr>
                        ))}
                        {volunteers.length > 10 && (
                            <tr>
                                <td colSpan={4} className="py-3 text-center text-gray-400 text-xs bg-gray-50">
                                    ... และอีก {volunteers.length - 10} รายชื่อ ...
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
