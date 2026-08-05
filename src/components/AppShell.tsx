"use client";

import Link from "next/link";
import { PropsWithChildren, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  ChartPie,
  House,
  Layers,
  Plus,
  Receipt,
  ReceiptText,
  Settings,
  Wallet,
  X,
} from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import TransactionFormModal from "@/components/TransactionFormModal";
import { useUiStore } from "@/store/uiStore";

const desktopNavItems: Array<{ href: string; label: string; icon: React.ReactNode }> = [
  { href: "/", label: "Home", icon: <House size={14} /> },
  { href: "/transactions", label: "Transactions", icon: <Receipt size={14} /> },
  { href: "/reports", label: "Reports", icon: <ChartPie size={14} /> },
  { href: "/wallets", label: "Wallets", icon: <Wallet size={14} /> },
  { href: "/bills", label: "Bills & Subscriptions", icon: <ReceiptText size={14} /> },
];

const moreItems: Array<{ href: string; label: string; hint: string; icon: React.ReactNode }> = [
  { href: "/wallets", label: "Wallets", hint: "Accounts, cash & cards", icon: <Wallet size={16} /> },
  {
    href: "/bills",
    label: "Bills & Subscriptions",
    hint: "Track and pay bills",
    icon: <ReceiptText size={16} />,
  },
  { href: "/settings", label: "Settings", hint: "Categories, backup & restore", icon: <Settings size={16} /> },
];

const moreHrefs = new Set(moreItems.map((item) => item.href));

