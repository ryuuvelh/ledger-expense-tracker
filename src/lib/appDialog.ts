import { create } from "zustand";

type DialogKind = "confirm" | "alert";

type PendingDialog = {
  kind: DialogKind;
  title: string;
  message: string;
  resolve: (value: boolean) => void;
};

type AppDialogState = {
  pending: PendingDialog | null;
  askConfirm: (message: string, title?: string) => Promise<boolean>;
  showAlert: (message: string, title?: string) => Promise<void>;
  resolvePending: (value: boolean) => void;
};

export const useAppDialogStore = create<AppDialogState>((set, get) => ({
  pending: null,
  askConfirm: (message, title = "Confirm") =>
    new Promise<boolean>((resolve) => {
      const current = get().pending;
      if (current) current.resolve(false);
      set({
        pending: { kind: "confirm", title, message, resolve },
      });
    }),
  showAlert: (message, title = "Notice") =>
    new Promise<void>((resolve) => {
      const current = get().pending;
      if (current) current.resolve(false);
      set({
        pending: {
          kind: "alert",
          title,
          message,
          resolve: () => resolve(),
        },
      });
    }),
  resolvePending: (value) => {
    const pending = get().pending;
    if (!pending) return;
    set({ pending: null });
    pending.resolve(value);
  },
}));

export function appConfirm(message: string, title = "Confirm"): Promise<boolean> {
  return useAppDialogStore.getState().askConfirm(message, title);
}

export function appAlert(message: string, title = "Notice"): Promise<void> {
  return useAppDialogStore.getState().showAlert(message, title);
}
