"use client";

import { ReactNode, useEffect } from "react";
import { X } from "lucide-react";

export default function Modal(props: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const { open, onClose } = props;

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!props.open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) props.onClose();
      }}
    >
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md rounded border border-border bg-card p-6 shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xs font-mono font-semibold uppercase tracking-wider text-foreground">
            {props.title}
          </h2>
          <button
            type="button"
            className="text-muted-foreground transition-colors hover:text-foreground"
            onClick={props.onClose}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>
        <div>{props.children}</div>
        {props.footer ? (
          <div className="mt-5 flex items-center justify-end gap-2 border-t border-border pt-4">
            {props.footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
