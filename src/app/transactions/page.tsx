"use client";

import { format, parseISO } from "date-fns";
import { useMemo, useState } from "react";
import IconBadge from "@/components/IconBadge";
import { formatINRFromPaise } from "@/lib/money";
import { useExpenseStore } from "@/store/expenseStore";
import { useUiStore } from "@/store/uiStore";
import { TransactionFormType } from "@/lib/transactionForm";

export default function TransactionsPage() {
  const wallets = useExpenseStore((s) => s.wallets);
  const categories = useExpenseStore((s) => s.categories);
  const transactions = useExpenseStore((s) => s.transactions);
  const deleteTransaction = useExpenseStore((s) => s.deleteTransaction);
  const openTransactionModal = useUiStore((s) => s.openTransactionModal);

  const [typeFilter, setTypeFilter] = useState<"all" | "income" | "expense" | "transfer">("all");
  const [query, setQuery] = useState("");

  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const walletById = useMemo(() => new Map(wallets.map((w) => [w.id, w])), [wallets]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...transactions]
      .sort((a, b) => (a.date === b.date ? b.updatedAt - a.updatedAt : b.date.localeCompare(a.date)))
      .filter((tx) => (typeFilter === "all" ? true : tx.type === typeFilter))
      .filter((tx) => {
        if (!q) return true;
        const cat = tx.categoryId ? categoryById.get(tx.categoryId)?.name ?? "" : "";
        const walletName = walletById.get(tx.walletId)?.name ?? "";
        const toWalletName = tx.toWalletId ? walletById.get(tx.toWalletId)?.name ?? "" : "";
        const note = tx.note ?? "";
        return [cat, walletName, toWalletName, note, tx.type].some((s) => s.toLowerCase().includes(q));
      });
  }, [transactions, typeFilter, query, categoryById, walletById]);

  const onDelete = async (txId: string) => {
    const { appConfirm } = await import("@/lib/appDialog");
    const ok = await appConfirm("Delete this transaction?");
    if (!ok) return;
    await deleteTransaction(txId);
  };

  const openCreate = (type: TransactionFormType) => {
    openTransactionModal({ type });
  };

  return (
    <div className="space-y-8">
      <header className="page-header flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="page-title">Transactions</h1>
          <p className="page-subtitle">Income, expenses, and wallet transfers.</p>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
          <button className="btn-primary w-full sm:w-auto" onClick={() => openCreate("income")} type="button">
            Add income
          </button>
          <button className="btn-secondary w-full sm:w-auto" onClick={() => openCreate("expense")} type="button">
            Add expense
          </button>
          <button className="btn-secondary w-full sm:w-auto" onClick={() => openCreate("transfer")} type="button">
            Transfer
          </button>
        </div>
      </header>

      <section className="app-card p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by note, category, wallet..."
            className="input-field lg:max-w-sm"
          />
          <div className="segment-control w-full overflow-x-auto lg:w-auto">
            {(["all", "income", "expense", "transfer"] as const).map((filter) => (
              <button
                key={filter}
                type="button"
                data-active={typeFilter === filter}
                onClick={() => setTypeFilter(filter)}
                className="capitalize"
              >
                {filter}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-3 md:hidden">
        {filtered.length === 0 ? (
          <div className="app-card px-5 py-12 text-center text-sm text-muted-foreground">No transactions found.</div>
        ) : (
          filtered.map((tx) => {
            const cat = tx.categoryId ? categoryById.get(tx.categoryId) ?? null : null;
            const wallet = walletById.get(tx.walletId);
            const toWallet = tx.toWalletId ? walletById.get(tx.toWalletId) : null;
            const iconKey =
              tx.type === "transfer" ? wallet?.iconKey ?? "cash_wallet" : cat?.iconKey ?? "expense_other";
            const iconColor = cat?.color ?? wallet?.color ?? "#00d4aa";
            const amountLabel =
              tx.type === "transfer"
                ? formatINRFromPaise(tx.amountInPaise)
                : tx.type === "income"
                  ? `+${formatINRFromPaise(tx.amountInPaise)}`
                  : `-${formatINRFromPaise(tx.amountInPaise)}`;
            const amountClass =
              tx.type === "income"
                ? "text-primary"
                : tx.type === "expense"
                  ? "text-destructive"
                  : "text-foreground";

            return (
              <article key={tx.id} className="app-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-2.5">
                    <IconBadge iconKey={iconKey} color={iconColor} />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">
                        {tx.note || (cat ? cat.name : tx.type === "transfer" ? "Transfer" : "Transaction")}
                      </div>
                      <div className="mt-1 text-xs font-mono text-muted-foreground">
                        {format(parseISO(tx.date), "dd MMM yyyy")} · {tx.type}
                      </div>
                    </div>
                  </div>
                  <div className={`shrink-0 text-sm font-semibold tabular-nums ${amountClass}`}>{amountLabel}</div>
                </div>

                <div className="mt-3 text-xs font-mono text-muted-foreground">
                  {tx.type === "transfer"
                    ? `${wallet?.name ?? "?"} → ${toWallet?.name ?? "?"}`
                    : `${cat?.name ?? "Uncategorized"} · ${wallet?.name ?? "—"}`}
                </div>

                <div className="mt-3 flex justify-end gap-1">
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => openTransactionModal({ editId: tx.id })}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn-ghost text-destructive"
                    onClick={() => void onDelete(tx.id)}
                  >
                    Delete
                  </button>
                </div>
              </article>
            );
          })
        )}
      </section>

      <section className="app-card hidden overflow-x-auto md:block">
        {filtered.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-muted-foreground">No transactions found.</div>
        ) : (
          <table className="data-table min-w-[800px]">
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Type</th>
                <th>Category / Route</th>
                <th>Wallet</th>
                <th className="text-right">Amount</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((tx) => {
                const cat = tx.categoryId ? categoryById.get(tx.categoryId) ?? null : null;
                const wallet = walletById.get(tx.walletId);
                const toWallet = tx.toWalletId ? walletById.get(tx.toWalletId) : null;
                const iconKey =
                  tx.type === "transfer" ? wallet?.iconKey ?? "cash_wallet" : cat?.iconKey ?? "expense_other";
                const iconColor = cat?.color ?? wallet?.color ?? "#00d4aa";
                const amountLabel =
                  tx.type === "transfer"
                    ? formatINRFromPaise(tx.amountInPaise)
                    : tx.type === "income"
                      ? `+${formatINRFromPaise(tx.amountInPaise)}`
                      : `-${formatINRFromPaise(tx.amountInPaise)}`;
                const amountClass =
                  tx.type === "income"
                    ? "text-primary"
                    : tx.type === "expense"
                      ? "text-destructive"
                      : "text-foreground";

                return (
                  <tr key={tx.id}>
                    <td className="whitespace-nowrap font-mono text-muted-foreground">
                      {format(parseISO(tx.date), "dd MMM yyyy")}
                    </td>
                    <td>
                      <div className="flex items-center gap-2.5">
                        <IconBadge iconKey={iconKey} color={iconColor} />
                        <span className="font-medium">
                          {tx.note || (cat ? cat.name : tx.type === "transfer" ? "Transfer" : "Transaction")}
                        </span>
                      </div>
                    </td>
                    <td className="capitalize text-muted-foreground">{tx.type}</td>
                    <td className="text-muted-foreground">
                      {tx.type === "transfer"
                        ? `${wallet?.name ?? "?"} → ${toWallet?.name ?? "?"}`
                        : cat?.name ?? "—"}
                    </td>
                    <td className="text-muted-foreground">{wallet?.name ?? "—"}</td>
                    <td className={`text-right font-medium tabular-nums ${amountClass}`}>{amountLabel}</td>
                    <td className="text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          className="btn-ghost"
                          onClick={() => openTransactionModal({ editId: tx.id })}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn-ghost text-destructive"
                          onClick={() => void onDelete(tx.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
