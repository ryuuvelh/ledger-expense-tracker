import {
  BadgeDollarSign,
  BusFront,
  CircleDollarSign,
  CreditCard,
  CircleOff,
  BriefcaseBusiness,
  Gift,
  HeartPulse,
  Home,
  Landmark,
  Plane,
  PiggyBank,
  ReceiptText,
  RotateCcw,
  ShoppingBag,
  Sparkles,
  Tv,
  Utensils,
  Wallet,
} from "lucide-react";
import React from "react";

// Wallet icons
export const walletTypeIconKey: Record<string, string> = {
  cash: "cash_wallet",
  bank: "bank_landmark",
  card: "card_credit",
};

export type IconKey = string;

export type IconSize = number;

function withSize(size: number) {
  return { size, strokeWidth: 2 };
}

// Income category icons
export const incomeCategoryIconOptions: Array<{ iconKey: IconKey; label: string }> =
  [
    { iconKey: "income_salary", label: "Salary" },
    { iconKey: "income_freelance", label: "Freelance/Jobs" },
    { iconKey: "income_investment", label: "Investment" },
    { iconKey: "income_gift", label: "Gift" },
    { iconKey: "income_refund", label: "Refund" },
    { iconKey: "income_other", label: "Other" },
  ];

// Expense category icons
export const expenseCategoryIconOptions: Array<{ iconKey: IconKey; label: string }> = [
  { iconKey: "expense_food", label: "Food" },
  { iconKey: "expense_rent", label: "Rent" },
  { iconKey: "expense_transport", label: "Transport" },
  { iconKey: "expense_bills", label: "Bills" },
  { iconKey: "expense_shopping", label: "Shopping" },
  { iconKey: "expense_entertainment", label: "Entertainment" },
  { iconKey: "expense_health", label: "Health" },
  { iconKey: "expense_travel", label: "Travel" },
  { iconKey: "expense_other", label: "Other" },
];

export function renderIcon(
  iconKey: IconKey,
  size: IconSize = 20,
  color?: string
): React.ReactNode {
  const icon = renderIconInner(iconKey, size);
  if (!color) return icon;
  return (
    <span className="inline-flex items-center justify-center" style={{ color }}>
      {icon}
    </span>
  );
}

function renderIconInner(iconKey: IconKey, size: IconSize = 20): React.ReactNode {
  switch (iconKey) {
    // Wallets
    case "cash_wallet":
      return <Wallet {...withSize(size)} />;
    case "bank_landmark":
      return <Landmark {...withSize(size)} />;
    case "card_credit":
      return <CreditCard {...withSize(size)} />;

    // Income
    case "income_salary":
      return <BadgeDollarSign {...withSize(size)} />;
    case "income_freelance":
      return <BriefcaseBusiness {...withSize(size)} />;
    case "income_investment":
      return <PiggyBank {...withSize(size)} />;
    case "income_gift":
      return <Gift {...withSize(size)} />;
    case "income_refund":
      return <RotateCcw {...withSize(size)} />;
    case "income_other":
      return <Sparkles {...withSize(size)} />;

    // Expense
    case "expense_food":
      return <Utensils {...withSize(size)} />;
    case "expense_rent":
      return <Home {...withSize(size)} />;
    case "expense_transport":
      return <BusFront {...withSize(size)} />;
    case "expense_bills":
      return <ReceiptText {...withSize(size)} />;
    case "expense_shopping":
      return <ShoppingBag {...withSize(size)} />;
    case "expense_entertainment":
      return <Tv {...withSize(size)} />;
    case "expense_health":
      return <HeartPulse {...withSize(size)} />;
    case "expense_travel":
      return <Plane {...withSize(size)} />;
    case "expense_other":
      return <CircleOff {...withSize(size)} />;

    default:
      return <CircleDollarSign {...withSize(size)} />;
  }
}

