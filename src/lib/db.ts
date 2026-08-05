import Dexie, { Table } from "dexie";
import { Bill, Category, Transaction, Wallet } from "./types";

export class ExpenseDB extends Dexie {
  wallets!: Table<Wallet, string>;
  categories!: Table<Category, string>;
  transactions!: Table<Transaction, string>;
  bills!: Table<Bill, string>;

  constructor() {
    super("expense_traker_db");

    this.version(1).stores({
      wallets: "id, type, archived, updatedAt",
      categories: "id, kind, system, updatedAt",
      transactions: "id, type, date, walletId, toWalletId, categoryId, updatedAt",
      bills: "id, status, dueDate, walletId, categoryId, updatedAt",
    });

    this.version(2)
      .stores({
        wallets: "id, type, archived, updatedAt",
        categories: "id, kind, system, updatedAt",
        transactions: "id, type, date, walletId, toWalletId, categoryId, updatedAt",
        bills: "id, status, dueDate, walletId, categoryId, updatedAt",
      })
      .upgrade(async (tx) => {
        const wallets = await tx.table("wallets").toArray();
        for (const w of wallets) {
          const patch: Partial<Wallet> = {};

          if (w.creditLimitInPaise === undefined) {
            patch.creditLimitInPaise = null;
          }

          if (w.type === "bank" && w.openingBalanceInPaise !== 0) {
            patch.openingBalanceInPaise = 0;
          }

          if (w.type === "card" && w.openingBalanceInPaise !== 0) {
            patch.openingBalanceInPaise = 0;
          }

          if (Object.keys(patch).length > 0) {
            await tx.table("wallets").update(w.id, patch);
          }
        }
      });

    this.version(3)
      .stores({
        wallets: "id, type, archived, updatedAt",
        categories: "id, kind, system, updatedAt",
        transactions: "id, type, date, walletId, toWalletId, categoryId, updatedAt",
        bills: "id, status, dueDate, walletId, categoryId, updatedAt",
      })
      // v3 repaired opening balances that v2 had zeroed. That was a one-off data fix
      // for balances this app no longer ships; the version stays so the chain is intact.
      .upgrade(async () => {});

    this.version(4)
      .stores({
        wallets: "id, type, archived, updatedAt",
        categories: "id, kind, system, updatedAt",
        transactions: "id, type, date, walletId, toWalletId, categoryId, updatedAt",
        bills: "id, status, boughtDate, endDate, billType, billingCycle, updatedAt",
      })
      .upgrade(async (tx) => {
        const bills = await tx.table("bills").toArray();

        for (const b of bills) {
          const patch: Partial<Bill> = {};
          const old = b as unknown as {
            dueDate?: string;
            repeatRule?: "none" | "monthly" | "yearly";
            status?: "active" | "paused" | "paid";
          };

          if (!("boughtDate" in b) || !b.boughtDate) {
            patch.boughtDate = old.dueDate ?? new Date().toISOString().slice(0, 10);
          }
          if (!("endDate" in b) || !b.endDate) {
            patch.endDate = old.dueDate ?? new Date().toISOString().slice(0, 10);
          }
          if (!("billingCycle" in b) || !b.billingCycle) {
            patch.billingCycle = old.repeatRule && old.repeatRule !== "none" ? "recurring" : "one_time";
          }
          if (!("billType" in b) || !b.billType) {
            patch.billType = "subscription";
          }
          if (old.status === "paid") {
            patch.status = "active";
          } else if (!("status" in b) || !b.status) {
            patch.status = "pending";
          }

          if (Object.keys(patch).length > 0) {
            await tx.table("bills").update(b.id, patch);
          }
        }
      });

    this.version(5)
      .stores({
        wallets: "id, type, archived, updatedAt",
        categories: "id, kind, system, updatedAt",
        transactions: "id, type, date, walletId, toWalletId, categoryId, updatedAt",
        bills: "id, status, boughtDate, endDate, billType, billingCycle, lastPaidDate, updatedAt",
      })
      .upgrade(async (tx) => {
        const bills = await tx.table("bills").toArray();
        for (const b of bills) {
          if (!("lastPaidDate" in b)) {
            await tx.table("bills").update(b.id, { lastPaidDate: null });
          }
        }
      });

    this.version(6)
      .stores({
        wallets: "id, type, archived, updatedAt",
        categories: "id, kind, system, updatedAt",
        transactions: "id, type, date, walletId, toWalletId, categoryId, updatedAt",
        bills:
          "id, status, boughtDate, endDate, billType, billingCycle, durationValue, durationUnit, lastPaidDate, updatedAt",
      })
      .upgrade(async (tx) => {
        const bills = await tx.table("bills").toArray();
        for (const b of bills) {
          const patch: Partial<Bill> = {};
          if (!("durationValue" in b) || !b.durationValue) patch.durationValue = 1;
          if (!("durationUnit" in b) || !b.durationUnit) {
            patch.durationUnit = b.billingCycle === "recurring" ? "months" : "days";
          }
          if (Object.keys(patch).length > 0) {
            await tx.table("bills").update(b.id, patch);
          }
        }
      });
  }
}

export const db = new ExpenseDB();

