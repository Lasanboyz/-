import { Volunteer, Transaction, Reward, RedemptionRequest, RankConfig } from '../types';

// Current Year helper
export const getCurrentThaiYear = () => new Date().getFullYear() + 543;

// Initial Mock Data
const INITIAL_VOLUNTEERS: Volunteer[] = [
  { id: 'v1', empId: '80010301', name: 'นาย มกร จิตหาญ', type: 'HO' },
  { id: 'v2', empId: '80006423', name: 'นาย ปรเมษ บุญเศรษฐ', type: 'HO' },
  { id: 'v3', empId: 'CF100286', name: 'นาย มิ่งขวัญ ประเสริฐศิวพร', type: 'HO' },
  { id: 'v4', empId: '11279320', name: 'นางสาว รัตติยา ชาติรังสรรค์', type: 'HO' },
  { id: 'v5', empId: 'CF304731', name: 'นางสาว ปาริชาติ ฟุ้งลัดดา', type: 'HO' },
];

const INITIAL_REWARDS: Reward[] = [
  { id: 'r1', name: 'ร่มกันแดดพลังใจ', cost: 100, stock: 50, imageUrl: 'https://picsum.photos/200/200?random=1' },
  { id: 'r2', name: 'หมวกแก๊ปอาสา', cost: 50, stock: 100, imageUrl: 'https://picsum.photos/200/200?random=2' },
  { id: 'r3', name: 'เสื้อยืดรักษ์โลก', cost: 150, stock: 30, imageUrl: 'https://picsum.photos/200/200?random=3' },
  { id: 'r4', name: 'กระเป๋าผ้าลดโลกร้อน', cost: 80, stock: 40, imageUrl: 'https://picsum.photos/200/200?random=4' },
];

const INITIAL_TRANSACTIONS: Transaction[] = [
    { id: 't1', volunteerId: 'v1', amount: 20, type: 'ACTIVITY', description: 'ร่วมกิจกรรมชุมชน', date: new Date().toISOString(), thaiYear: getCurrentThaiYear(), createdBy: 'System' },
    { id: 't2', volunteerId: 'v1', amount: 25, type: 'ACTIVITY', description: 'กิจกรรมติดตามผล', date: new Date().toISOString(), thaiYear: getCurrentThaiYear(), createdBy: 'System' },
    { id: 't3', volunteerId: 'v2', amount: 20, type: 'ACTIVITY', description: 'ร่วมกิจกรรมชุมชน', date: new Date().toISOString(), thaiYear: getCurrentThaiYear(), createdBy: 'System' }
];

const KEY_VOLUNTEERS = 'app_volunteers_v2';
const KEY_TRANSACTIONS = 'app_transactions_v2';
const KEY_REWARDS = 'app_rewards_v2';
const KEY_REQUESTS = 'app_requests_v2';

// Helper to initialize storage
const initStorage = () => {
  if (!localStorage.getItem(KEY_VOLUNTEERS)) {
    localStorage.setItem(KEY_VOLUNTEERS, JSON.stringify(INITIAL_VOLUNTEERS));
  }
  if (!localStorage.getItem(KEY_REWARDS)) {
    localStorage.setItem(KEY_REWARDS, JSON.stringify(INITIAL_REWARDS));
  }
  if (!localStorage.getItem(KEY_TRANSACTIONS)) {
      localStorage.setItem(KEY_TRANSACTIONS, JSON.stringify(INITIAL_TRANSACTIONS));
  }
  if (!localStorage.getItem(KEY_REQUESTS)) {
    localStorage.setItem(KEY_REQUESTS, JSON.stringify([]));
  }
};

initStorage();

export const dataService = {
  // Volunteers
  getVolunteers: (): Volunteer[] => JSON.parse(localStorage.getItem(KEY_VOLUNTEERS) || '[]'),
  saveVolunteer: (vol: Volunteer) => {
    const list = dataService.getVolunteers();
    const idx = list.findIndex(v => v.id === vol.id);
    if (idx >= 0) list[idx] = vol;
    else list.push(vol);
    localStorage.setItem(KEY_VOLUNTEERS, JSON.stringify(list));
  },
  
  // Transactions
  getTransactions: (): Transaction[] => JSON.parse(localStorage.getItem(KEY_TRANSACTIONS) || '[]'),
  addTransaction: (tx: Transaction) => {
    const list = dataService.getTransactions();
    list.push(tx);
    localStorage.setItem(KEY_TRANSACTIONS, JSON.stringify(list));
  },

  // Rewards
  getRewards: (): Reward[] => JSON.parse(localStorage.getItem(KEY_REWARDS) || '[]'),
  saveReward: (reward: Reward) => {
    const list = dataService.getRewards();
    const idx = list.findIndex(r => r.id === reward.id);
    if (idx >= 0) list[idx] = reward;
    else list.push(reward);
    localStorage.setItem(KEY_REWARDS, JSON.stringify(list));
  },

  // Requests
  getRequests: (): RedemptionRequest[] => JSON.parse(localStorage.getItem(KEY_REQUESTS) || '[]'),
  addRequest: (req: RedemptionRequest) => {
    const list = dataService.getRequests();
    list.push(req);
    localStorage.setItem(KEY_REQUESTS, JSON.stringify(list));
  },
  updateRequest: (req: RedemptionRequest) => {
    const list = dataService.getRequests();
    const idx = list.findIndex(r => r.id === req.id);
    if (idx >= 0) list[idx] = req;
    localStorage.setItem(KEY_REQUESTS, JSON.stringify(list));
  },

  // Calculations
  getVolunteerPoints: (volunteerId: string, year?: number) => {
    const txs = dataService.getTransactions();
    return txs
      .filter(t => t.volunteerId === volunteerId && (year ? t.thaiYear === year : true))
      .reduce((sum, t) => sum + t.amount, 0);
  },

  getRank: (points: number): RankConfig => {
    if (points >= 500) return { name: 'ผู้มีพลังขับเคลื่อนสังคม', minPoints: 500, icon: '🔥', color: 'text-red-500 bg-red-100' };
    if (points >= 200) return { name: 'นักสร้างสรรค์แบ่งปันโอกาส', minPoints: 200, icon: '🌳', color: 'text-green-600 bg-green-100' };
    if (points >= 50) return { name: 'เพื่อนชุมชน', minPoints: 50, icon: '🌿', color: 'text-emerald-500 bg-emerald-100' };
    return { name: 'ผู้เริ่มต้นแบ่งปัน', minPoints: 0, icon: '🌱', color: 'text-lime-500 bg-lime-100' };
  }
};