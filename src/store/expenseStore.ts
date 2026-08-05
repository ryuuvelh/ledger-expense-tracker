"use client";

import { create } from "zustand";
import { db } from "@/lib/db";
import { ensureSeed } from "@/lib/seed";
import { Bill, Category, Transaction, Wallet } from "@/lib/types";
import { nanoid } from "nanoid";
import { addDays, addMonths, addYears, format, parseISO } from "date-fns";

function shiftByDuration(dateISO: string, value: number, unit: "days" | "months" | "years"): string {
  const base = parseISO(dateISO);
  if (unit === "days") return format(addDays(base, value), "yyyy-MM-dd");
  if (unit === "months") return format(addMonths(base, value), "yyyy-MM-dd");
  return format(addYears(base, value), "yyyy-MM-dd");
}

/**
 * Next due date for a recurring bill after a payment. Rolls forward whole cycles so a
 * late payment still lands on a future date instead of leaving the due date in the past.
 */
function nextDueAfter(bill: Bill, paidDate: string): string {
  const step = Math.max(1, bill.durationValue);
  let due = shiftByDuration(bill.endDate, step, bill.durationUnit);
  for (let guard = 0; guard < 1000 && due <= paidDate; guard++) {
    due = shiftByDuration(due, step, bill.durationUnit);
  }
  return due;
}

type StoreState = {
  loaded: boolean;
  loading: boolean;
  loadError: string | null;

  wallets: Wallet[];
  categories: Category[];
  transactions: Transaction[];
  bills: Bill[];
};

type StoreActions = {
  loadAll: (options?: { force?: boolean }) => Promise<void>;

  upsertWallet: (input: Omit<Wallet, "id" | "createdAt" | "updatedAt"> & { id?: string }) => Promise<void>;
  deleteWallet: (walletId: string) => Promise<void>;

  upsertCategory: (
    input: Omit<Category, "id" | "createdAt" | "updatedAt"> & { id?: string }
  ) => Promise<void>;
  deleteCategory: (categoryId: string) => Promise<void>;

  upsertBill: (input: Omit<Bill, "id" | "createdAt" | "updatedAt"> & { id?: string }) => Promise<void>;
  deleteBill: (billId: string) => Promise<void>;
  markBillPaid: (input: {
    billId: string;
    walletId: string;
    paidDate: string;
    categoryId?: string | null;
  }) => Promise<void>;

  upsertTransaction: (
    input: Omit<Transaction, "id" | "createdAt" | "updatedAt"> & { id?: string }
  ) => Promise<void>;
  deleteTransaction: (transactionId: string) => Promise<void>;
};

