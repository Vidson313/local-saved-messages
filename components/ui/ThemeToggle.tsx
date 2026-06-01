"use client";

import { useThemeContext } from "./ThemeProvider";
import { Sun, Moon, Monitor } from "lucide-react";

const MODES = [
  { value: "light" as const, icon: Sun, label: "Light" },
  { value: "dark" as const, icon: Moon, label: "Dark" },
  { value: "system" as const, icon: Monitor, label: "System" },
];

export function ThemeToggle() {
  const { mode, setTheme } = useThemeContext();

  return (
    <div className="tg-theme-toggle" role="radiogroup" aria-label="Theme">
      {MODES.map(({ value, icon: IconComponent, label }) => (
        <button
          key={value}
          role="radio"
          aria-checked={mode === value}
          aria-label={label}
          className={`tg-theme-toggle-btn ${mode === value ? "tg-theme-toggle-active" : ""}`}
          onClick={() => setTheme(value)}
          title={label}
        >
          <IconComponent size={16} />
        </button>
      ))}
    </div>
  );
}
