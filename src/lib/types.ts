export type WalletType = "cash" | "bank" | "card";

export type CategoryKind = "income" | "expense";

export type TransactionType = "income" | "expense" | "transfer";

export type ISODate = string; // YYYY-MM-DD

export type BillStatus = "pending" | "active" | "paused";

export interface Wallet {
  id: string;
  name: string;
  type: WalletType;
  iconKey: string;
  color: string;
  archived: boolean;

  openingBalanceInPaise: number; // cash and bank; cards use credit limit
  creditLimitInPaise: number | null; // credit cards only
  createdAt: number; // epoch ms
  updatedAt: number; // epoch ms
}

export interface Category {
  id: string;
  name: string;
  kind: CategoryKind;
  iconKey: string;
  color: string;
  system: boolean;

  createdAt: number; // epoch ms
  updatedAt: number; // epoch ms
}

export interface Transaction {
  id: string;
  type: TransactionType;

  amountInPaise: number; // positive int, sign is implied by type
  date: ISODate; // transaction effective date
  note: string;

  // Income/Expense
  categoryId: string | null;
  walletId: string; // wallet the transaction is associated with

  // Transfer
  toWalletId: string | null;

  // Optional relationship
  billId: string | null;

  createdAt: number; // epoch ms
  updatedAt: number; // epoch ms
}

export interface Bill {
  id: string;
  title: string;
  amountInPaise: number;
  boughtDate: ISODate;
  endDate: ISODate;
  lastPaidDate: ISODate | null;
  billingCycle: "one_time" | "recurring";
  durationValue: number;
  durationUnit: "days" | "months" | "years";
  billType: "phone_bill" | "internet_bill" | "subscription";
  status: BillStatus;

  createdAt: number; // epoch ms
  updatedAt: number; // epoch ms
}

