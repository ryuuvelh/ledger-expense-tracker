"use client";

import { PropsWithChildren, useEffect } from "react";
import { initThemeFromStorage } from "@/store/uiStore";

export default function ThemeProvider({ children }: PropsWithChildren) {
  useEffect(() => {
    initThemeFromStorage();
  }, []);

  return <>{children}</>;
}
