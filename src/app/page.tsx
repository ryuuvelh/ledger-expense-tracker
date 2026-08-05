"use client";

import { addMonths, format, parseISO } from "date-fns";
import Link from "next/link";
import { useUiStore } from "@/store/uiStore";
import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TrendingDown, TrendingUp } from "lucide-react";
import { computeTotalBalanceInPaise } from "@/lib/balances";
import { getCurrentMonthRange } from "@/lib/period";
import { formatINRFromPaise } from "@/lib/money";
import IconBadge from "@/components/IconBadge";
import {
  computeCategoryPieData,
  computeIncomeExpenseSeries,
} from "@/lib/reports";
import { useExpenseStore } from "@/store/expenseStore";

function StatCard({
  label,
  value,
  sub,
  trend,
}: {
  label: string;
  value: string;
  sub: string;
  trend?: "up" | "down";
}) {
  return (
    <div className="metric-card">
      <span className="stat-label">{label}</span>
      <span className="stat-value text-foreground">{value}</span>
      <div className="flex items-center gap-1.5">
        {trend === "up" && <TrendingUp size={12} className="text-primary" />}
        {trend === "down" && <TrendingDown size={12} className="text-destructive" />}
        <span className="text-xs font-mono text-muted-foreground">{sub}</span>
      </div>
    </div>
  );
}

/** Compact axis label for paise values: ₹850, ₹12k, ₹1.4L, ₹2.3Cr. */
function formatAxisPaise(paise: number): string {
  const rupees = paise / 100;
  const abs = Math.abs(rupees);
  if (abs >= 10000000) return `₹${(rupees / 10000000).toFixed(1)}Cr`;
  if (abs >= 100000) return `₹${(rupees / 100000).toFixed(1)}L`;
  if (abs >= 1000) return `₹${Math.round(rupees / 1000)}k`;
  return `₹${Math.round(rupees)}`;
}

const ChartTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color?: string; payload?: { color?: string } }>;
  label?: string;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded border border-border bg-popover px-3 py-2 text-xs font-mono shadow-xl">
      {label ? <p className="mb-1 text-muted-foreground">{label}</p> : null}
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color ?? p.payload?.color ?? "currentColor" }}>
          {p.name}: {formatINRFromPaise(p.value)}
        </p>
      ))}
    </div>
  );
};

