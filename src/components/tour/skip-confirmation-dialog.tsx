"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

type Props = {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function SkipConfirmationDialog({ open, onConfirm, onCancel }: Props) {
  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCancel();
      }
    };
    document.addEventListener("keydown", handler, true);
    return () => document.removeEventListener("keydown", handler, true);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      // Fixed positioning at extreme z-index to sit above driver.js overlay (z:10000)
      // and Radix defaults. Explicit pointer-events on both backdrop and content.
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 999999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "auto",
      }}
    >
      {/* Backdrop */}
      <div
        onClick={onCancel}
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: "rgba(0, 0, 0, 0.6)",
          pointerEvents: "auto",
        }}
      />

      {/* Dialog content */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-card text-card-foreground border rounded-lg shadow-lg"
        style={{
          position: "relative",
          zIndex: 1,
          maxWidth: "440px",
          width: "calc(100vw - 2rem)",
          padding: "1.5rem",
          pointerEvents: "auto",
        }}
      >
        <button
          type="button"
          onClick={onCancel}
          aria-label="Close"
          style={{
            position: "absolute",
            right: "1rem",
            top: "1rem",
            opacity: 0.7,
            background: "transparent",
            border: "none",
            cursor: "pointer",
            padding: "0.25rem",
            borderRadius: "0.25rem",
          }}
          className="hover:opacity-100 hover:bg-accent"
        >
          <X className="h-4 w-4" />
        </button>

        <div style={{ marginBottom: "1rem" }}>
          <h2 className="text-lg font-semibold text-foreground" style={{ margin: 0, marginBottom: "0.5rem" }}>
            I-skip yung tour?
          </h2>
          <p className="text-sm text-muted-foreground" style={{ margin: 0, lineHeight: 1.6 }}>
            Kung i-skip mo ngayon, hindi na siya lalabas ulit sa susunod mong login.
            Pero pwede mo naman itong i-restart anytime galing sa{" "}
            <span className="font-medium text-foreground">Help page</span> — click mo lang
            yung &quot;Start tour&quot; button doon.
          </p>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
          <button
            type="button"
            onClick={onCancel}
            className="bg-transparent border hover:bg-accent hover:text-accent-foreground"
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "0.375rem",
              fontSize: "0.875rem",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Ituloy yung tour
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="bg-primary text-primary-foreground hover:opacity-90"
            style={{
              padding: "0.5rem 1rem",
              border: "none",
              borderRadius: "0.375rem",
              fontSize: "0.875rem",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Skip na
          </button>
        </div>
      </div>
    </div>
  );
}
