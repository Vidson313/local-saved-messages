"use client";

import { useThemeContext } from "./ThemeProvider";
import { ThemeToggle } from "./ThemeToggle";
import { Settings, X, Type, Palette, Lock, Shield } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { useFocusTrap } from "@/hooks/useFocusTrap";

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
  onOpenSetPin?: () => void;
  hasPin?: boolean;
  onLock?: () => void;
};

export function SettingsModal({ open, onClose, onOpenSetPin, hasPin, onLock }: SettingsModalProps) {
  const { mode } = useThemeContext();
  const { fontSize, changeFontSize } = useAppFontSize();
  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef, open);

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
    <div className="tg-modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Settings">
      <div ref={modalRef} className="tg-modal tg-settings-modal" onClick={(e) => e.stopPropagation()}>
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

          {/* Security Section */}
          <div className="tg-settings-section">
            <div className="tg-settings-section-header">
              <Shield size={18} />
              <span>Security</span>
            </div>
            <div className="tg-settings-row">
              <span className="tg-settings-label">PIN Lock</span>
              <button className="tg-btn-secondary" onClick={onOpenSetPin}>
                {hasPin ? "Change PIN" : "Set PIN"}
              </button>
            </div>
            {hasPin && (
              <button className="tg-btn-secondary" onClick={onLock} style={{ alignSelf: "flex-start" }}>
                <Lock size={14} style={{ marginRight: 6, verticalAlign: "middle" }} />
                Lock Now
              </button>
            )}
          </div>

          {/* Keyboard Shortcuts */}
          <div className="tg-settings-section">
            <div className="tg-settings-section-header">
              <span>Keyboard Shortcuts</span>
            </div>
            <div className="tg-shortcuts-list">
              <div className="tg-shortcut-row"><span>Command Palette</span><kbd>Ctrl+K</kbd></div>
              <div className="tg-shortcut-row"><span>Search</span><kbd>/</kbd></div>
              <div className="tg-shortcut-row"><span>Settings</span><kbd>Ctrl+,</kbd></div>
              <div className="tg-shortcut-row"><span>Close modal</span><kbd>Esc</kbd></div>
            </div>
          </div>

          {/* About Section */}
          <div className="tg-settings-section">
            <div className="tg-settings-about">
              <strong>Local Saved Messages</strong>
              <small>v2.0.0 · Built with Next.js 15</small>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
