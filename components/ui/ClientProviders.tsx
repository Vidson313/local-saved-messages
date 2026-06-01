"use client";

import type { ReactNode } from "react";
import { ThemeProvider } from "./ThemeProvider";
import { ToastContainer } from "./Toast";

export function ClientProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      {children}
      <ToastContainer />
    </ThemeProvider>
  );
}
