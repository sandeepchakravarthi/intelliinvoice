import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Download,
  CheckCircle2,
  XCircle,
  Edit3,
  Save,
  X,
  AlertTriangle,
  Loader2,
  Building2,
  Calendar,
  Hash,
  FileText,
  ShieldAlert,
  Clock,
  Info,
} from "lucide-react";
import toast from "react-hot-toast";

import { invoiceApi, approvalApi } from "../../services/api";
import { extractError } from "../../services/apiClient";
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatRelativeTime,
  formatConfidence,
  getConfidenceColor,
} from "../../utils";
import {
  PageLoader,
  StatusBadge,
  Modal,
  AlertBanner,
  DataRow,
} from "../../components/ui";
import { useAuthStore } from "../../store/authStore";
import { usePageTitle } from "../../hooks";
import type { InvoiceUpdatePayload } from "../../types";

function RejectModal({
  isOpen,
  onClose,
  onConfirm,
  isPending,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  isPending: boolean;
}) {
  const [reason, setReason] = useState("");
  const valid = reason.trim().length >= 5;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Reject Invoice">
      <p className="text-slate-400 text-sm mb-4">
        Provide a reason for rejection. This will be recorded in the audit log.
      </p>
      <textarea
        rows={4}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Enter rejection reason (minimum 5 characters)…"
        className="w-full bg-slate-700/50 border border-slate-600 text-slate-100 rounded-xl px-3 py-2.5 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none mb-5"
      />
      <div className="flex gap-3">
        <button onClick={onClose} className="flex-1 btn-secondary">
          Cancel
        </button>
        <button
          onClick={() => valid && onConfirm(reason)}
          disabled={!valid || isPending}
          className="flex-1 bg-red-700 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2 rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
        >
          {isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <XCircle className="w-4 h-4" />
          )}
          Confirm Rejection
        </button>
      </div>
    </Modal>
  );
}

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  const [isEditing, setIsEditing] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [editData, setEditData] = useState<InvoiceUpdatePayload>({});

  const { data: invoice, isLoading } = useQuery({
    queryKey: ["invoice", id],
    queryFn: () => invoiceApi.getById(id!),
    enabled: !!id,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "processing" || status === "uploaded" || status === "extracted"
        ? 5000
        : false;
    },
  });

  usePageTitle(invoice?.invoice_number ?? "Invoice Detail");

  const saveMutation = useMutation({
    mutationFn: () => invoiceApi.update(id!, editData),
    onSuccess: () => {
      toast.success("Invoice updated");
      queryClient.invalidateQueries({ queryKey: ["invoice", id] });
      setIsEditing(false);
      setEditData({});
    },
    onError: (err) => toast.error(extractError(err)),
  });

  const approveMutation = useMutation({
    mutationFn: () => approvalApi.approve(id!),
    onSuccess: () => {
      toast.success("Invoice approved");
      queryClient.invalidateQueries({ queryKey: ["invoice", id] });
      queryClient.invalidateQueries({ queryKey: ["pending-approvals"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
    onError: (err) => toast.error(extractError(err)),
  });

  const rejectMutation = useMutation({
    mutationFn: (reason: string) => approvalApi.reject(id!, reason),
    onSuccess: () => {
      toast.success("Invoice rejected");
      setShowReject(false);
      queryClient.invalidateQueries({ queryKey: ["invoice", id] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
    onError: (err) => toast.error(extractError(err)),
  });

  const handleDownload = async () => {
    try {
      const url = await invoiceApi.getDownloadUrl(id!);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error(extractError(err));
    }
  };

  const startEdit = () => {
    setEditData({
      vendor_name: invoice?.vendor_name ?? "",
      invoice_number: invoice?.invoice_number ?? "",
      vendor_gstin: invoice?.vendor_gstin ?? "",
      description: invoice?.description ?? "",
      total_amount: invoice?.total_amount ?? undefined,
      tax_amount: invoice?.tax_amount ?? undefined,
      subtotal_amount: invoice?.subtotal_amount ?? undefined,
    });
    setIsEditing(true);
  };

  if (isLoading || !invoice) return <PageLoader />;

  const canApprove =
    invoice.status === "pending_approval" &&
    user?.role !== "auditor";
  const canEdit =
    invoice.status !== "approved" && invoice.status !== "rejected";
  const isProcessing =
    invoice.status === "processing" ||
    invoice.status === "uploaded" ||
    invoice.status === "extracted";

  return (
    <div className="max-w-5xl mx-auto animate-fade-in">
      {/* Top bar */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold text-white">
              {invoice.invoice_number ?? "Invoice Details"}
            </h1>
            <StatusBadge status={invoice.status} />
            {invoice.fraud_flags && invoice.fraud_flags.length > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-950/60 text-rose-300 border border-rose-700/50">
                <ShieldAlert className="w-3.5 h-3.5" />
                Fraud Flag
              </span>
            )}
          </div>
          <p className="text-slate-400 text-sm mt-0.5">{invoice.file_name}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {canEdit && !isEditing && (
            <button
              onClick={startEdit}
              className="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl text-sm transition-colors"
            >
              <Edit3 className="w-4 h-4" />
              Edit
            </button>
          )}
          <button
            onClick={handleDownload}
            className="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl text-sm transition-colors"
          >
            <Download className="w-4 h-4" />
            Download
          </button>
        </div>
      </div>

      {/* Processing banner */}
      {isProcessing && (
        <div className="mb-5 flex items-center gap-3 bg-blue-950/40 border border-blue-800/40 rounded-xl px-4 py-3">
          <Loader2 className="w-4 h-4 animate-spin text-blue-400 flex-shrink-0" />
          <p className="text-blue-300 text-sm">
            AI pipeline is processing this invoice. Page auto-refreshes every 5
            seconds.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left - main content */}
        <div className="lg:col-span-2 space-y-5">
          {/* Invoice fields */}
          <div className="bg-slate-800 border border-slate-700/50 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-400" />
                Invoice Information
              </h2>
              {isEditing && (
                <div className="flex gap-2">
                  <button
                    onClick={() => saveMutation.mutate()}
                    disabled={saveMutation.isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                  >
                    {saveMutation.isPending ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Save className="w-3.5 h-3.5" />
                    )}
                    Save
                  </button>
                  <button
                    onClick={() => setIsEditing(false)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-xs font-medium transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                    Cancel
                  </button>
                </div>
              )}
            </div>

            {isEditing ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { key: "invoice_number", label: "Invoice Number", icon: Hash },
                  { key: "vendor_name", label: "Vendor Name", icon: Building2 },
                  { key: "vendor_gstin", label: "GSTIN", icon: Hash },
                  { key: "description", label: "Description", icon: Info },
                ].map(({ key, label, icon: Icon }) => (
                  <div key={key}>
                    <label className="flex items-center gap-1.5 text-xs text-slate-500 mb-1.5">
                      <Icon className="w-3.5 h-3.5" />
                      {label}
                    </label>
                    <input
                      type="text"
                      value={(editData as Record<string, string>)[key] ?? ""}
                      onChange={(e) =>
                        setEditData((d) => ({ ...d, [key]: e.target.value }))
                      }
                      className="w-full bg-slate-700/50 border border-slate-600 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>
                ))}
                {[
                  { key: "total_amount", label: "Total Amount" },
                  { key: "tax_amount", label: "Tax Amount" },
                  { key: "subtotal_amount", label: "Subtotal Amount" },
                ].map(({ key, label }) => (
                  <div key={key}>
                    <label className="text-xs text-slate-500 mb-1.5 block">
                      {label}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={
                        (editData as Record<string, number | undefined>)[key] ??
                        ""
                      }
                      onChange={(e) =>
                        setEditData((d) => ({
                          ...d,
                          [key]: e.target.value
                            ? parseFloat(e.target.value)
                            : undefined,
                        }))
                      }
                      className="w-full bg-slate-700/50 border border-slate-600 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>
                ))}
                <div>
                  <label className="flex items-center gap-1.5 text-xs text-slate-500 mb-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    Invoice Date
                  </label>
                  <input
                    type="date"
                    value={(editData.invoice_date as string) ?? ""}
                    onChange={(e) =>
                      setEditData((d) => ({
                        ...d,
                        invoice_date: e.target.value,
                      }))
                    }
                    className="w-full bg-slate-700/50 border border-slate-600 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
              </div>
            ) : (
              <div>
                <DataRow
                  label="Invoice Number"
                  value={invoice.invoice_number}
                  mono
                />
                <DataRow label="Vendor Name" value={invoice.vendor_name} />
                <DataRow
                  label="GSTIN"
                  value={invoice.vendor_gstin}
                  mono
                />
                <DataRow
                  label="Invoice Date"
                  value={formatDate(invoice.invoice_date)}
                />
                <DataRow
                  label="Due Date"
                  value={formatDate(invoice.due_date)}
                />
                <DataRow
                  label="Currency"
                  value={invoice.currency}
                />
                <DataRow
                  label="Total Amount"
                  value={
                    <span className="font-bold text-white">
                      {formatCurrency(invoice.total_amount)}
                    </span>
                  }
                />
                <DataRow
                  label="Tax Amount"
                  value={formatCurrency(invoice.tax_amount)}
                />
                <DataRow
                  label="Subtotal"
                  value={formatCurrency(invoice.subtotal_amount)}
                />
                {invoice.description && (
                  <DataRow label="Description" value={invoice.description} />
                )}
              </div>
            )}
          </div>

          {/* Line items */}
          {invoice.line_items && invoice.line_items.length > 0 && (
            <div className="bg-slate-800 border border-slate-700/50 rounded-2xl p-6">
              <h2 className="text-base font-semibold text-white mb-4">
                Line Items
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="text-left text-slate-400 font-medium pb-3">
                        Description
                      </th>
                      <th className="text-right text-slate-400 font-medium pb-3">
                        Qty
                      </th>
                      <th className="text-right text-slate-400 font-medium pb-3">
                        Unit Price
                      </th>
                      <th className="text-right text-slate-400 font-medium pb-3">
                        Amount
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.line_items.map((item, i) => (
                      <tr
                        key={i}
                        className="border-b border-slate-700/30"
                      >
                        <td className="py-2.5 text-slate-300">
                          {item.description}
                        </td>
                        <td className="py-2.5 text-right text-slate-400">
                          {item.quantity}
                        </td>
                        <td className="py-2.5 text-right text-slate-400">
                          {formatCurrency(item.unit_price)}
                        </td>
                        <td className="py-2.5 text-right text-white font-medium">
                          {formatCurrency(item.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Validation errors */}
          {invoice.validation_errors &&
            invoice.validation_errors.length > 0 && (
              <AlertBanner
                type="error"
                title="Validation Issues"
                items={invoice.validation_errors}
              />
            )}

          {/* Validation warnings */}
          {invoice.validation_warnings &&
            invoice.validation_warnings.length > 0 && (
              <AlertBanner
                type="warning"
                title="Validation Warnings"
                items={invoice.validation_warnings}
              />
            )}

          {/* Fraud flags */}
          {invoice.fraud_flags && invoice.fraud_flags.length > 0 && (
            <AlertBanner
              type="error"
              title="Fraud Detection Flags"
              items={invoice.fraud_flags}
            />
          )}

          {/* Rejection reason */}
          {invoice.rejection_reason && (
            <div className="bg-red-950/40 border border-red-800/40 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1.5 text-red-300 font-medium text-sm">
                <XCircle className="w-4 h-4" />
                Rejection Reason
              </div>
              <p className="text-slate-300 text-sm">
                {invoice.rejection_reason}
              </p>
            </div>
          )}
        </div>

        {/* Right - sidebar */}
        <div className="space-y-4">
          {/* Actions */}
          {canApprove && (
            <div className="bg-slate-800 border border-slate-700/50 rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-white mb-4">
                Approval Actions
              </h3>
              <div className="space-y-2.5">
                <button
                  onClick={() => approveMutation.mutate()}
                  disabled={approveMutation.isPending}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-700/30 hover:bg-emerald-700/50 text-emerald-300 border border-emerald-700/40 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {approveMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  Approve Invoice
                </button>
                <button
                  onClick={() => setShowReject(true)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-red-900/30 hover:bg-red-900/50 text-red-300 border border-red-700/40 rounded-xl text-sm font-medium transition-colors"
                >
                  <XCircle className="w-4 h-4" />
                  Reject Invoice
                </button>
              </div>
              {invoice.current_approver_role && (
                <p className="text-slate-500 text-xs mt-3 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Awaiting:{" "}
                  <span className="text-slate-400 capitalize">
                    {invoice.current_approver_role.replace(/_/g, " ")}
                  </span>
                </p>
              )}
            </div>
          )}

          {/* Processing info */}
          <div className="bg-slate-800 border border-slate-700/50 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-white mb-4">
              Processing Details
            </h3>
            <div className="space-y-0">
              <DataRow
                label="OCR Confidence"
                value={
                  <span
                    className={`font-semibold ${getConfidenceColor(
                      invoice.confidence_score
                    )}`}
                  >
                    {formatConfidence(invoice.confidence_score)}
                  </span>
                }
              />
              <DataRow
                label="Fraud Status"
                value={
                  <span
                    className={
                      invoice.fraud_status === "clear"
                        ? "text-emerald-400"
                        : "text-red-400"
                    }
                  >
                    {invoice.fraud_status.charAt(0).toUpperCase() +
                      invoice.fraud_status.slice(1)}
                  </span>
                }
              />
              <DataRow
                label="Uploaded"
                value={formatRelativeTime(invoice.created_at)}
              />
              <DataRow
                label="Last Updated"
                value={formatDateTime(invoice.updated_at)}
              />
              {invoice.approved_at && (
                <DataRow
                  label="Approved"
                  value={
                    <span className="text-emerald-400">
                      {formatDateTime(invoice.approved_at)}
                    </span>
                  }
                />
              )}
            </div>
          </div>

          {/* Raw OCR (collapsible) */}
          {invoice.raw_ocr_text && (
            <details className="bg-slate-800 border border-slate-700/50 rounded-2xl">
              <summary className="px-5 py-4 text-sm font-semibold text-white cursor-pointer hover:text-slate-200 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-slate-500" />
                Raw OCR Text
              </summary>
              <div className="px-5 pb-5">
                <pre className="text-slate-400 text-xs whitespace-pre-wrap font-mono bg-slate-900 rounded-lg p-3 max-h-64 overflow-y-auto">
                  {invoice.raw_ocr_text}
                </pre>
              </div>
            </details>
          )}
        </div>
      </div>

      <RejectModal
        isOpen={showReject}
        onClose={() => setShowReject(false)}
        onConfirm={(reason) => rejectMutation.mutate(reason)}
        isPending={rejectMutation.isPending}
      />
    </div>
  );
}
