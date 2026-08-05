"use client";

import { useEffect } from "react";
import { useExpenseStore } from "@/store/expenseStore";
import AppDialogHost from "@/components/AppDialogHost";

export default function Providers({ children }: { children: React.ReactNode }) {
  const loaded = useExpenseStore((s) => s.loaded);
  const loadAll = useExpenseStore((s) => s.loadAll);
  const loadError = useExpenseStore((s) => s.loadError);

  useEffect(() => {
    if (!loaded) {
      void loadAll();
    }
  }, [loaded, loadAll]);

  // Only block the first boot — never blank the app during a restore refresh.
  if (!loaded) {
    if (loadError) {
      return (
        <>
          <AppDialogHost />
          <div className="p-6 text-destructive">
            Failed to load data: {loadError}
          </div>
        </>
      );
    }
    return (
      <>
        <AppDialogHost />
        <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
          Loading…
        </div>
      </>
    );
  }

  return (
    <>
      <AppDialogHost />
      {children}
    </>
  );
}
