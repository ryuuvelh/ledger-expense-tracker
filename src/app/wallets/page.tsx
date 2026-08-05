"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import IconBadge from "@/components/IconBadge";
import ColorPalettePicker from "@/components/ColorPalettePicker";
import { FormField, FormInput, FormRow, FormSelect } from "@/components/FormField";
import { COLOR_PALETTE } from "@/lib/colorPalette";
import { formatINRFromPaise, isValidINRInput, parseINRToPaise } from "@/lib/money";
import {
  computeAllWalletBalancesInPaise,
  computeCardAvailableInPaise,
  computeCardUsedInPaise,
} from "@/lib/balances";
import { Wallet, WalletType } from "@/lib/types";
import { useExpenseStore } from "@/store/expenseStore";
import Modal from "@/components/Modal";

const walletSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().min(1, "Name is required"),
    type: z.enum(["cash", "bank", "card"] as [WalletType, WalletType, WalletType]),
    iconKey: z.string().min(1),
    color: z.string().min(1),
    archived: z.boolean().optional(),
    openingBalance: z.string().optional(),
    creditLimit: z.string().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.type === "cash" || val.type === "bank") {
      if (!val.openingBalance?.trim()) {
        ctx.addIssue({ code: "custom", message: "Opening balance is required", path: ["openingBalance"] });
      } else if (!isValidINRInput(val.openingBalance)) {
        ctx.addIssue({ code: "custom", message: "Enter a valid amount", path: ["openingBalance"] });
      }
    }
    if (val.type === "card") {
      if (!val.creditLimit?.trim()) {
        ctx.addIssue({ code: "custom", message: "Credit limit is required", path: ["creditLimit"] });
      } else if (!isValidINRInput(val.creditLimit)) {
        ctx.addIssue({ code: "custom", message: "Enter a valid amount", path: ["creditLimit"] });
      } else if (parseINRToPaise(val.creditLimit) <= 0) {
        ctx.addIssue({ code: "custom", message: "Limit must be greater than zero", path: ["creditLimit"] });
      }
    }
  });

type WalletFormValues = z.infer<typeof walletSchema>;

const iconKeyByWalletType: Record<WalletType, string> = {
  cash: "cash_wallet",
  bank: "bank_landmark",
  card: "card_credit",
};

function WalletActions({
  walletId,
  onEdit,
  onDelete,
}: {
  walletId: string;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="flex justify-end gap-1">
      <button type="button" className="btn-ghost" onClick={() => onEdit(walletId)}>
        Edit
      </button>
      <button
        type="button"
        className="btn-ghost text-rose-600"
        onClick={() => void onDelete(walletId)}
      >
        Delete
      </button>
    </div>
  );
}

