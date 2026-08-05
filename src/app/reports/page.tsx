"use client";

import { format, parseISO } from "date-fns";
import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Cell,
  Label,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChevronLeft, ChevronRight, FileDown } from "lucide-react";
import {
  computeBalanceAsOfInPaise,
  computeBalanceTrend,
  computeCategoryPieData,
  computeIncomeExpenseSeries,
  CustomDateRange,
  getPeriodRange,
  ReportParams,
  ReportPreset,
  shiftReferenceDate,
} from "@/lib/reports";
import { formatINRFromPaise } from "@/lib/money";
import {
  buildReportPdfSection,
  downloadReportPdf,
} from "@/lib/reportPdf";
import { useExpenseStore } from "@/store/expenseStore";
import { FormField, FormInput } from "@/components/FormField";

const reportOptions: Array<{ id: ReportPreset; label: string; title: string }> = [
  { id: "weekly", label: "Week", title: "This Week" },
  { id: "monthly", label: "Month", title: "This Month" },
  { id: "yearly", label: "Year", title: "This Year" },
  { id: "salary_cycle", label: "Salary Cycle", title: "Salary Cycle" },
  { id: "custom", label: "Custom", title: "Custom Range" },
];

function defaultCustomRange(): CustomDateRange {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    start: format(start, "yyyy-MM-dd"),
    end: format(now, "yyyy-MM-dd"),
  };
}

function formatRangeLabel(preset: ReportPreset, range: { start: Date; end: Date }): string {
  const addDaysSafe = (date: Date, days: number) => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
  };

  if (preset === "custom") {
    return `${format(range.start, "dd MMM yyyy")} – ${format(addDaysSafe(range.end, -1), "dd MMM yyyy")}`;
  }
  if (preset === "weekly" || preset === "salary_cycle") {
    return `${format(range.start, "dd MMM")} – ${format(addDaysSafe(range.end, -1), "dd MMM yyyy")}`;
  }
  if (preset === "monthly") {
    return format(range.start, "MMMM yyyy");
  }
  return format(range.start, "yyyy");
}

