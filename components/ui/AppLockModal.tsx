"use client";

import { useState, useEffect, useRef, useCallback } from "react";

const PIN_LENGTH = 4;
const STORAGE_KEY = "app-lock-pin";

export function useAppLock() {
  const [isLocked, setIsLocked] = useState(false);
  const [hasPin, setHasPin] = useState(false);

  useEffect(() => {
    const pin = localStorage.getItem(STORAGE_KEY);
    if (pin) {
      setHasPin(true);
      setIsLocked(true);
    }
  }, []);

  const setPin = useCallback((pin: string) => {
    localStorage.setItem(STORAGE_KEY, pin);
    setHasPin(true);
  }, []);

  const removePin = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setHasPin(false);
    setIsLocked(false);
  }, []);

  const unlock = useCallback((attempt: string) => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (attempt === stored) {
      setIsLocked(false);
      return true;
    }
    return false;
  }, []);

  const lock = useCallback(() => {
    if (hasPin) setIsLocked(true);
  }, [hasPin]);

  return { isLocked, hasPin, setPin, removePin, unlock, lock };
}

type LockScreenProps = {
  onUnlock: (pin: string) => boolean;
};

export function LockScreen({ onUnlock }: LockScreenProps) {
  const [digits, setDigits] = useState<string[]>([]);
  const [error, setError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (digits.length === PIN_LENGTH) {
      const pin = digits.join("");
      const ok = onUnlock(pin);
      if (!ok) {
        setError(true);
        setTimeout(() => {
          setDigits([]);
          setError(false);
        }, 500);
      }
    }
  }, [digits, onUnlock]);

  function addDigit(d: string) {
    if (digits.length < PIN_LENGTH) setDigits((prev) => [...prev, d]);
  }

  function removeDigit() {
    setDigits((prev) => prev.slice(0, -1));
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (/^[0-9]$/.test(e.key)) addDigit(e.key);
    if (e.key === "Backspace") removeDigit();
  }

  return (
    <div
      className="tg-lock-screen"
      ref={containerRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-label="Enter PIN to unlock"
    >
      <div className="tg-lock-content">
        <div className="tg-lock-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
        <strong>Enter PIN</strong>
        <div className={`tg-pin-dots ${error ? "tg-pin-error" : ""}`}>
          {Array.from({ length: PIN_LENGTH }).map((_, i) => (
            <span
              key={i}
              className={`tg-pin-dot ${i < digits.length ? "tg-pin-dot-filled" : ""}`}
            />
          ))}
        </div>
        <div className="tg-pin-pad">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"].map((key) => (
            <button
              key={key || "empty"}
              className={`tg-pin-key ${!key ? "tg-pin-key-empty" : ""}`}
              onClick={() => {
                if (key === "del") removeDigit();
                else if (key) addDigit(key);
              }}
              disabled={!key}
              aria-label={key === "del" ? "Delete" : key || undefined}
            >
              {key === "del" ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" />
                  <line x1="18" y1="9" x2="12" y2="15" />
                  <line x1="12" y1="9" x2="18" y2="15" />
                </svg>
              ) : (
                key
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

type SetPinModalProps = {
  open: boolean;
  onClose: () => void;
  onSetPin: (pin: string) => void;
  hasExistingPin: boolean;
  onRemovePin: () => void;
};

export function SetPinModal({ open, onClose, onSetPin, hasExistingPin, onRemovePin }: SetPinModalProps) {
  const [step, setStep] = useState<"enter" | "confirm">("enter");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setStep("enter");
      setPin("");
      setConfirmPin("");
      setError("");
    }
  }, [open]);

  if (!open) return null;

  function handleDigit(digit: string, target: "pin" | "confirm") {
    if (target === "pin" && pin.length < PIN_LENGTH) {
      const next = pin + digit;
      setPin(next);
      if (next.length === PIN_LENGTH) setStep("confirm");
    }
    if (target === "confirm" && confirmPin.length < PIN_LENGTH) {
      const next = confirmPin + digit;
      setConfirmPin(next);
      if (next.length === PIN_LENGTH) {
        if (next === pin) {
          onSetPin(next);
          onClose();
        } else {
          setError("PINs do not match");
          setConfirmPin("");
          setTimeout(() => setError(""), 1500);
        }
      }
    }
  }

  const currentPin = step === "enter" ? pin : confirmPin;
  const targetField = step === "enter" ? "pin" as const : "confirm" as const;

  return (
    <div className="tg-modal-overlay" onClick={onClose}>
      <div className="tg-modal" onClick={(e) => e.stopPropagation()}>
        <div className="tg-modal-header">
          <strong>{hasExistingPin ? "Change PIN" : "Set PIN Lock"}</strong>
          <button className="tg-ghost-button" onClick={onClose} aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="tg-modal-body">
          <p style={{ fontSize: 14, color: "var(--tg-muted)", margin: 0 }}>
            {step === "enter" ? "Enter a 4-digit PIN" : "Confirm your PIN"}
          </p>
          {error && <p style={{ fontSize: 13, color: "#d32f2f", margin: 0 }}>{error}</p>}
          <div className="tg-pin-dots">
            {Array.from({ length: PIN_LENGTH }).map((_, i) => (
              <span
                key={i}
                className={`tg-pin-dot ${i < currentPin.length ? "tg-pin-dot-filled" : ""}`}
              />
            ))}
          </div>
          <div className="tg-pin-pad tg-pin-pad-compact">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"].map((key) => (
              <button
                key={key || "empty"}
                className={`tg-pin-key ${!key ? "tg-pin-key-empty" : ""}`}
                onClick={() => {
                  if (key === "del") {
                    if (step === "confirm") setConfirmPin((p) => p.slice(0, -1));
                    else setPin((p) => p.slice(0, -1));
                  } else if (key) {
                    handleDigit(key, targetField);
                  }
                }}
                disabled={!key}
              >
                {key === "del" ? "\u232B" : key}
              </button>
            ))}
          </div>
          {hasExistingPin && (
            <button
              className="tg-btn-secondary"
              style={{ color: "#d32f2f" }}
              onClick={() => {
                onRemovePin();
                onClose();
              }}
            >
              Remove PIN Lock
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
