import { z } from "zod";
import { db } from "./db";
import { saveTextAsFile } from "./desktopFs";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected a YYYY-MM-DD date");
const paise = z.number().int();
const epochMs = z.number().int().nonnegative();

const walletSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  type: z.enum(["cash", "bank", "card"]),
  iconKey: z.string(),
  color: z.string(),
  archived: z.boolean(),
  openingBalanceInPaise: paise,
  creditLimitInPaise: paise.nullable(),
  createdAt: epochMs,
  updatedAt: epochMs,
});

const categorySchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  kind: z.enum(["income", "expense"]),
  iconKey: z.string(),
  color: z.string(),
  system: z.boolean(),
  createdAt: epochMs,
  updatedAt: epochMs,
});

const transactionSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["income", "expense", "transfer"]),
  amountInPaise: paise.nonnegative(),
  date: isoDate,
  note: z.string().default(""),
  categoryId: z.string().nullable().default(null),
  walletId: z.string().min(1),
  toWalletId: z.string().nullable().default(null),
  billId: z.string().nullable().default(null),
  createdAt: epochMs,
  updatedAt: epochMs,
});

// Bill fields added in later DB versions get defaults so older backups still restore.
const billSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  amountInPaise: paise,
  boughtDate: isoDate,
  endDate: isoDate,
  lastPaidDate: isoDate.nullable().default(null),
  billingCycle: z.enum(["one_time", "recurring"]).default("one_time"),
  durationValue: z.number().int().positive().default(1),
  durationUnit: z.enum(["days", "months", "years"]).default("days"),
  billType: z.enum(["phone_bill", "internet_bill", "subscription"]).default("subscription"),
  status: z.enum(["pending", "active", "paused"]).default("pending"),
  createdAt: epochMs,
  updatedAt: epochMs,
});

export const backupPayloadSchema = z.object({
  version: z.literal(1),
  exportedAt: z.string(),
  wallets: z.array(walletSchema),
  categories: z.array(categorySchema),
  transactions: z.array(transactionSchema),
  bills: z.array(billSchema).default([]),
});

export type BackupPayload = z.infer<typeof backupPayloadSchema>;

/** Validates an untrusted backup file. Throws with a readable message on bad input. */
export function parseBackupPayload(raw: unknown): BackupPayload {
  const result = backupPayloadSchema.safeParse(raw);
  if (result.success) return result.data;

  const issue = result.error.issues[0];
  if (!issue) throw new Error("Invalid backup file.");

  const where = issue.path.length ? issue.path.join(".") : "file";
  throw new Error(`Invalid backup file — ${where}: ${issue.message}`);
}

function escapeCsv(value: string) {
  if (value.includes(",") || value.includes("\"") || value.includes("\n")) {
    return `"${value.replaceAll("\"", "\"\"")}"`;
  }
  return value;
}

function formatCsvRow(values: Array<string | number | null | undefined>) {
  return values
    .map((value) => (value == null ? "" : escapeCsv(String(value))))
    .join(",");
}

export async function readBackupPayload(): Promise<BackupPayload> {
  const [wallets, categories, transactions, bills] = await Promise.all([
    db.wallets.toArray(),
    db.categories.toArray(),
    db.transactions.toArray(),
    db.bills.toArray(),
  ]);

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    wallets,
    categories,
    transactions,
    bills,
  };
}

export async function downloadBackupJson(filenamePrefix = "ledger-backup") {
  const payload = await readBackupPayload();
  const isoDate = new Date().toISOString().slice(0, 10);
  const filename = `${filenamePrefix}-${isoDate}.json`;
  const saved = await saveTextAsFile({
    defaultFilename: filename,
    contents: JSON.stringify(payload, null, 2),
    mimeType: "application/json",
    filterName: "JSON",
    extensions: ["json"],
  });
  if (!saved) throw new Error("Backup cancelled.");
}

export async function downloadExportJson() {
  await downloadBackupJson("ledger-export");
}

export async function downloadExportCsv() {
  const payload = await readBackupPayload();
  const walletNameById = new Map(payload.wallets.map((w) => [w.id, w.name]));
  const categoryNameById = new Map(payload.categories.map((c) => [c.id, c.name]));

  const lines: string[] = [];
  lines.push("TRANSACTIONS");
  lines.push(
    formatCsvRow([
      "date",
      "type",
      "amount_inr",
      "note",
      "category",
      "wallet",
      "to_wallet",
      "bill_id",
      "id",
    ])
  );

  for (const tx of payload.transactions.sort((a, b) => a.date.localeCompare(b.date))) {
    lines.push(
      formatCsvRow([
        tx.date,
        tx.type,
        (tx.amountInPaise / 100).toFixed(2),
        tx.note,
        tx.categoryId ? categoryNameById.get(tx.categoryId) ?? tx.categoryId : "",
        walletNameById.get(tx.walletId) ?? tx.walletId,
        tx.toWalletId ? walletNameById.get(tx.toWalletId) ?? tx.toWalletId : "",
        tx.billId ?? "",
        tx.id,
      ])
    );
  }

  lines.push("");
  lines.push("WALLETS");
  lines.push(
    formatCsvRow([
      "name",
      "type",
      "opening_inr",
      "credit_limit_inr",
      "archived",
      "id",
    ])
  );
  for (const wallet of payload.wallets) {
    lines.push(
      formatCsvRow([
        wallet.name,
        wallet.type,
        (wallet.openingBalanceInPaise / 100).toFixed(2),
        wallet.creditLimitInPaise == null
          ? ""
          : (wallet.creditLimitInPaise / 100).toFixed(2),
        wallet.archived ? "true" : "false",
        wallet.id,
      ])
    );
  }

  lines.push("");
  lines.push("CATEGORIES");
  lines.push(formatCsvRow(["name", "kind", "icon", "color", "id"]));
  for (const category of payload.categories) {
    lines.push(
      formatCsvRow([
        category.name,
        category.kind,
        category.iconKey,
        category.color,
        category.id,
      ])
    );
  }

  const isoDate = new Date().toISOString().slice(0, 10);
  const saved = await saveTextAsFile({
    defaultFilename: `ledger-export-${isoDate}.csv`,
    contents: lines.join("\n"),
    mimeType: "text/csv;charset=utf-8",
    filterName: "CSV",
    extensions: ["csv"],
  });
  if (!saved) throw new Error("Export cancelled.");
}

export async function restoreFromBackupPayload(raw: unknown) {
  const payload = parseBackupPayload(raw);

  await db.transaction(
    "rw",
    db.wallets,
    db.categories,
    db.transactions,
    db.bills,
    async () => {
      await db.wallets.clear();
      await db.categories.clear();
      await db.transactions.clear();
      await db.bills.clear();

      if (payload.wallets.length) await db.wallets.bulkPut(payload.wallets);
      if (payload.categories.length) await db.categories.bulkPut(payload.categories);
      if (payload.transactions.length) await db.transactions.bulkPut(payload.transactions);
      if (payload.bills.length) await db.bills.bulkPut(payload.bills);
    }
  );
}
