import React from "react";
import { AlertTriangle, FileText, Loader2 } from "lucide-react";
import { cn, getStatusConfig } from "../../utils";
import type { InvoiceStatus } from "../../types";

// ─── Spinner ─────────────────────────────────────────────────────────────────

interface SpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function Spinner({ size = "md", className }: SpinnerProps) {
  const sizes = { sm: "w-4 h-4", md: "w-6 h-6", lg: "w-10 h-10" };
  return (
    <Loader2
      className={cn("animate-spin text-indigo-400", sizes[size], className)}
    />
  );
}

export function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[300px]">
      <div className="flex flex-col items-center gap-3">
        <Spinner size="lg" />
        <p className="text-slate-400 text-sm">Loading…</p>
      </div>
    </div>
  );
}

// ─── StatusBadge ─────────────────────────────────────────────────────────────

export function StatusBadge({ status }: { status: InvoiceStatus }) {
  const cfg = getStatusConfig(status);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border",
        cfg.textColor,
        cfg.bgColor,
        cfg.borderColor
      )}
    >
      <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", cfg.dotColor)} />
      {cfg.label}
    </span>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: string;
}

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = "max-w-lg",
}: ModalProps) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className={cn(
          "relative w-full bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl animate-fade-in",
          maxWidth
        )}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <h2 className="text-base font-semibold text-white">{title}</h2>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

// ─── EmptyState ───────────────────────────────────────────────────────────────

interface EmptyStateProps {
  icon?: React.ElementType;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({
  icon: Icon = FileText,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 bg-slate-700/60 rounded-2xl flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-slate-500" />
      </div>
      <h3 className="text-lg font-semibold text-white mb-1">{title}</h3>
      {description && (
        <p className="text-slate-400 text-sm max-w-sm">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

// ─── AlertBanner ──────────────────────────────────────────────────────────────

interface AlertBannerProps {
  type: "error" | "warning" | "info";
  title: string;
  items: string[];
}

export function AlertBanner({ type, title, items }: AlertBannerProps) {
  const styles = {
    error: "bg-red-950/50 border-red-800/50 text-red-300",
    warning: "bg-orange-950/50 border-orange-800/50 text-orange-300",
    info: "bg-blue-950/50 border-blue-800/50 text-blue-300",
  };
  return (
    <div className={cn("rounded-xl border p-4", styles[type])}>
      <div className="flex items-center gap-2 mb-2 font-medium text-sm">
        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
        {title}
      </div>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li key={i} className="text-xs flex items-start gap-1.5">
            <span className="mt-0.5 flex-shrink-0">•</span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── DataRow ─────────────────────────────────────────────────────────────────

export function DataRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between py-2.5 border-b border-slate-700/50 last:border-0">
      <span className="text-slate-400 text-sm">{label}</span>
      <span
        className={cn(
          "text-slate-200 text-sm text-right max-w-[60%]",
          mono && "font-mono"
        )}
      >
        {value ?? <span className="text-slate-500">—</span>}
      </span>
    </div>
  );
}
