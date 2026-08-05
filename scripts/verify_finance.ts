/**
 * Checks on the money math. Run with `npm test`.
 * Only pure functions from src/lib are covered — the store needs IndexedDB.
 */
import {
  computeAllWalletBalancesInPaise,
  computeCardAvailableInPaise,
  computeCardUsedInPaise,
} from "@/lib/balances";
import { formatINRFromPaise, parseINRToPaise, parseINRToPaiseOrNull } from "@/lib/money";
import {
  computeBalanceAsOfInPaise,
  computeBalanceTrend,
  computeCategoryPieData,
  computeIncomeExpenseSeries,
  getPeriodRange,
} from "@/lib/reports";
import { Category, Transaction, Wallet } from "@/lib/types";

let failures = 0;

function assertEqual(actual: unknown, expected: unknown, label: string) {
  if (actual !== expected) {
    failures += 1;
    console.error(`[FAIL] ${label}: expected ${expected}, got ${actual}`);
  } else {
    console.log(`[OK] ${label}`);
  }
}

function wallet(overrides: Partial<Wallet> & Pick<Wallet, "id" | "name" | "type">): Wallet {
  return {
    iconKey: "cash_wallet",
    color: "#2563eb",
    archived: false,
    openingBalanceInPaise: 0,
    creditLimitInPaise: null,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

function tx(overrides: Partial<Transaction> & Pick<Transaction, "id" | "type" | "amountInPaise" | "date" | "walletId">): Transaction {
  return {
    note: "",
    categoryId: null,
    toWalletId: null,
    billId: null,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

function main() {
  const wallets: Wallet[] = [
    wallet({ id: "w_cash", name: "Cash", type: "cash" }),
    wallet({ id: "w_bank", name: "Bank", type: "bank" }),
  ];

  const categories: Category[] = [
    { id: "c_salary", name: "Salary", kind: "income", iconKey: "income_salary", color: "#0ea5e9", system: true, createdAt: 0, updatedAt: 0 },
    { id: "c_food", name: "Food", kind: "expense", iconKey: "expense_food", color: "#f97316", system: true, createdAt: 0, updatedAt: 0 },
  ];

  // Dates relative to a fixed "today" so weekly bucketing is deterministic.
  const reference = new Date(2026, 6, 28, 12, 0, 0);
  const range = getPeriodRange({ preset: "weekly", referenceDate: reference });
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const dayOfWeek = (offset: number) => iso(new Date(range.start.getFullYear(), range.start.getMonth(), range.start.getDate() + offset));

  const transactions: Transaction[] = [
    tx({ id: "t_income", type: "income", amountInPaise: 10000, date: dayOfWeek(0), categoryId: "c_salary", walletId: "w_cash" }),
    tx({ id: "t_transfer", type: "transfer", amountInPaise: 5000, date: dayOfWeek(2), walletId: "w_cash", toWalletId: "w_bank" }),
    tx({ id: "t_expense", type: "expense", amountInPaise: 3000, date: dayOfWeek(4), categoryId: "c_food", walletId: "w_bank" }),
  ];

  // --- Wallet balances -------------------------------------------------------
  const balances = computeAllWalletBalancesInPaise(wallets, transactions);
  assertEqual(balances["w_cash"], 5000, "Cash balance after income + transfer out");
  assertEqual(balances["w_bank"], 2000, "Bank balance after transfer in - expense");

  // --- Credit cards ----------------------------------------------------------
  const card = wallet({ id: "w_card", name: "Card", type: "card", creditLimitInPaise: 100000 });
  const cardTxs: Transaction[] = [
    tx({ id: "c1", type: "expense", amountInPaise: 40000, date: dayOfWeek(0), walletId: "w_card" }),
    tx({ id: "c2", type: "income", amountInPaise: 5000, date: dayOfWeek(1), walletId: "w_card" }), // refund
  ];
  assertEqual(computeCardUsedInPaise(card, cardTxs), 35000, "Card used counts expenses minus refunds");
  assertEqual(computeCardAvailableInPaise(card, cardTxs), 65000, "Card available = limit - used");

  // Paying the card off by transfer must give the credit back.
  const cardPayment = tx({
    id: "c3",
    type: "transfer",
    amountInPaise: 20000,
    date: dayOfWeek(2),
    walletId: "w_bank",
    toWalletId: "w_card",
  });
  assertEqual(computeCardUsedInPaise(card, [...cardTxs, cardPayment]), 15000, "Transfer into a card pays it down");
  assertEqual(
    computeCardAvailableInPaise(card, [...cardTxs, cardPayment]),
    85000,
    "Card available recovers after payment"
  );

  // A transfer out of a card is a cash advance, so it increases what is owed.
  const cashAdvance = tx({
    id: "c4",
    type: "transfer",
    amountInPaise: 10000,
    date: dayOfWeek(3),
    walletId: "w_card",
    toWalletId: "w_cash",
  });
  assertEqual(computeCardUsedInPaise(card, [...cardTxs, cashAdvance]), 45000, "Transfer out of a card is a cash advance");

  // Cards never count toward liquid balances.
  const withCard = computeAllWalletBalancesInPaise([...wallets, card], [...transactions, cardPayment]);
  assertEqual(withCard["w_bank"], -18000, "Card payment leaves the bank account");

  // --- Money parsing ---------------------------------------------------------
  assertEqual(formatINRFromPaise(10050), "₹100.50", "INR formatter preserves paise");
  assertEqual(parseINRToPaise("1,234.50"), 123450, "Parses grouped rupees with paise");
  assertEqual(parseINRToPaise("₹ 1234"), 123400, "Parses a currency symbol and spaces");
  assertEqual(parseINRToPaise("1234.567"), 123457, "Rounds the third decimal instead of truncating");
  assertEqual(parseINRToPaiseOrNull("12o0"), null, "Rejects garbage instead of silently returning 0");
  assertEqual(parseINRToPaiseOrNull(""), null, "Rejects empty input");
  assertEqual(parseINRToPaiseOrNull("0"), 0, "Zero is still a valid amount");

  // --- Report series ---------------------------------------------------------
  const activeWalletIds = new Set(wallets.map((w) => w.id));
  const series = computeIncomeExpenseSeries({
    report: { preset: "weekly", referenceDate: reference },
    transactions,
    activeWalletIds,
  });
  assertEqual(series.reduce((s, p) => s + p.incomeInPaise, 0), 10000, "Series income excludes transfers");
  assertEqual(series.reduce((s, p) => s + p.expenseInPaise, 0), 3000, "Series expense excludes transfers");

  const expensePie = computeCategoryPieData({
    report: { preset: "weekly", referenceDate: reference },
    transactions,
    categories,
    kind: "expense",
    activeWalletIds,
  });
  assertEqual(expensePie[0]?.valueInPaise, 3000, "Expense pie totals correct");

  const incomePie = computeCategoryPieData({
    report: { preset: "weekly", referenceDate: reference },
    transactions,
    categories,
    kind: "income",
    activeWalletIds,
  });
  assertEqual(incomePie[0]?.valueInPaise, 10000, "Income pie totals correct");

  // --- Balance trend ---------------------------------------------------------
  const trend = computeBalanceTrend({
    report: { preset: "weekly", referenceDate: reference },
    wallets,
    transactions,
  });
  assertEqual(trend[trend.length - 1]?.balanceInPaise, 7000, "Closing balance = income - expense");
  assertEqual(trend[0]?.balanceInPaise, 10000, "First bucket closes with that day's income");

  // A transaction on the last day of the period must be inside the closing balance.
  const lateSpend = tx({ id: "t_late", type: "expense", amountInPaise: 1000, date: dayOfWeek(6), walletId: "w_bank" });
  const lateTrend = computeBalanceTrend({
    report: { preset: "weekly", referenceDate: reference },
    wallets,
    transactions: [...transactions, lateSpend],
  });
  assertEqual(
    lateTrend[lateTrend.length - 1]?.balanceInPaise,
    6000,
    "Closing balance includes the final day of the period"
  );

  assertEqual(
    computeBalanceAsOfInPaise({ wallets, transactions, date: range.start }),
    0,
    "Opening balance excludes everything in the period"
  );

  // Archived wallets stay out of the totals.
  const archived = [wallet({ id: "w_old", name: "Old", type: "bank", archived: true, openingBalanceInPaise: 999 })];
  assertEqual(
    computeBalanceAsOfInPaise({ wallets: [...wallets, ...archived], transactions, date: range.end }),
    7000,
    "Archived wallets excluded from totals"
  );

  if (failures > 0) {
    console.error(`\n${failures} check(s) failed.`);
    process.exitCode = 1;
  } else {
    console.log("\nAll checks passed.");
  }
}

main();
