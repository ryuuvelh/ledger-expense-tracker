import { db } from "./db";
import { colorFromIndex } from "./colorPalette";
import { incomeCategoryIconOptions, expenseCategoryIconOptions, walletTypeIconKey } from "./iconRegistry";
import { Category, Wallet } from "./types";

function now() {
  return Date.now();
}

export async function ensureSeed() {
  const existing = await db.categories.count();
  if (existing > 0) return;

  const t = now();

  const incomeCategories: Category[] = [
    { id: "cat_income_salary", name: "Salary", kind: "income", iconKey: "income_salary", color: colorFromIndex(0), system: false, createdAt: t, updatedAt: t },
    { id: "cat_income_freelance", name: "Freelance/Jobs", kind: "income", iconKey: "income_freelance", color: colorFromIndex(1), system: false, createdAt: t, updatedAt: t },
    { id: "cat_income_investment", name: "Investment", kind: "income", iconKey: "income_investment", color: colorFromIndex(2), system: false, createdAt: t, updatedAt: t },
    { id: "cat_income_gift", name: "Gift", kind: "income", iconKey: "income_gift", color: colorFromIndex(3), system: false, createdAt: t, updatedAt: t },
    { id: "cat_income_refund", name: "Refund", kind: "income", iconKey: "income_refund", color: colorFromIndex(4), system: false, createdAt: t, updatedAt: t },
    { id: "cat_income_other", name: "Other Income", kind: "income", iconKey: "income_other", color: colorFromIndex(5), system: false, createdAt: t, updatedAt: t },
  ];

  const expenseCategories: Category[] = [
    { id: "cat_expense_food", name: "Food", kind: "expense", iconKey: "expense_food", color: colorFromIndex(0), system: false, createdAt: t, updatedAt: t },
    { id: "cat_expense_rent", name: "Rent", kind: "expense", iconKey: "expense_rent", color: colorFromIndex(1), system: false, createdAt: t, updatedAt: t },
    { id: "cat_expense_transport", name: "Transport", kind: "expense", iconKey: "expense_transport", color: colorFromIndex(2), system: false, createdAt: t, updatedAt: t },
    { id: "cat_expense_bills", name: "Bills", kind: "expense", iconKey: "expense_bills", color: colorFromIndex(3), system: false, createdAt: t, updatedAt: t },
    { id: "cat_expense_shopping", name: "Shopping", kind: "expense", iconKey: "expense_shopping", color: colorFromIndex(4), system: false, createdAt: t, updatedAt: t },
    { id: "cat_expense_entertainment", name: "Entertainment", kind: "expense", iconKey: "expense_entertainment", color: colorFromIndex(5), system: false, createdAt: t, updatedAt: t },
    { id: "cat_expense_health", name: "Health", kind: "expense", iconKey: "expense_health", color: colorFromIndex(6), system: false, createdAt: t, updatedAt: t },
    { id: "cat_expense_travel", name: "Travel", kind: "expense", iconKey: "expense_travel", color: colorFromIndex(7), system: false, createdAt: t, updatedAt: t },
    { id: "cat_expense_other", name: "Other Expense", kind: "expense", iconKey: "expense_other", color: colorFromIndex(2), system: false, createdAt: t, updatedAt: t },
  ];

  const wallets: Wallet[] = [
    {
      id: "wallet_cash",
      name: "Cash",
      type: "cash",
      iconKey: walletTypeIconKey.cash,
      color: colorFromIndex(2),
      archived: false,
      openingBalanceInPaise: 0,
      creditLimitInPaise: null,
      createdAt: t,
      updatedAt: t,
    },
    {
      id: "wallet_bank",
      name: "Bank Account",
      type: "bank",
      iconKey: walletTypeIconKey.bank,
      color: colorFromIndex(0),
      archived: false,
      openingBalanceInPaise: 0,
      creditLimitInPaise: null,
      createdAt: t,
      updatedAt: t,
    },
    {
      id: "wallet_card",
      name: "Card",
      type: "card",
      iconKey: walletTypeIconKey.card,
      color: colorFromIndex(4),
      archived: false,
      openingBalanceInPaise: 0,
      creditLimitInPaise: null,
      createdAt: t,
      updatedAt: t,
    },
  ];

  await db.transaction("rw", [db.wallets, db.categories], async () => {
    await db.wallets.bulkAdd(wallets);
    await db.categories.bulkAdd([...incomeCategories, ...expenseCategories]);
  });
}

// These exports are here only to keep the seed UI consistent with icon options.
export const seedIncomeIconOptions = incomeCategoryIconOptions;
export const seedExpenseIconOptions = expenseCategoryIconOptions;

