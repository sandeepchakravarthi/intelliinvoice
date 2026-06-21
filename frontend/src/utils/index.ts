import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { InvoiceStatus, UserRole } from "../types";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

// ─── Currency / Number ────────────────────────────────────────────────────────

export function formatCurrency(
  value: number | string | null | undefined
): string {
  if (value === null || value === undefined || value === "") return "—";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("en-IN").format(value);
}

// ─── Date / Time ──────────────────────────────────────────────────────────────

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return value;
  }
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

export function formatRelativeTime(value: string | null | undefined): string {
  if (!value) return "—";
  const diff = Date.now() - new Date(value).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(value);
}

// ─── Status ───────────────────────────────────────────────────────────────────

export interface StatusConfig {
  label: string;
  textColor: string;
  bgColor: string;
  borderColor: string;
  dotColor: string;
}

const STATUS_MAP: Record<InvoiceStatus, StatusConfig> = {
  uploaded: {
    label: "Uploaded",
    textColor: "text-slate-300",
    bgColor: "bg-slate-700/60",
    borderColor: "border-slate-600",
    dotColor: "bg-slate-400",
  },
  processing: {
    label: "Processing",
    textColor: "text-blue-300",
    bgColor: "bg-blue-900/30",
    borderColor: "border-blue-700/50",
    dotColor: "bg-blue-400",
  },
  extracted: {
    label: "Extracted",
    textColor: "text-cyan-300",
    bgColor: "bg-cyan-900/30",
    borderColor: "border-cyan-700/50",
    dotColor: "bg-cyan-400",
  },
  validation_failed: {
    label: "Validation Failed",
    textColor: "text-orange-300",
    bgColor: "bg-orange-900/30",
    borderColor: "border-orange-700/50",
    dotColor: "bg-orange-400",
  },
  pending_approval: {
    label: "Pending Approval",
    textColor: "text-yellow-300",
    bgColor: "bg-yellow-900/30",
    borderColor: "border-yellow-700/50",
    dotColor: "bg-yellow-400",
  },
  approved: {
    label: "Approved",
    textColor: "text-emerald-300",
    bgColor: "bg-emerald-900/30",
    borderColor: "border-emerald-700/50",
    dotColor: "bg-emerald-400",
  },
  rejected: {
    label: "Rejected",
    textColor: "text-red-300",
    bgColor: "bg-red-900/30",
    borderColor: "border-red-700/50",
    dotColor: "bg-red-400",
  },
  fraud_detected: {
    label: "Fraud Detected",
    textColor: "text-rose-200",
    bgColor: "bg-rose-950/60",
    borderColor: "border-rose-700/50",
    dotColor: "bg-rose-500",
  },
};

export function getStatusConfig(status: InvoiceStatus): StatusConfig {
  return STATUS_MAP[status] ?? STATUS_MAP.uploaded;
}

// ─── Confidence ───────────────────────────────────────────────────────────────

export function formatConfidence(score: number | null | undefined): string {
  if (score === null || score === undefined) return "—";
  return `${(score * 100).toFixed(0)}%`;
}

export function getConfidenceColor(score: number | null | undefined): string {
  if (score === null || score === undefined) return "text-slate-400";
  if (score >= 0.9) return "text-emerald-400";
  if (score >= 0.75) return "text-yellow-400";
  return "text-red-400";
}

// ─── Role ─────────────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Administrator",
  finance_user: "Finance User",
  manager: "Manager",
  finance_head: "Finance Head",
  auditor: "Auditor",
};

export function getRoleLabel(role: UserRole): string {
  return ROLE_LABELS[role] ?? role;
}

// ─── Misc ─────────────────────────────────────────────────────────────────────

export function truncate(str: string, max: number): string {
  return str.length <= max ? str : str.slice(0, max) + "…";
}

export function fileSizeMB(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export function initials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}
