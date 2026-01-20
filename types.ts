export interface Volunteer {
  id: string;
  empId: string;
  name: string;
  type: 'HO' | 'Branch';
  email?: string;
}

export interface Transaction {
  id: string;
  volunteerId: string;
  amount: number;
  type: 'ACTIVITY' | 'BONUS' | 'REDEMPTION' | 'ADJUSTMENT';
  description: string;
  date: string; // ISO String
  thaiYear: number;
  createdBy: string;
}

export interface Reward {
  id: string;
  name: string;
  cost: number;
  stock: number;
  imageUrl: string;
}

export type RedemptionStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface RedemptionRequest {
  id: string;
  volunteerId: string;
  rewardId: string;
  status: RedemptionStatus;
  requestDate: string;
  adminNote?: string;
  phoneNumber?: string; // Added phone number
}

export interface RankConfig {
  name: string;
  minPoints: number;
  icon: string;
  color: string;
}