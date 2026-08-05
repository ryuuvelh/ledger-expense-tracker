import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  differenceInCalendarDays,
  format,
  isBefore,
  parseISO,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from "date-fns";
import { Category, Transaction, Wallet } from "./types";
import { computeTotalBalanceInPaise } from "./balances";

export type ReportPreset = "weekly" | "monthly" | "yearly" | "salary_cycle" | "custom";

/** Salary cycle runs from the 18th inclusive to the next 18th exclusive. */
export const SALARY_CYCLE_DAY = 18;

export interface DateRange {
  start: Date; // inclusive
  end: Date; // exclusive
}

export interface CustomDateRange {
  start: string; // YYYY-MM-DD inclusive
  end: string; // YYYY-MM-DD inclusive
}

export interface ReportParams {
  preset: ReportPreset;
  referenceDate: Date;
  customRange?: CustomDateRange;
}

export interface Bucket {
  start: Date;
  end: Date;
  label: string;
}

export interface IncomeExpensePoint {
  label: string;
  incomeInPaise: number;
  expenseInPaise: number;
}

export interface BalanceTrendPoint {
  label: string;
  balanceInPaise: number;
}

export interface CategoryPiePoint {
  categoryId: string | "uncategorized";
  label: string;
  valueInPaise: number;
  color: string;
  iconKey: string;
}

function txDateToDate(tx: Transaction): Date {
  return parseISO(tx.date);
}

function atLocalMidnight(year: number, monthIndex: number, day: number): Date {
  return new Date(year, monthIndex, day, 0, 0, 0, 0);
}

export function getSalaryCycleRange(referenceDate: Date): DateRange {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();
  const day = referenceDate.getDate();

  const start =
    day >= SALARY_CYCLE_DAY
      ? atLocalMidnight(year, month, SALARY_CYCLE_DAY)
      : atLocalMidnight(year, month - 1, SALARY_CYCLE_DAY);
  const end = atLocalMidnight(start.getFullYear(), start.getMonth() + 1, SALARY_CYCLE_DAY);
  return { start, end };
}

export function getPeriodRange(params: ReportParams): DateRange {
  const { preset, referenceDate, customRange } = params;

  if (preset === "custom" && customRange) {
    const start = parseISO(customRange.start);
    const end = addDays(parseISO(customRange.end), 1);
    return { start, end };
  }

  if (preset === "weekly") {
    const start = startOfWeek(referenceDate, { weekStartsOn: 1 });
    const end = addDays(start, 7);
    return { start, end };
  }

  if (preset === "monthly") {
    const start = startOfMonth(referenceDate);
    const end = addMonths(start, 1);
    return { start, end };
  }

  if (preset === "salary_cycle") {
    return getSalaryCycleRange(referenceDate);
  }

  const start = startOfYear(referenceDate);
  const end = addMonths(start, 12);
  return { start, end };
}

/** Shift reference date by one full period for prev/next navigation. */
export function shiftReferenceDate(
  params: ReportParams,
  direction: -1 | 1
): Date | CustomDateRange {
  const { preset, referenceDate, customRange } = params;

  if (preset === "custom" && customRange) {
    const start = parseISO(customRange.start);
    const end = parseISO(customRange.end);
    const spanDays = differenceInCalendarDays(end, start) + 1;
    const shift = direction * spanDays;
    return {
      start: format(addDays(start, shift), "yyyy-MM-dd"),
      end: format(addDays(end, shift), "yyyy-MM-dd"),
    };
  }

  if (preset === "weekly") return addWeeks(referenceDate, direction);
  if (preset === "monthly") return addMonths(referenceDate, direction);
  if (preset === "salary_cycle") return addMonths(referenceDate, direction);
  return addYears(referenceDate, direction);
}

export function getBuckets(params: ReportParams): Bucket[] {
  const range = getPeriodRange(params);
  const { preset } = params;

  if (preset === "weekly") {
    const buckets: Bucket[] = [];
    for (let i = 0; i < 7; i++) {
      const s = addDays(range.start, i);
      const e = addDays(s, 1);
      buckets.push({ start: s, end: e, label: format(s, "EEE") });
    }
    return buckets;
  }

  if (preset === "custom") {
    const totalDays = differenceInCalendarDays(addDays(range.end, -1), range.start) + 1;
    if (totalDays <= 14) {
      const buckets: Bucket[] = [];
      for (let i = 0; i < totalDays; i++) {
        const s = addDays(range.start, i);
        const e = addDays(s, 1);
        buckets.push({ start: s, end: e, label: format(s, "dd MMM") });
      }
      return buckets.length ? buckets : [{ start: range.start, end: range.end, label: "Period" }];
    }
  }

  if (preset === "monthly" || preset === "salary_cycle" || preset === "custom") {
    const periodEndInclusive = addDays(range.end, -1);
    const firstWeekStart = startOfWeek(range.start, { weekStartsOn: 1 });

    const buckets: Bucket[] = [];
    let cursor = firstWeekStart;
    while (!isBefore(periodEndInclusive, cursor)) {
      const s = cursor;
      const e = addDays(s, 7);
      if (e <= range.start) {
        cursor = e;
        continue;
      }
      if (s >= range.end) break;
      buckets.push({ start: s, end: e, label: `Wk ${format(s, "dd")}` });
      cursor = e;
    }
    return buckets.length ? buckets : [{ start: range.start, end: range.end, label: "Period" }];
  }

  const yearStart = range.start;
  const buckets: Bucket[] = [];
  for (let i = 0; i < 12; i++) {
    const s = addMonths(yearStart, i);
    const e = addMonths(s, 1);
    buckets.push({ start: s, end: e, label: format(s, "MMM") });
  }
  return buckets;
}