export const useExpenseStore = create<StoreState & StoreActions>((set, get) => ({
  loaded: false,
  loading: false,
  loadError: null,

  wallets: [],
  categories: [],
  transactions: [],
  bills: [],

  async loadAll(options) {
    if (!options?.force && (get().loaded || get().loading)) return;
    // Keep `loaded` true during force refresh so the UI doesn't remount into a blank Loading screen.
    set({ loading: true, loadError: null });
    try {
      if (!options?.force) {
        await ensureSeed();
      }
      const [wallets, categories, transactions, bills] = await Promise.all([
        db.wallets.toArray(),
        db.categories.toArray(),
        db.transactions.orderBy("date").toArray(),
        db.bills.orderBy("endDate").toArray(),
      ]);

      set({
        wallets: wallets.sort((a, b) => b.updatedAt - a.updatedAt),
        categories: categories.sort((a, b) => b.updatedAt - a.updatedAt),
        transactions,
        bills,
        loaded: true,
        loading: false,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to load data";
      set({ loadError: message, loading: false, loaded: get().loaded });
    }
  },

  async upsertWallet(input) {
    const id = input.id ?? nanoid();
    const t = Date.now();

    const wallet: Wallet = {
      id,
      name: input.name,
      type: input.type,
      iconKey: input.iconKey,
      color: input.color,
      archived: input.archived,
      openingBalanceInPaise: input.openingBalanceInPaise,
      creditLimitInPaise: input.creditLimitInPaise,
      createdAt: input.id ? (get().wallets.find((w) => w.id === id)?.createdAt ?? t) : t,
      updatedAt: t,
    };

    await db.wallets.put(wallet);

    set({
      wallets: input.id
        ? get().wallets.map((w) => (w.id === id ? wallet : w))
        : [wallet, ...get().wallets],
    });
  },

  async deleteWallet(walletId) {
    const t = Date.now();

    await db.transaction("rw", db.wallets, db.transactions, async () => {
      await db.wallets.delete(walletId);
      // Transactions belonging to the wallet go with it.
      await db.transactions.where("walletId").equals(walletId).delete();

      // A transfer *into* this wallet still moved money out of the source wallet. Keeping
      // it as an expense preserves the source balance instead of silently crediting it back.
      const inbound = await db.transactions.where("toWalletId").equals(walletId).toArray();
      if (inbound.length) {
        await db.transactions.bulkPut(
          inbound.map((tx) => ({ ...tx, type: "expense" as const, toWalletId: null, updatedAt: t }))
        );
      }
    });

    set({
      wallets: get().wallets.filter((w) => w.id !== walletId),
      transactions: get()
        .transactions.filter((tx) => tx.walletId !== walletId)
        .map((tx) =>
          tx.toWalletId === walletId
            ? { ...tx, type: "expense" as const, toWalletId: null, updatedAt: t }
            : tx
        ),
    });
  },

  async upsertCategory(input) {
    const id = input.id ?? nanoid();
    const t = Date.now();

    const category: Category = {
      id,
      name: input.name,
      kind: input.kind,
      iconKey: input.iconKey,
      color: input.color,
      system: input.system,
      createdAt: input.id ? (get().categories.find((c) => c.id === id)?.createdAt ?? t) : t,
      updatedAt: t,
    };

    await db.categories.put(category);

    set({
      categories: input.id
        ? get().categories.map((c) => (c.id === id ? category : c))
        : [category, ...get().categories],
    });
  },

  async deleteCategory(categoryId) {
    const t = Date.now();

    await db.transaction("rw", db.categories, db.transactions, async () => {
      await db.categories.delete(categoryId);
      // Losing a label must not lose the spending: uncategorise instead of deleting.
      const affected = await db.transactions.where("categoryId").equals(categoryId).toArray();
      if (affected.length) {
        await db.transactions.bulkPut(
          affected.map((tx) => ({ ...tx, categoryId: null, updatedAt: t }))
        );
      }
    });

    set({
      categories: get().categories.filter((c) => c.id !== categoryId),
      transactions: get().transactions.map((tx) =>
        tx.categoryId === categoryId ? { ...tx, categoryId: null, updatedAt: t } : tx
      ),
    });
  },

  async upsertBill(input) {
    const id = input.id ?? nanoid();
    const t = Date.now();

    const bill: Bill = {
      id,
      title: input.title,
      amountInPaise: input.amountInPaise,
      boughtDate: input.boughtDate,
      endDate: input.endDate,
      lastPaidDate: input.lastPaidDate,
      billingCycle: input.billingCycle,
      durationValue: input.durationValue,
      durationUnit: input.durationUnit,
      billType: input.billType,
      status: input.status,
      createdAt: input.id ? (get().bills.find((b) => b.id === id)?.createdAt ?? t) : t,
      updatedAt: t,
    };

    await db.bills.put(bill);

    set({
      bills: input.id ? get().bills.map((b) => (b.id === id ? bill : b)) : [bill, ...get().bills],
    });
  },

  async deleteBill(billId) {
    const t = Date.now();

    await db.transaction("rw", db.bills, db.transactions, async () => {
      await db.bills.delete(billId);
      // billId isn't indexed, so scan; payments stay, they just stop pointing at a ghost.
      const linked = await db.transactions.filter((tx) => tx.billId === billId).toArray();
      if (linked.length) {
        await db.transactions.bulkPut(linked.map((tx) => ({ ...tx, billId: null, updatedAt: t })));
      }
    });

    set({
      bills: get().bills.filter((b) => b.id !== billId),
      transactions: get().transactions.map((tx) =>
        tx.billId === billId ? { ...tx, billId: null, updatedAt: t } : tx
      ),
    });
  },

  async markBillPaid(input) {
    const bill = get().bills.find((b) => b.id === input.billId);
    if (!bill) return;

    if (bill.billingCycle === "one_time" && bill.lastPaidDate) {
      throw new Error("This one-time bill is already paid.");
    }

    if (bill.billingCycle === "recurring" && bill.lastPaidDate) {
      const nextEligible = shiftByDuration(
        bill.lastPaidDate,
        bill.durationValue,
        bill.durationUnit
      );
      if (input.paidDate < nextEligible) throw new Error("This recurring bill is already paid for this cycle.");
    }

    const t = Date.now();
    const txId = nanoid();
    const transaction: Transaction = {
      id: txId,
      type: "expense",
      amountInPaise: bill.amountInPaise,
      date: input.paidDate,
      note: `Bill payment: ${bill.title}`,
      categoryId: input.categoryId ?? null,
      walletId: input.walletId,
      toWalletId: null,
      billId: bill.id,
      createdAt: t,
      updatedAt: t,
    };

    const updatedBill: Bill = {
      ...bill,
      status: "active",
      lastPaidDate: input.paidDate,
      endDate: bill.billingCycle === "recurring" ? nextDueAfter(bill, input.paidDate) : bill.endDate,
      updatedAt: t,
    };

    await db.transaction("rw", db.transactions, db.bills, async () => {
      await db.transactions.put(transaction);
      await db.bills.put(updatedBill);
    });

    set({
      transactions: [transaction, ...get().transactions],
      bills: get().bills.map((b) => (b.id === bill.id ? updatedBill : b)),
    });
  },

  async upsertTransaction(input) {
    const id = input.id ?? nanoid();
    const t = Date.now();

    const tx: Transaction = {
      id,
      type: input.type,
      amountInPaise: input.amountInPaise,
      date: input.date,
      note: input.note,
      categoryId: input.categoryId ?? null,
      walletId: input.walletId,
      toWalletId: input.toWalletId ?? null,
      billId: input.billId ?? null,
      createdAt: input.id ? (get().transactions.find((x) => x.id === id)?.createdAt ?? t) : t,
      updatedAt: t,
    };

    await db.transactions.put(tx);

    set({
      transactions: input.id ? get().transactions.map((x) => (x.id === id ? tx : x)) : [tx, ...get().transactions],
    });
  },

  async deleteTransaction(transactionId) {
    await db.transactions.delete(transactionId);
    set({
      transactions: get().transactions.filter((t) => t.id !== transactionId),
    });
  },
}));