export default function AppShell({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const openTransactionModal = useUiStore((s) => s.openTransactionModal);
  const [moreOpen, setMoreOpen] = useState(false);

  const settingsActive = pathname === "/settings";
  const moreActive = moreHrefs.has(pathname);

  // Close the sheet whenever the route changes, including on back navigation.
  // Adjusting during render rather than in an effect avoids a second render pass.
  const [lastPathname, setLastPathname] = useState(pathname);
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setMoreOpen(false);
  }

  useEffect(() => {
    if (!moreOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMoreOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [moreOpen]);

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <div className="grid-overlay" aria-hidden="true" />

      <div className="relative flex min-h-screen">
        <aside className="hidden w-56 shrink-0 flex-col border-r border-sidebar-border bg-sidebar px-3 py-5 lg:flex">
          <div className="mb-8 flex items-center gap-2.5 px-2">
            <div className="flex h-7 w-7 items-center justify-center rounded bg-primary">
              <Wallet size={14} className="text-primary-foreground" />
            </div>
            <div>
              <div className="font-display text-sm font-semibold tracking-tight text-sidebar-foreground">LEDGER</div>
            </div>
          </div>

          <button
            type="button"
            className="btn-primary mb-4 w-full"
            onClick={() => openTransactionModal({ type: "expense" })}
          >
            <Plus size={14} />
            Add transaction
          </button>

          <nav className="flex flex-col gap-0.5">
            {desktopNavItems.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={[
                    "flex items-center gap-2.5 rounded px-3 py-2 text-xs font-mono transition",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-sidebar-accent-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground",
                  ].join(" ")}
                >
                  {item.icon}
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto space-y-3 px-2 pt-6">
            <Link
              href="/settings"
              className={[
                "btn-secondary w-full justify-start",
                settingsActive ? "!bg-primary !text-primary-foreground" : "",
              ].join(" ")}
            >
              <Settings size={14} />
              Settings
            </Link>
            <div className="text-[10px] font-mono text-muted-foreground">
              Local-first · data stays in browser
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-6">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded bg-primary lg:hidden">
                <Wallet size={14} className="text-primary-foreground" />
              </div>
              <span className="font-display text-sm font-semibold tracking-tight lg:hidden">LEDGER</span>
              <div className="hidden text-xs font-mono text-muted-foreground lg:block">
                {new Date().toLocaleDateString("en-IN", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                className="btn-primary hidden lg:inline-flex"
                onClick={() => openTransactionModal({ type: "expense" })}
              >
                <Plus size={14} />
                Add transaction
              </button>
              <ThemeToggle />
            </div>
          </header>

          <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 pb-28 sm:px-6 lg:pb-6">
            {children}
          </main>
        </div>
      </div>

      {/* Mobile bottom navigation */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur-md lg:hidden"
        style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto grid max-w-lg grid-cols-5 items-end px-2 pt-2">
          <Link
            href="/"
            className={[
              "flex flex-col items-center gap-1 rounded-lg px-1 py-2 text-[10px] font-mono transition",
              pathname === "/" ? "text-primary" : "text-muted-foreground",
            ].join(" ")}
          >
            <House size={18} strokeWidth={pathname === "/" ? 2.4 : 1.8} />
            <span>Home</span>
            {pathname === "/" ? <span className="h-0.5 w-4 rounded-full bg-primary" /> : <span className="h-0.5 w-4" />}
          </Link>

          <Link
            href="/transactions"
            className={[
              "flex flex-col items-center gap-1 rounded-lg px-1 py-2 text-[10px] font-mono transition",
              pathname === "/transactions" ? "text-primary" : "text-muted-foreground",
            ].join(" ")}
          >
            <Receipt size={18} strokeWidth={pathname === "/transactions" ? 2.4 : 1.8} />
            <span>Txns</span>
            {pathname === "/transactions" ? (
              <span className="h-0.5 w-4 rounded-full bg-primary" />
            ) : (
              <span className="h-0.5 w-4" />
            )}
          </Link>

          <div className="flex justify-center pb-1">
            <button
              type="button"
              aria-label="Add transaction"
              className="flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-secondary text-foreground shadow-sm transition hover:bg-primary hover:text-primary-foreground"
              onClick={() => openTransactionModal({ type: "expense" })}
            >
              <Plus size={22} />
            </button>
          </div>

          <Link
            href="/reports"
            className={[
              "flex flex-col items-center gap-1 rounded-lg px-1 py-2 text-[10px] font-mono transition",
              pathname === "/reports" ? "text-primary" : "text-muted-foreground",
            ].join(" ")}
          >
            <ChartPie size={18} strokeWidth={pathname === "/reports" ? 2.4 : 1.8} />
            <span>Reports</span>
            {pathname === "/reports" ? (
              <span className="h-0.5 w-4 rounded-full bg-primary" />
            ) : (
              <span className="h-0.5 w-4" />
            )}
          </Link>

          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={[
              "flex flex-col items-center gap-1 rounded-lg px-1 py-2 text-[10px] font-mono transition",
              moreActive || moreOpen ? "text-primary" : "text-muted-foreground",
            ].join(" ")}
          >
            <Layers size={18} strokeWidth={moreActive || moreOpen ? 2.4 : 1.8} />
            <span>More</span>
            {moreActive || moreOpen ? (
              <span className="h-0.5 w-4 rounded-full bg-primary" />
            ) : (
              <span className="h-0.5 w-4" />
            )}
          </button>
        </div>
      </nav>

      {/* More sheet: Wallets, Bills, Settings */}
      {moreOpen ? (
        <div
          className="fixed inset-0 z-50 lg:hidden"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setMoreOpen(false);
          }}
        >
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
          <div
            className="absolute inset-x-0 bottom-0 rounded-t-2xl border border-border bg-card p-4 shadow-2xl"
            style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-xs font-mono font-semibold uppercase tracking-wider">More</h2>
                <p className="mt-1 text-xs text-muted-foreground">Wallets, bills & settings</p>
              </div>
              <button
                type="button"
                className="btn-ghost !p-2"
                aria-label="Close more menu"
                onClick={() => setMoreOpen(false)}
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-2">
              {moreItems.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={[
                      "flex items-center gap-3 rounded-lg border px-3 py-3 transition",
                      active
                        ? "border-primary/40 bg-primary/10 text-foreground"
                        : "border-border bg-secondary/40 text-foreground hover:bg-secondary",
                    ].join(" ")}
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-md bg-background text-primary">
                      {item.icon}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{item.label}</span>
                      <span className="block text-xs font-mono text-muted-foreground">{item.hint}</span>
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      <TransactionFormModal />
    </div>
  );
}
