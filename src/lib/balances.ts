import { Transaction, Wallet } from "./types";

/** Net spend on a credit card: expenses and cash advances minus payments and refunds. */
export function computeCardUsedInPaise(wallet: Wallet, transactions: Transaction[]): number {
  let used = 0;
  for (const tx of transactions) {
    if (tx.type === "expense") {
      if (tx.walletId === wallet.id) used += tx.amountInPaise;
    } else if (tx.type === "income") {
      if (tx.walletId === wallet.id) used -= tx.amountInPaise;
    } else if (tx.type === "transfer") {
      // A transfer into the card pays it down; a transfer out of it is a cash advance.
      if (tx.walletId === wallet.id) used += tx.amountInPaise;
      if (tx.toWalletId === wallet.id) used -= tx.amountInPaise;
    }
  }
  return Math.max(0, used);
}

export function computeCardAvailableInPaise(wallet: Wallet, transactions: Transaction[]): number {
  const limit = wallet.creditLimitInPaise ?? 0;
  return Math.max(0, limit - computeCardUsedInPaise(wallet, transactions));
}

export function computeWalletBalanceInPaise(
  wallet: Wallet,
  transactions: Transaction[]
): number {
  if (wallet.type === "card") {
    return computeCardAvailableInPaise(wallet, transactions);
  }

  let bal = wallet.openingBalanceInPaise;

  for (const tx of transactions) {
    if (tx.type === "income") {
      if (tx.walletId === wallet.id) bal += tx.amountInPaise;
    } else if (tx.type === "expense") {
      if (tx.walletId === wallet.id) bal -= tx.amountInPaise;
    } else if (tx.type === "transfer") {
      if (tx.walletId === wallet.id) bal -= tx.amountInPaise;
      if (tx.toWalletId && tx.toWalletId === wallet.id) bal += tx.amountInPaise;
    }
  }

  return bal;
}

export function computeAllWalletBalancesInPaise(
  wallets: Wallet[],
  transactions: Transaction[]
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const w of wallets) {
    out[w.id] = computeWalletBalanceInPaise(w, transactions);
  }
  return out;
}

/** Sum of liquid balances (cash + bank). Credit cards are excluded. */
export function computeTotalBalanceInPaise(
  wallets: Wallet[],
  transactions: Transaction[],
  opts?: { includeArchived?: boolean }
): number {
  const includeArchived = opts?.includeArchived ?? false;
  const active = includeArchived ? wallets : wallets.filter((w) => !w.archived);
  const liquid = active.filter((w) => w.type !== "card");
  const balances = computeAllWalletBalancesInPaise(liquid, transactions);
  return Object.values(balances).reduce((a, b) => a + b, 0);
}
