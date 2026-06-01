"use client";

import { useThemeContext } from "./ThemeProvider";
import { ThemeToggle } from "./ThemeToggle";
import { Settings, X, Type, Palette } from "lucide-react";
import { useEffect, useState } from "react";

const FONT_SIZE_KEY = "app-font-size";
const FONT_SIZES = [
  { value: "small", label: "Small", px: 14 },
  { value: "medium", label: "Medium", px: 15 },
  { value: "large", label: "Large", px: 17 },
];

function getStoredFontSize(): string {
  if (typeof window === "undefined") return "medium";
  return localStorage.getItem(FONT_SIZE_KEY) || "medium";
}

function applyFontSize(size: string) {
  const match = FONT_SIZES.find((f) => f.value === size);
  if (match) {
    document.documentElement.style.setProperty("--tg-font-size", `${match.px}px`);
  }
}

export function useAppFontSize() {
  const [fontSize, setFontSize] = useState("medium");

  useEffect(() => {
    const stored = getStoredFontSize();
    setFontSize(stored);
    applyFontSize(stored);
  }, []);

  const changeFontSize = (size: string) => {
    setFontSize(size);
    localStorage.setItem(FONT_SIZE_KEY, size);
    applyFontSize(size);
  };

  return { fontSize, changeFontSize };
}

type SettingsModalProps = {
  open: boolean;
  onClose: () => void;
};

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const { mode } = useThemeContext();
  const { fontSize, changeFontSize } = useAppFontSize();

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="tg-modal-overlay" onClick={onClose}>
      <div className="tg-modal tg-settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="tg-modal-header">
          <div className="tg-settings-header-left">
            <Settings size={20} />
            <strong>Settings</strong>
          </div>
          <button className="tg-ghost-button" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="tg-settings-body">
          {/* Theme Section */}
          <div className="tg-settings-section">
            <div className="tg-settings-section-header">
              <Palette size={18} />
              <span>Appearance</span>
            </div>
            <div className="tg-settings-row">
              <span className="tg-settings-label">Theme</span>
              <ThemeToggle />
            </div>
            <div className="tg-settings-hint">
              Current: {mode === "system" ? "System (auto)" : mode === "dark" ? "Dark" : "Light"}
            </div>
          </div>

          {/* Font Size Section */}
          <div className="tg-settings-section">
            <div className="tg-settings-section-header">
              <Type size={18} />
              <span>Font Size</span>
            </div>
            <div className="tg-font-size-picker">
              {FONT_SIZES.map((size) => (
                <button
                  key={size.value}
                  className={`tg-font-size-btn ${fontSize === size.value ? "tg-font-size-active" : ""}`}
                  onClick={() => changeFontSize(size.value)}
                >
                  <span style={{ fontSize: `${size.px}px` }}>Aa</span>
                  <small>{size.label}</small>
                </button>
              ))}
            </div>
          </div>

          {/* About Section */}
          <div className="tg-settings-section">
            <div className="tg-settings-about">
              <strong>Local Saved Messages</strong>
              <small>v1.0.0 · Built with Next.js</small>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
