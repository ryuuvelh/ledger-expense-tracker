import { create } from "zustand";
import { TransactionFormType } from "@/lib/transactionForm";

type UiState = {
  transactionModalOpen: boolean;
  transactionModalType: TransactionFormType;
  transactionEditId: string | null;
  openTransactionModal: (opts?: {
    type?: TransactionFormType;
    editId?: string;
  }) => void;
  closeTransactionModal: () => void;
};

export const useUiStore = create<UiState>((set) => ({
  transactionModalOpen: false,
  transactionModalType: "expense",
  transactionEditId: null,
  openTransactionModal: (opts) =>
    set({
      transactionModalOpen: true,
      transactionModalType: opts?.type ?? "expense",
      transactionEditId: opts?.editId ?? null,
    }),
  closeTransactionModal: () =>
    set({
      transactionModalOpen: false,
      transactionEditId: null,
    }),
}));

export type ThemeMode = "dark" | "light";

type ThemeState = {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
};

const THEME_KEY = "ledger-theme";

function readStoredTheme(): ThemeMode {
  if (typeof window === "undefined") return "dark";
  try {
    const stored = localStorage.getItem(THEME_KEY);
    return stored === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

function applyTheme(theme: ThemeMode) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", theme);
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // ignore
  }
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: "dark",
  setTheme: (theme) => {
    applyTheme(theme);
    set({ theme });
  },
  toggleTheme: () => {
    const next = get().theme === "dark" ? "light" : "dark";
    applyTheme(next);
    set({ theme: next });
  },
}));

export function initThemeFromStorage() {
  const theme = readStoredTheme();
  applyTheme(theme);
  useThemeStore.setState({ theme });
}
