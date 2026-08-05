# LEDGER

A local-first personal finance tracker. Wallets, transactions, bills, and reports —
all stored in your browser's IndexedDB, on your machine. No account, no server, no telemetry.

Runs as a desktop app via [Tauri](https://tauri.app), or in a browser during development.

## Features

- **Wallets** — cash, bank accounts, and credit cards, with per-card limit and available-credit tracking
- **Transactions** — income, expenses, and transfers between wallets
- **Bills & subscriptions** — one-time or recurring, with a Pay action that records the expense
- **Reports** — weekly, monthly, yearly, salary-cycle, or a custom range; income vs expense,
  balance trend, and category breakdowns, exportable to PDF
- **Backup & restore** — full JSON backup, plus CSV/JSON export

Amounts are stored as integer paise and formatted as INR, so there is no floating-point drift.

## Getting started

```bash
npm install
```

Development in the browser:

```bash
npm run dev
```

Development as a desktop app:

```bash
npm run tauri:dev
```

Build the desktop app (output under `src-tauri/target/release/bundle/`):

```bash
npm run tauri:build
```

## Checks

```bash
npm test
```

`npm test` runs assertions over the money math — wallet balances, credit-card usage,
report bucketing, and INR parsing. Also available: `npm run lint` and `npx tsc --noEmit`.

## Your data

Everything lives in IndexedDB under the app's own origin. Nothing is uploaded anywhere.
The desktop build reads and writes files only through a native save/open dialog that you
drive — the webview has no filesystem access of its own.

Use **Settings → Backup data** before major changes. Restores are schema-validated, so a
corrupt or hand-edited backup is rejected before anything is overwritten.

## Stack

Next.js (static export) · React · TypeScript · Tailwind · Dexie (IndexedDB) · Zustand ·
react-hook-form + Zod · Recharts · jsPDF · Tauri

## Licence

MIT
