export interface Volunteer {
  id: string;
  empId: string;
  name: string;
  type: 'HO' | 'Branch';
  email?: string;
  isStaff?: boolean;
  commu?: string; // Community Name
  depart?: string; // Department
}

export interface Transaction {
  id: string;
  volunteerId: string;
  amount: number;
  type: 'ACTIVITY' | 'BONUS' | 'REDEMPTION' | 'ADJUSTMENT' | 'TRANSFER';
  description: string;
  date: string; // ISO String
  thaiYear: number;
  createdBy: string;
  relatedId?: string; // ID of the other party in a transfer
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