function WalletTable({
  wallets,
  transactions,
  onEdit,
  onDelete,
  variant,
}: {
  wallets: Wallet[];
  transactions: ReturnType<typeof useExpenseStore.getState>["transactions"];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  variant: "liquid" | "card";
}) {
  const balances = useMemo(
    () => computeAllWalletBalancesInPaise(wallets, transactions),
    [wallets, transactions]
  );

  if (wallets.length === 0) return null;

  return (
    <>
      <div className="space-y-3 p-3 md:hidden">
        {variant === "card"
          ? wallets.map((w) => {
              const used = computeCardUsedInPaise(w, transactions);
              const available = computeCardAvailableInPaise(w, transactions);
              const limit = w.creditLimitInPaise ?? 0;
              const usedPct = limit > 0 ? Math.round((used / limit) * 100) : 0;

              return (
                <article key={w.id} className="rounded-lg border border-border bg-secondary/30 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <IconBadge iconKey={w.iconKey} color={w.color} />
                      <div className="min-w-0">
                        <div className="truncate font-medium">{w.name}</div>
                        <div className="mt-1.5 h-1.5 w-28 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary transition-all"
                            style={{ width: `${Math.min(usedPct, 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                    <WalletActions walletId={w.id} onEdit={onEdit} onDelete={onDelete} />
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Limit</div>
                      <div className="mt-0.5 tabular-nums">{formatINRFromPaise(limit)}</div>
                    </div>
                    <div>
                      <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Used</div>
                      <div className="mt-0.5 tabular-nums text-destructive">{formatINRFromPaise(used)}</div>
                    </div>
                    <div>
                      <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Available</div>
                      <div className="mt-0.5 font-medium tabular-nums">{formatINRFromPaise(available)}</div>
                    </div>
                  </div>
                </article>
              );
            })
          : wallets.map((w) => (
              <article key={w.id} className="rounded-lg border border-border bg-secondary/30 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <IconBadge iconKey={w.iconKey} color={w.color} />
                    <div className="min-w-0">
                      <div className="truncate font-medium">{w.name}</div>
                      <div className="mt-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                        {w.type}
                      </div>
                    </div>
                  </div>
                  <WalletActions walletId={w.id} onEdit={onEdit} onDelete={onDelete} />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Opening</div>
                    <div className="mt-0.5 tabular-nums text-muted-foreground">
                      {formatINRFromPaise(w.openingBalanceInPaise)}
                    </div>
                  </div>
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Balance</div>
                    <div className="mt-0.5 font-medium tabular-nums">{formatINRFromPaise(balances[w.id] ?? 0)}</div>
                  </div>
                </div>
              </article>
            ))}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="data-table table-fixed min-w-[720px]">
          <colgroup>
            <col className="w-[36%]" />
            <col className="w-[14%]" />
            <col className="w-[16%]" />
            <col className="w-[16%]" />
            <col className="w-[18%]" />
          </colgroup>
          <thead>
            <tr>
              <th>{variant === "card" ? "Card" : "Wallet"}</th>
              <th className="text-right">{variant === "card" ? "Limit" : "Type"}</th>
              <th className="text-right">{variant === "card" ? "Used" : "Opening"}</th>
              <th className="text-right">{variant === "card" ? "Available" : "Balance"}</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {variant === "card"
              ? wallets.map((w) => {
                  const used = computeCardUsedInPaise(w, transactions);
                  const available = computeCardAvailableInPaise(w, transactions);
                  const limit = w.creditLimitInPaise ?? 0;
                  const usedPct = limit > 0 ? Math.round((used / limit) * 100) : 0;

                  return (
                    <tr key={w.id}>
                      <td>
                        <div className="flex min-w-0 items-center gap-3">
                          <IconBadge iconKey={w.iconKey} color={w.color} />
                          <div className="min-w-0">
                            <div className="truncate font-medium">{w.name}</div>
                            <div className="mt-1.5 h-1.5 w-full max-w-[7rem] overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full rounded-full bg-primary transition-all"
                                style={{ width: `${Math.min(usedPct, 100)}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="text-right tabular-nums text-muted-foreground">
                        {formatINRFromPaise(limit)}
                      </td>
                      <td className="text-right tabular-nums text-destructive">
                        {formatINRFromPaise(used)}
                      </td>
                      <td className="text-right font-medium tabular-nums">
                        {formatINRFromPaise(available)}
                      </td>
                      <td className="text-right">
                        <WalletActions walletId={w.id} onEdit={onEdit} onDelete={onDelete} />
                      </td>
                    </tr>
                  );
                })
              : wallets.map((w) => (
                  <tr key={w.id}>
                    <td>
                      <div className="flex min-w-0 items-center gap-3">
                        <IconBadge iconKey={w.iconKey} color={w.color} />
                        <span className="truncate font-medium">{w.name}</span>
                      </div>
                    </td>
                    <td className="text-right font-mono text-xs uppercase tracking-[0.08em] text-muted-foreground">
                      {w.type}
                    </td>
                    <td className="text-right tabular-nums text-muted-foreground">
                      {formatINRFromPaise(w.openingBalanceInPaise)}
                    </td>
                    <td className="text-right font-medium tabular-nums">
                      {formatINRFromPaise(balances[w.id] ?? 0)}
                    </td>
                    <td className="text-right">
                      <WalletActions walletId={w.id} onEdit={onEdit} onDelete={onDelete} />
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default function WalletsPage() {
  const wallets = useExpenseStore((s) => s.wallets);
  const transactions = useExpenseStore((s) => s.transactions);
  const upsertWallet = useExpenseStore((s) => s.upsertWallet);
  const deleteWallet = useExpenseStore((s) => s.deleteWallet);

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const activeWallets = useMemo(() => wallets.filter((w) => !w.archived), [wallets]);
  const archivedWallets = useMemo(() => wallets.filter((w) => w.archived), [wallets]);
  const liquidWallets = useMemo(
    () => activeWallets.filter((w) => w.type !== "card"),
    [activeWallets]
  );
  const cardWallets = useMemo(
    () => activeWallets.filter((w) => w.type === "card"),
    [activeWallets]
  );

  const form = useForm<WalletFormValues>({
    resolver: zodResolver(walletSchema),
    defaultValues: {
      name: "",
      type: "bank",
      iconKey: "bank_landmark",
      color: COLOR_PALETTE[1],
      archived: false,
      openingBalance: "0",
      creditLimit: "",
    },
  });

  const control = form.control;
  const walletType = useWatch({ control, name: "type" });
  const watchedName = useWatch({ control, name: "name" });
  const watchedIconKey = useWatch({ control, name: "iconKey" });
  const watchedColor = useWatch({ control, name: "color" });

  const openCreate = (type: WalletType = "bank") => {
    setMode("create");
    setEditingId(null);
    form.reset({
      name: "",
      type,
      iconKey: iconKeyByWalletType[type],
      color: COLOR_PALETTE[1],
      archived: false,
      openingBalance: type !== "card" ? "0" : "",
      creditLimit: "",
    });
    setOpen(true);
  };

  const openEdit = (walletId: string) => {
    const w = wallets.find((x) => x.id === walletId);
    if (!w) return;
    setMode("edit");
    setEditingId(walletId);
    form.reset({
      id: w.id,
      name: w.name,
      type: w.type,
      iconKey: w.iconKey,
      color: w.color,
      archived: w.archived,
      openingBalance:
        w.type !== "card"
          ? String((w.openingBalanceInPaise / 100).toFixed(2))
          : "",
      creditLimit:
        w.type === "card" && w.creditLimitInPaise != null
          ? String((w.creditLimitInPaise / 100).toFixed(2))
          : "",
    });
    setOpen(true);
  };

  const onSubmit = async (values: WalletFormValues) => {
    await upsertWallet({
      id: mode === "edit" ? editingId ?? undefined : undefined,
      name: values.name,
      type: values.type,
      iconKey: values.iconKey || iconKeyByWalletType[values.type],
      color: values.color,
      archived: values.archived ?? false,
      openingBalanceInPaise:
        values.type !== "card" ? parseINRToPaise(values.openingBalance ?? "0") : 0,
      creditLimitInPaise:
        values.type === "card" ? parseINRToPaise(values.creditLimit ?? "0") : null,
    });
    setOpen(false);
    setEditingId(null);
  };

  const onUnarchive = async (walletId: string) => {
    const w = wallets.find((x) => x.id === walletId);
    if (!w) return;
    await upsertWallet({
      id: w.id,
      name: w.name,
      type: w.type,
      iconKey: w.iconKey,
      color: w.color,
      archived: false,
      openingBalanceInPaise: w.openingBalanceInPaise,
      creditLimitInPaise: w.creditLimitInPaise,
    });
  };

  const onDelete = async (walletId: string) => {
    const wallet = wallets.find((w) => w.id === walletId);
    const owned = transactions.filter((tx) => tx.walletId === walletId).length;
    const inbound = transactions.filter((tx) => tx.toWalletId === walletId).length;

    const lines = [`Delete ${wallet?.name ?? "this wallet"}?`];
    if (owned > 0) {
      lines.push(`${owned} transaction${owned === 1 ? "" : "s"} on it will be deleted.`);
    }
    if (inbound > 0) {
      lines.push(
        `${inbound} transfer${inbound === 1 ? "" : "s"} into it will be kept as expenses from the source wallet.`
      );
    }
    lines.push("This cannot be undone.");

    const { appConfirm } = await import("@/lib/appDialog");
    const ok = await appConfirm(lines.join(" "));
    if (!ok) return;
    await deleteWallet(walletId);
  };

  const iconOptions = useMemo(
    () => ({
      cash: [{ iconKey: "cash_wallet", label: "Cash Wallet" }],
      bank: [{ iconKey: "bank_landmark", label: "Bank Account" }],
      card: [{ iconKey: "card_credit", label: "Credit Card" }],
    }),
    []
  );

  return (
    <div className="space-y-8">
      <header className="page-header flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="page-title">Wallets</h1>
          <p className="page-subtitle">Bank accounts, cash, and credit cards.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary" type="button" onClick={() => openCreate("bank")}>
            Add bank
          </button>
          <button className="btn-secondary" type="button" onClick={() => openCreate("card")}>
            Add card
          </button>
          <button className="btn-primary" type="button" onClick={() => openCreate("cash")}>
            Add cash
          </button>
        </div>
      </header>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold tracking-tight">Accounts &amp; cash</h2>
        <div className="app-card overflow-hidden">
          {liquidWallets.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-muted-foreground">
              No bank accounts or cash wallets yet.
            </div>
          ) : (
            <WalletTable
              wallets={liquidWallets}
              transactions={transactions}
              onEdit={openEdit}
              onDelete={onDelete}
              variant="liquid"
            />
          )}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold tracking-tight">Credit cards</h2>
        <div className="app-card overflow-hidden">
          {cardWallets.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-muted-foreground">
              No credit cards yet.
            </div>
          ) : (
            <WalletTable
              wallets={cardWallets}
              transactions={transactions}
              onEdit={openEdit}
              onDelete={onDelete}
              variant="card"
            />
          )}
        </div>
      </section>

      {archivedWallets.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold tracking-tight">
              Archived ({archivedWallets.length})
            </h2>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setShowArchived((v) => !v)}
            >
              {showArchived ? "Hide" : "Show"}
            </button>
          </div>
          {showArchived && (
            <div className="app-card overflow-hidden">
              <ul className="divide-y divide-border">
                {archivedWallets.map((w) => (
                  <li key={w.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <IconBadge iconKey={w.iconKey} color={w.color} />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{w.name}</div>
                        <div className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                          {w.type} · excluded from dashboard and reports
                        </div>
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => void onUnarchive(w.id)}
                      >
                        Unarchive
                      </button>
                      <button type="button" className="btn-ghost" onClick={() => openEdit(w.id)}>
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn-ghost text-rose-600"
                        onClick={() => void onDelete(w.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      <Modal
        open={open}
        title={mode === "edit" ? "Edit Wallet" : "Add Wallet"}
        onClose={() => setOpen(false)}
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button type="submit" form="wallet_form" className="btn-primary">
              Save
            </button>
          </>
        }
      >
        <form id="wallet_form" className="space-y-4" onSubmit={form.handleSubmit((v) => void onSubmit(v))}>
          <FormField label="Name" error={form.formState.errors.name?.message}>
            <FormInput {...form.register("name")} placeholder="Wallet name" />
          </FormField>

          <FormRow>
            <FormField label="Type">
              <FormSelect
                {...form.register("type", {
                  onChange: (e) => {
                    const type = e.target.value as WalletType;
                    form.setValue("iconKey", iconKeyByWalletType[type]);
                  },
                })}
              >
                <option value="cash">Cash</option>
                <option value="bank">Bank</option>
                <option value="card">Credit card</option>
              </FormSelect>
            </FormField>
            <FormField label="Icon">
              <FormSelect {...form.register("iconKey")}>
                {(iconOptions[walletType] ?? []).map((opt) => (
                  <option key={opt.iconKey} value={opt.iconKey}>
                    {opt.label}
                  </option>
                ))}
              </FormSelect>
            </FormField>
          </FormRow>

          <FormField label="Color">
            <ColorPalettePicker
              value={watchedColor || COLOR_PALETTE[0]}
              onChange={(color) => form.setValue("color", color, { shouldValidate: true })}
            />
          </FormField>

          {(walletType === "cash" || walletType === "bank") && (
            <FormField label="Opening balance" error={form.formState.errors.openingBalance?.message}>
              <FormInput {...form.register("openingBalance")} placeholder="0.00" />
            </FormField>
          )}

          {walletType === "card" && (
            <FormField label="Credit limit" error={form.formState.errors.creditLimit?.message}>
              <FormInput {...form.register("creditLimit")} placeholder="e.g. 40000" />
            </FormField>
          )}

          <div className="flex items-center gap-3">
            <IconBadge
              iconKey={watchedIconKey}
              color={watchedColor || COLOR_PALETTE[0]}
              size={18}
              boxSize={40}
            />
            <span className="text-sm font-medium">{watchedName || "Preview"}</span>
          </div>

          <label className="flex items-center gap-2 text-sm font-mono text-muted-foreground">
            <input
              type="checkbox"
              className="rounded border-border bg-input-background text-primary focus:ring-ring"
              {...form.register("archived")}
            />
            Archived (hide from dashboard and reports)
          </label>
        </form>
      </Modal>
    </div>
  );
}