function isTxInRange(tx: Transaction, range: DateRange): boolean {
  const d = txDateToDate(tx);
  return d >= range.start && d < range.end;
}

export function computeIncomeExpenseSeries(params: {
  report: ReportParams;
  transactions: Transaction[];
  activeWalletIds: Set<string>;
}): IncomeExpensePoint[] {
  const buckets = getBuckets(params.report);
  const range = getPeriodRange(params.report);

  const points: IncomeExpensePoint[] = buckets.map((b) => ({
    label: b.label,
    incomeInPaise: 0,
    expenseInPaise: 0,
  }));

  const txsInPeriod = params.transactions.filter(
    (tx) => isTxInRange(tx, range) && tx.walletId && params.activeWalletIds.has(tx.walletId)
  );

  for (const tx of txsInPeriod) {
    if (tx.type === "transfer") continue;
    const d = txDateToDate(tx);
    const idx = buckets.findIndex((b) => d >= b.start && d < b.end);
    if (idx < 0) continue;
    if (tx.type === "income") points[idx].incomeInPaise += tx.amountInPaise;
    if (tx.type === "expense") points[idx].expenseInPaise += tx.amountInPaise;
  }

  return points;
}

/** Total liquid balance across active wallets counting every transaction before `date`. */
export function computeBalanceAsOfInPaise(params: {
  wallets: Wallet[];
  transactions: Transaction[];
  date: Date; // exclusive
}): number {
  const activeWallets = params.wallets.filter((w) => !w.archived);
  const txsBefore = params.transactions.filter((tx) => txDateToDate(tx) < params.date);
  return computeTotalBalanceInPaise(activeWallets, txsBefore);
}

export function computeBalanceTrend(params: {
  report: ReportParams;
  wallets: Wallet[];
  transactions: Transaction[];
}): BalanceTrendPoint[] {
  const buckets = getBuckets(params.report);

  return buckets.map((b) => ({
    label: b.label,
    // Closing balance of the bucket, so the last point is the period's closing balance.
    balanceInPaise: computeBalanceAsOfInPaise({
      wallets: params.wallets,
      transactions: params.transactions,
      date: b.end,
    }),
  }));
}

function resolveCategoryForTx(categoryId: string | null, categories: Category[]): { label: string; color: string; iconKey: string } {
  if (!categoryId) return { label: "Uncategorized", color: "#6b7280", iconKey: "expense_other" };
  const c = categories.find((x) => x.id === categoryId);
  if (!c) return { label: "Uncategorized", color: "#6b7280", iconKey: "expense_other" };
  return { label: c.name, color: c.color, iconKey: c.iconKey };
}

export function computeCategoryPieData(params: {
  report: ReportParams;
  transactions: Transaction[];
  categories: Category[];
  kind: "income" | "expense";
  activeWalletIds: Set<string>;
}): CategoryPiePoint[] {
  const range = getPeriodRange(params.report);

  const pointsByCategory = new Map<string | "uncategorized", CategoryPiePoint>();

  for (const tx of params.transactions) {
    if (tx.type === "transfer") continue;
    if (!isTxInRange(tx, range)) continue;
    if (!params.activeWalletIds.has(tx.walletId)) continue;

    const txKind = tx.type === "income" ? "income" : "expense";
    if (txKind !== params.kind) continue;

    const cat = resolveCategoryForTx(tx.categoryId, params.categories);
    const key: string | "uncategorized" = tx.categoryId ?? "uncategorized";

    const existing = pointsByCategory.get(key);
    if (existing) {
      existing.valueInPaise += tx.amountInPaise;
    } else {
      pointsByCategory.set(key, {
        categoryId: key,
        label: cat.label,
        color: cat.color,
        iconKey: cat.iconKey,
        valueInPaise: tx.amountInPaise,
      });
    }
  }

  return Array.from(pointsByCategory.values()).sort((a, b) => b.valueInPaise - a.valueInPaise);
}
