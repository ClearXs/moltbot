/**
 * Theme Provider
 *
 * Initializes theme on mount and keeps DOM attribute in sync with theme state.
 * Must be wrapped around the entire application in layout.tsx.
 */

"use client";

import { useEffect } from "react";
import { useThemeStore } from "@/stores/themeStore";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useThemeStore((state) => state.theme);

  useEffect(() => {
    // Set initial theme on mount
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // Handle multi-tab synchronization
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "theme" && e.newValue) {
        const setTheme = useThemeStore.getState().setTheme;
        setTheme(e.newValue as any);
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  return <>{children}</>;
}