export default function ReportsPage() {
  const wallets = useExpenseStore((s) => s.wallets);
  const categories = useExpenseStore((s) => s.categories);
  const transactions = useExpenseStore((s) => s.transactions);

  const [preset, setPreset] = useState<ReportPreset>("monthly");
  const [referenceDate, setReferenceDate] = useState(() => new Date());
  const [customRange, setCustomRange] = useState<CustomDateRange>(defaultCustomRange);
  const [pieKind, setPieKind] = useState<"expense" | "income">("expense");
  const [exporting, setExporting] = useState(false);

  const activeWalletIds = useMemo(
    () => new Set(wallets.filter((w) => !w.archived).map((w) => w.id)),
    [wallets]
  );

  const report: ReportParams = useMemo(
    () => ({
      preset,
      referenceDate,
      customRange: preset === "custom" ? customRange : undefined,
    }),
    [preset, referenceDate, customRange]
  );

  const range = getPeriodRange(report);

  const rangeLabel = formatRangeLabel(preset, range);

  const reportTitle = reportOptions.find((option) => option.id === preset)?.title ?? "This Month";

  const series = computeIncomeExpenseSeries({
    report,
    transactions,
    activeWalletIds,
  });

  const balanceTrend = computeBalanceTrend({
    report,
    wallets,
    transactions,
  });

  const expensePie = computeCategoryPieData({
    report,
    transactions,
    categories,
    kind: "expense",
    activeWalletIds,
  });

  const incomePie = computeCategoryPieData({
    report,
    transactions,
    categories,
    kind: "income",
    activeWalletIds,
  });

  const totalIncome = series.reduce((sum, point) => sum + point.incomeInPaise, 0);
  const totalExpense = series.reduce((sum, point) => sum + point.expenseInPaise, 0);
  const netChange = totalIncome - totalExpense;
  const activePie = pieKind === "expense" ? expensePie : incomePie;
  const walletById = useMemo(() => new Map(wallets.map((w) => [w.id, w.name])), [wallets]);
  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);
  const hasSeriesData = series.some(
    (point) => point.incomeInPaise > 0 || point.expenseInPaise > 0
  );

  const shiftPeriod = (direction: -1 | 1) => {
    const shifted = shiftReferenceDate(report, direction);
    if (preset === "custom" && typeof shifted === "object" && "start" in shifted) {
      setCustomRange(shifted);
    } else if (shifted instanceof Date) {
      setReferenceDate(shifted);
    }
  };

  const buildSectionForReport = (params: ReportParams, option: { label: string; title: string }) => {
    const sectionRange = getPeriodRange(params);
    const sectionSeries = computeIncomeExpenseSeries({
      report: params,
      transactions,
      activeWalletIds,
    });
    const sectionBalance = computeBalanceTrend({
      report: params,
      wallets,
      transactions,
    });
    const sectionExpensePie = computeCategoryPieData({
      report: params,
      transactions,
      categories,
      kind: "expense",
      activeWalletIds,
    });
    const sectionIncomePie = computeCategoryPieData({
      report: params,
      transactions,
      categories,
      kind: "income",
      activeWalletIds,
    });
    const txRange = getPeriodRange(params);
    const transactionRows = transactions
      .filter((tx) => {
        const d = parseISO(tx.date);
        return (
          d >= txRange.start &&
          d < txRange.end &&
          (activeWalletIds.has(tx.walletId) || (tx.toWalletId ? activeWalletIds.has(tx.toWalletId) : false))
        );
      })
      .sort((a, b) => (a.date === b.date ? b.updatedAt - a.updatedAt : a.date.localeCompare(b.date)))
      .map((tx) => ({
        date: tx.date,
        type: tx.type,
        note: tx.note,
        category:
          tx.type === "transfer" ? "Transfer" : (tx.categoryId ? categoryById.get(tx.categoryId) : null) ?? "Uncategorized",
        fromWallet: walletById.get(tx.walletId) ?? tx.walletId,
        toWallet: tx.toWalletId ? walletById.get(tx.toWalletId) ?? tx.toWalletId : "",
        amountInPaise: tx.amountInPaise,
      }));

    return buildReportPdfSection({
      presetLabel: option.label,
      title: option.title,
      rangeLabel: formatRangeLabel(params.preset, sectionRange),
      startingBalanceInPaise: computeBalanceAsOfInPaise({
        wallets,
        transactions,
        date: sectionRange.start,
      }),
      series: sectionSeries,
      balanceTrend: sectionBalance,
      expensePie: sectionExpensePie,
      incomePie: sectionIncomePie,
      transactions: transactionRows,
    });
  };

  const handleExportPdf = async () => {
    setExporting(true);
    try {
      const selectedOption = reportOptions.find((option) => option.id === preset);
      const section = buildSectionForReport(report, {
        label: selectedOption?.label ?? "Custom",
        title: selectedOption?.title ?? "Custom Range",
      });
      await downloadReportPdf([section]);
    } catch (error) {
      if (error instanceof Error && error.message.includes("cancelled")) return;
      console.error(error);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-8">
      <header className="page-header flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="page-title">Reports</h1>
          <p className="page-subtitle">Income, expenses, balance trend, and category breakdown.</p>
        </div>

        <div className="flex flex-col items-end gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="btn-secondary"
              disabled={exporting}
              onClick={() => void handleExportPdf()}
            >
              <FileDown size={14} />
              {exporting ? "Exporting…" : "Export PDF"}
            </button>
            <div className="segment-control flex-wrap">
              {reportOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  data-active={preset === option.id}
                  onClick={() => {
                    setPreset(option.id);
                    if (option.id === "custom") {
                      setCustomRange(defaultCustomRange());
                    } else {
                      setReferenceDate(new Date());
                    }
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="btn-secondary !p-2"
                onClick={() => shiftPeriod(-1)}
                aria-label="Previous period"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                className="btn-secondary !p-2"
                onClick={() => shiftPeriod(1)}
                aria-label="Next period"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          {preset === "custom" && (
            <div className="flex flex-wrap items-end gap-3">
              <FormField label="From">
                <FormInput
                  type="date"
                  value={customRange.start}
                  onChange={(e) =>
                    setCustomRange((prev) => ({ ...prev, start: e.target.value }))
                  }
                />
              </FormField>
              <FormField label="To">
                <FormInput
                  type="date"
                  value={customRange.end}
                  min={customRange.start}
                  onChange={(e) =>
                    setCustomRange((prev) => ({ ...prev, end: e.target.value }))
                  }
                />
              </FormField>
            </div>
          )}
        </div>
      </header>

      <div className="flex items-baseline justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{reportTitle}</h2>
          <p className="text-sm text-zinc-500">{rangeLabel}</p>
        </div>
        <div className="text-right">
          <div className="text-xs text-zinc-500">Net change</div>
          <div
            className={[
              "text-lg font-semibold tabular-nums",
              netChange >= 0 ? "text-primary" : "text-destructive",
            ].join(" ")}
          >
            {netChange >= 0 ? "+" : "−"}
            {formatINRFromPaise(Math.abs(netChange))}
          </div>
        </div>
      </div>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="metric-card">
          <div className="stat-label">Income</div>
          <div className="stat-value text-primary">
            {formatINRFromPaise(totalIncome)}
          </div>
        </div>
        <div className="metric-card">
          <div className="stat-label">Expense</div>
          <div className="stat-value text-destructive">
            {formatINRFromPaise(totalExpense)}
          </div>
        </div>
        <div className="metric-card">
          <div className="stat-label">Ending balance</div>
          <div className="stat-value">
            {formatINRFromPaise(balanceTrend[balanceTrend.length - 1]?.balanceInPaise ?? 0)}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <section className="app-card p-5">
          <h3 className="text-sm font-semibold">Income vs expense</h3>
          <p className="mt-1 text-xs text-zinc-500">{rangeLabel}</p>
          <div className="mt-4 h-72">
            {hasSeriesData ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series}>
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
                  <YAxis hide />
                  <Tooltip
                    formatter={(value, name) => [
                      formatINRFromPaise(Number(value)),
                      name === "incomeInPaise" ? "Income" : "Expense",
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey="incomeInPaise"
                    name="Income"
                    stroke="#00d4aa"
                    fill="#00d4aa"
                    fillOpacity={0.12}
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="expenseInPaise"
                    name="Expense"
                    stroke="#f43f5e"
                    fill="#f43f5e"
                    fillOpacity={0.08}
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-zinc-400">
                No data for this period
              </div>
            )}
          </div>
        </section>

        <section className="app-card p-5">
          <h3 className="text-sm font-semibold">Balance trend</h3>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-800">
              <div className="text-xs text-zinc-500">Starting</div>
              <div className="mt-0.5 text-sm font-semibold tabular-nums">
                {formatINRFromPaise(balanceTrend[0]?.balanceInPaise ?? 0)}
              </div>
            </div>
            <div className="rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-800">
              <div className="text-xs text-zinc-500">Ending</div>
              <div className="mt-0.5 text-sm font-semibold tabular-nums">
                {formatINRFromPaise(balanceTrend[balanceTrend.length - 1]?.balanceInPaise ?? 0)}
              </div>
            </div>
          </div>
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={balanceTrend}>
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
                <YAxis hide />
                <Tooltip formatter={(value) => [formatINRFromPaise(Number(value)), "Balance"]} />
                <Line
                  type="monotone"
                  dataKey="balanceInPaise"
                  name="Balance"
                  stroke="#52525b"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <section className="app-card p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold">By category</h3>
            <p className="mt-1 text-xs text-zinc-500">Distribution for selected period</p>
          </div>
          <div className="segment-control">
            <button
              type="button"
              data-active={pieKind === "expense"}
              onClick={() => setPieKind("expense")}
            >
              Expense
            </button>
            <button
              type="button"
              data-active={pieKind === "income"}
              onClick={() => setPieKind("income")}
            >
              Income
            </button>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="mx-auto h-64 w-full max-w-xs">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip
                  formatter={(value, _name, item) => [
                    formatINRFromPaise(Number(value)),
                    item?.payload?.name ?? "Category",
                  ]}
                />
                <Pie
                  data={
                    activePie.length > 0
                      ? activePie.map((item) => ({
                          name: item.label,
                          value: item.valueInPaise,
                          color: item.color,
                        }))
                      : [{ name: "No data", value: 1, color: "#e4e4e7" }]
                  }
                  dataKey="value"
                  nameKey="name"
                  innerRadius="62%"
                  outerRadius="82%"
                  stroke="none"
                >
                  {(activePie.length > 0
                    ? activePie.map((item) => ({ color: item.color, key: item.categoryId }))
                    : [{ color: "#e4e4e7", key: "empty" }]
                  ).map((slice) => (
                    <Cell key={String(slice.key)} fill={slice.color} />
                  ))}
                  <Label
                    position="center"
                    content={() => (
                      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle">
                        <tspan x="50%" dy="-0.6em" fontSize="11" fill="#a1a1aa">
                          Total
                        </tspan>
                        <tspan x="50%" dy="1.6em" fontSize="18" fontWeight="600" fill="currentColor">
                          {formatINRFromPaise(
                            activePie.reduce((sum, item) => sum + item.valueInPaise, 0)
                          )}
                        </tspan>
                      </text>
                    )}
                  />
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>

          <ul className="space-y-2">
            {activePie.length === 0 ? (
              <li className="text-sm text-zinc-500">No category data for this period.</li>
            ) : (
              activePie.map((item) => {
                const total = activePie.reduce((sum, i) => sum + i.valueInPaise, 0);
                const pct = total > 0 ? Math.round((item.valueInPaise / total) * 100) : 0;
                return (
                  <li
                    key={item.categoryId}
                    className="flex items-center justify-between rounded-lg border border-zinc-200 px-3 py-2.5 dark:border-zinc-800"
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-sm font-medium">{item.label}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium tabular-nums">
                        {formatINRFromPaise(item.valueInPaise)}
                      </div>
                      <div className="text-xs text-zinc-500">{pct}%</div>
                    </div>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      </section>
    </div>
  );
}
