<p align="center">
  <img src=".github/logo.png" width="128" height="128" alt="LEDGER" />
</p>

<h1 align="center">LEDGER</h1>

<p align="center">
  A local-first personal finance tracker.<br />
  Wallets, transactions, bills, and reports — stored entirely on your own machine.<br />
  <strong>No account, no server, no telemetry.</strong>
</p>

<p align="center">
  <a href="https://github.com/ryuuvelh/ledger-expense-tracker/releases/latest/download/LEDGER_universal.dmg"><img src="https://img.shields.io/badge/download-macOS%20universal%20.dmg-FF9111?style=flat-square" alt="Download for macOS" /></a>
  <a href="https://github.com/ryuuvelh/ledger-expense-tracker/releases/latest"><img src="https://img.shields.io/github/v/release/ryuuvelh/ledger-expense-tracker?style=flat-square&color=CB3100" alt="Latest release" /></a>
  <img src="https://img.shields.io/badge/license-MIT-64748b?style=flat-square" alt="MIT licence" />
</p>

Runs as a desktop app via [Tauri](https://tauri.app), or in a browser during development.

## Download

**[Download LEDGER (universal `.dmg`)](https://github.com/ryuuvelh/ledger-expense-tracker/releases/latest/download/LEDGER_universal.dmg)**
· [all releases](../../releases)

Universal build — works on both Apple Silicon and Intel Macs. macOS only for now.

Open the DMG and drag LEDGER into Applications. Updating over an existing install keeps
your data: it lives outside the app bundle.

### "LEDGER is damaged and can't be opened"

The app is **not signed with an Apple Developer certificate and is not notarised**, so macOS
quarantines it on download and shows that message. The app is fine; macOS simply cannot verify
who built it. To run it anyway, clear the quarantine flag:

```bash
xattr -dr com.apple.quarantine /Applications/LEDGER.app
```

If you would rather not run that, build it yourself from source — see below. Only do either of
these because you trust the source; that warning exists for good reason.

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
npm ci
```

Use `npm ci` rather than `npm install`. Tailwind v4 ships its native binding as a
platform-specific optional dependency, and `npm install` skips optional packages silently
if one fails to fetch — leaving a build that dies with `Cannot find native binding`.
`npm ci` installs the lockfile exactly. If you hit that error anyway,
`rm -rf node_modules && npm ci` fixes it.

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

Build the release artifact — a universal (Apple Silicon + Intel) DMG, copied out as
`LEDGER_universal.dmg`:

```bash
npm run dmg
```

Upload that file, under exactly that name, as the release asset. The download link above
is `releases/latest/download/LEDGER_universal.dmg`, which GitHub resolves to the newest
release — so keeping the filename free of a version number means the link never goes stale.

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
