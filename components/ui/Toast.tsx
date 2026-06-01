"use client";

import { Toaster } from "sonner";
import { useThemeContext } from "./ThemeProvider";

export function ToastContainer() {
  const { resolvedTheme } = useThemeContext();

  return (
    <Toaster
      theme={resolvedTheme}
      position="top-center"
      toastOptions={{
        duration: 3500,
        style: {
          borderRadius: "12px",
          fontSize: "14px",
        },
      }}
      richColors
      closeButton
    />
  );
}