export default function Home() {
  const openTransactionModal = useUiStore((s) => s.openTransactionModal);
  const wallets = useExpenseStore((s) => s.wallets);
  const categories = useExpenseStore((s) => s.categories);
  const transactions = useExpenseStore((s) => s.transactions);
  const bills = useExpenseStore((s) => s.bills);

  const derived = useMemo(() => {
    const activeWallets = wallets.filter((w) => !w.archived);
    const activeWalletIds = new Set(activeWallets.map((w) => w.id));
    const now = new Date();

    const totalBalanceInPaise = computeTotalBalanceInPaise(wallets, transactions);

    const monthRange = getCurrentMonthRange(now);
    const monthIncomeInPaise = transactions
      .filter((tx) => tx.type === "income" && activeWalletIds.has(tx.walletId))
      .filter((tx) => {
        const d = parseISO(tx.date);
        return d >= monthRange.start && d < monthRange.end;
      })
      .reduce((sum, tx) => sum + tx.amountInPaise, 0);

    const monthExpenseInPaise = transactions
      .filter((tx) => tx.type === "expense" && activeWalletIds.has(tx.walletId))
      .filter((tx) => {
        const d = parseISO(tx.date);
        return d >= monthRange.start && d < monthRange.end;
      })
      .reduce((sum, tx) => sum + tx.amountInPaise, 0);

    const cashFlowSeries = Array.from({ length: 6 }, (_, i) => {
      const ref = addMonths(now, -5 + i);
      const series = computeIncomeExpenseSeries({
        report: { preset: "monthly", referenceDate: ref },
        transactions,
        activeWalletIds,
      });
      const incomeInPaise = series.reduce((sum, p) => sum + p.incomeInPaise, 0);
      const expenseInPaise = series.reduce((sum, p) => sum + p.expenseInPaise, 0);
      return {
        month: format(ref, "MMM"),
        incomeInPaise,
        expenseInPaise,
      };
    });

    const expensePie = computeCategoryPieData({
      report: { preset: "monthly", referenceDate: now },
      transactions,
      categories,
      kind: "expense",
      activeWalletIds,
    });

    const categorySpend = expensePie.map((item) => ({
      id: item.categoryId,
      label: item.label,
      color: item.color,
      iconKey: item.iconKey,
      spentInPaise: item.valueInPaise,
    }));
    const maxSpend = Math.max(...categorySpend.map((c) => c.spentInPaise), 1);

    const todayISO = format(now, "yyyy-MM-dd");
    const upcomingBills = bills
      .filter((b) => b.status !== "paused" && b.endDate >= todayISO)
      .sort((a, b) => a.endDate.localeCompare(b.endDate))
      .slice(0, 5);

    const recentTransactions = [...transactions]
      .sort((a, b) => (a.date === b.date ? b.updatedAt - a.updatedAt : b.date.localeCompare(a.date)))
      .slice(0, 10);

    return {
      activeWalletIds,
      totalBalanceInPaise,
      monthIncomeInPaise,
      monthExpenseInPaise,
      cashFlowSeries,
      expensePie,
      categorySpend,
      maxSpend,
      upcomingBills,
      recentTransactions,
    };
  }, [wallets, transactions, bills, categories]);

  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const walletById = useMemo(() => new Map(wallets.map((w) => [w.id, w])), [wallets]);

  const netMonth = derived.monthIncomeInPaise - derived.monthExpenseInPaise;
  const spendPct =
    derived.monthIncomeInPaise > 0
      ? Math.round((derived.monthExpenseInPaise / derived.monthIncomeInPaise) * 100)
      : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">personal finance overview</p>
        </div>
        <button
          type="button"
          className="btn-primary"
          onClick={() => openTransactionModal({ type: "expense" })}
        >
          Add transaction
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Net balance"
          value={formatINRFromPaise(derived.totalBalanceInPaise)}
          sub={netMonth >= 0 ? "↑ in surplus this month" : "↓ over income this month"}
          trend={netMonth >= 0 ? "up" : "down"}
        />
        <StatCard
          label="Total income"
          value={formatINRFromPaise(derived.monthIncomeInPaise)}
          sub="This month"
          trend="up"
        />
        <StatCard
          label="Total spent"
          value={formatINRFromPaise(derived.monthExpenseInPaise)}
          sub={`${spendPct}% of income`}
          trend="down"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="app-card p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <span className="mono-label">Cash flow — 6 mo</span>
            <div className="flex items-center gap-4 text-xs font-mono">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full bg-primary" />
                Income
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full bg-destructive" />
                Spent
              </span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={derived.cashFlowSeries}>
              <defs>
                <linearGradient id="gIncome" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00d4aa" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#00d4aa" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gSpent" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,212,170,0.08)" />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 10, fontFamily: "var(--font-ledger-mono)", fill: "#64748b" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fontFamily: "var(--font-ledger-mono)", fill: "#64748b" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => formatAxisPaise(Number(v))}
              />
              <Tooltip content={<ChartTooltip />} />
              <Area
                type="monotone"
                dataKey="incomeInPaise"
                name="Income"
                stroke="#00d4aa"
                strokeWidth={1.5}
                fill="url(#gIncome)"
                dot={false}
              />
              <Area
                type="monotone"
                dataKey="expenseInPaise"
                name="Spent"
                stroke="#f43f5e"
                strokeWidth={1.5}
                fill="url(#gSpent)"
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="app-card p-5">
          <span className="mono-label block mb-4">By category</span>
          <ResponsiveContainer width="100%" height={140}>
            <PieChart>
              <Pie
                data={
                  derived.expensePie.length > 0
                    ? derived.expensePie.map((item) => ({
                        name: item.label,
                        value: item.valueInPaise,
                        color: item.color,
                      }))
                    : [{ name: "No data", value: 1, color: "var(--muted)" }]
                }
                cx="50%"
                cy="50%"
                innerRadius={42}
                outerRadius={68}
                paddingAngle={2}
                dataKey="value"
                strokeWidth={0}
              >
                {(derived.expensePie.length > 0
                  ? derived.expensePie
                  : [{ categoryId: "empty", color: "var(--muted)" }]
                ).map((item, i) => (
                  <Cell key={String(item.categoryId) + i} fill={item.color} opacity={0.85} />
                ))}
              </Pie>
              <Tooltip content={<ChartTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-3 space-y-1.5">
            {derived.expensePie.slice(0, 4).map((d) => (
              <div key={d.categoryId} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: d.color }}
                  />
                  <span className="max-w-[90px] truncate text-xs font-mono text-muted-foreground">
                    {d.label}
                  </span>
                </div>
                <span className="text-xs font-mono text-foreground">
                  {formatINRFromPaise(d.valueInPaise)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="app-card p-5 lg:col-span-2">
          <span className="mono-label block mb-4">Category spend</span>
          <div className="space-y-4">
            {derived.categorySpend.length === 0 ? (
              <p className="text-xs font-mono text-muted-foreground">No expenses this month.</p>
            ) : (
              derived.categorySpend.slice(0, 8).map((item) => {
                const pct = Math.min((item.spentInPaise / derived.maxSpend) * 100, 100);
                return (
                  <div key={item.id}>
                    <div className="mb-1.5 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <IconBadge iconKey={item.iconKey} color={item.color} size={12} boxSize={20} />
                        <span className="text-xs font-mono text-foreground">{item.label}</span>
                      </div>
                      <span className="text-xs font-mono text-muted-foreground">
                        {formatINRFromPaise(item.spentInPaise)}
                      </span>
                    </div>
                    <div className="h-1 overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, backgroundColor: item.color, opacity: 0.8 }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {derived.upcomingBills.length > 0 ? (
            <div className="mt-6 border-t border-border pt-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="mono-label">Upcoming bills</span>
                <Link href="/bills" className="btn-ghost">View all</Link>
              </div>
              <ul className="space-y-2">
                {derived.upcomingBills.map((b) => (
                  <li key={b.id} className="flex items-center justify-between text-xs font-mono">
                    <span className="text-muted-foreground truncate">{b.title}</span>
                    <span className="text-destructive">{formatINRFromPaise(b.amountInPaise)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="app-card overflow-hidden lg:col-span-3">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <span className="mono-label">Recent transactions</span>
            <Link href="/transactions" className="btn-ghost">View all</Link>
          </div>
          <div className="max-h-[420px] divide-y divide-border overflow-y-auto">
            {derived.recentTransactions.length === 0 ? (
              <div className="py-12 text-center text-xs font-mono text-muted-foreground">
                No transactions
              </div>
            ) : (
              derived.recentTransactions.map((tx) => {
                const isIncome = tx.type === "income";
                const cat = tx.categoryId ? categoryById.get(tx.categoryId) : null;
                const iconKey =
                  tx.type === "transfer"
                    ? walletById.get(tx.walletId)?.iconKey ?? "cash_wallet"
                    : cat?.iconKey ?? (isIncome ? "income_other" : "expense_other");
                const color = cat?.color ?? "#64748b";
                const amountLabel =
                  tx.type === "transfer"
                    ? formatINRFromPaise(tx.amountInPaise)
                    : isIncome
                      ? `+${formatINRFromPaise(tx.amountInPaise)}`
                      : `−${formatINRFromPaise(tx.amountInPaise)}`;

                return (
                  <div
                    key={tx.id}
                    className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-secondary/30"
                  >
                    <IconBadge iconKey={iconKey} color={color} size={14} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {tx.note || (cat ? cat.name : "Transaction")}
                      </p>
                      <p className="text-xs font-mono text-muted-foreground">
                        {cat?.name ?? tx.type} · {format(parseISO(tx.date), "dd MMM")}
                      </p>
                    </div>
                    <span
                      className={[
                        "shrink-0 text-sm font-mono font-medium",
                        isIncome ? "text-primary" : "text-foreground",
                      ].join(" ")}
                    >
                      {amountLabel}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
