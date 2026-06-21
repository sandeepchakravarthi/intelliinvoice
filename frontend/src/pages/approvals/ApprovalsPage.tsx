import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Building2,
  IndianRupee,
  ExternalLink,
} from "lucide-react";
import toast from "react-hot-toast";

import { approvalApi } from "../../services/api";
import { extractError } from "../../services/apiClient";
import { formatCurrency, formatDate, formatDateTime } from "../../utils";
import { PageLoader, EmptyState, Modal } from "../../components/ui";
import { useAuthStore } from "../../store/authStore";
import { usePageTitle } from "../../hooks";
import type { Invoice } from "../../types";

function RejectModal({
  invoice,
  onClose,
  onConfirm,
  isPending,
}: {
  invoice: Invoice;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  isPending: boolean;
}) {
  const [reason, setReason] = useState("");
  const valid = reason.trim().length >= 5;
  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={`Reject: ${invoice.invoice_number ?? invoice.file_name}`}
    >
      <p className="text-slate-400 text-sm mb-4">
        Rejection reason is required and will appear in the audit log.
      </p>
      <textarea
        rows={4}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Enter reason for rejection…"
        className="w-full bg-slate-700/50 border border-slate-600 text-slate-100 rounded-xl px-3 py-2.5 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none mb-5"
        autoFocus
      />
      <div className="flex gap-3">
        <button onClick={onClose} className="flex-1 btn-secondary py-2">
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
          Reject Invoice
        </button>
      </div>
    </Modal>
  );
}

function ApproveCommentsModal({
  invoice,
  onClose,
  onConfirm,
  isPending,
}: {
  invoice: Invoice;
  onClose: () => void;
  onConfirm: (comments: string) => void;
  isPending: boolean;
}) {
  const [comments, setComments] = useState("");
  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={`Approve: ${invoice.invoice_number ?? invoice.file_name}`}
    >
      <div className="mb-5 bg-slate-700/40 rounded-xl p-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-slate-400">Vendor</span>
          <span className="text-slate-200 font-medium">
            {invoice.vendor_name ?? "—"}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-400">Amount</span>
          <span className="text-white font-bold">
            {formatCurrency(invoice.total_amount)}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-400">Invoice Date</span>
          <span className="text-slate-300">
            {formatDate(invoice.invoice_date)}
          </span>
        </div>
      </div>
      <textarea
        rows={3}
        value={comments}
        onChange={(e) => setComments(e.target.value)}
        placeholder="Optional approval comments…"
        className="w-full bg-slate-700/50 border border-slate-600 text-slate-100 rounded-xl px-3 py-2.5 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none mb-5"
      />
      <div className="flex gap-3">
        <button onClick={onClose} className="flex-1 btn-secondary py-2">
          Cancel
        </button>
        <button
          onClick={() => onConfirm(comments)}
          disabled={isPending}
          className="flex-1 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white font-medium py-2 rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
        >
          {isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <CheckCircle2 className="w-4 h-4" />
          )}
          Confirm Approval
        </button>
      </div>
    </Modal>
  );
}

export default function ApprovalsPage() {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const [approvingInvoice, setApprovingInvoice] = useState<Invoice | null>(null);
  const [rejectingInvoice, setRejectingInvoice] = useState<Invoice | null>(null);

  usePageTitle("Approvals");

  const { data: invoices = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ["pending-approvals"],
    queryFn: approvalApi.pending,
    refetchInterval: 30_000,
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, comments }: { id: string; comments: string }) =>
      approvalApi.approve(id, comments),
    onSuccess: () => {
      toast.success("Invoice approved");
      setApprovingInvoice(null);
      queryClient.invalidateQueries({ queryKey: ["pending-approvals"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
    onError: (err) => toast.error(extractError(err)),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      approvalApi.reject(id, reason),
    onSuccess: () => {
      toast.success("Invoice rejected");
      setRejectingInvoice(null);
      queryClient.invalidateQueries({ queryKey: ["pending-approvals"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
    onError: (err) => toast.error(extractError(err)),
  });

  if (isLoading) return <PageLoader />;

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Approval Queue</h1>
          <p className="text-slate-400 text-sm mt-1">
            {invoices.length} invoice{invoices.length !== 1 ? "s" : ""} awaiting
            your review
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="p-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-xl transition-colors disabled:opacity-50"
        >
          <RefreshCw
            className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`}
          />
        </button>
      </div>

      {/* Role info banner */}
      <div className="mb-5 flex items-center gap-3 bg-indigo-950/40 border border-indigo-800/40 rounded-xl px-4 py-3">
        <Clock className="w-4 h-4 text-indigo-400 flex-shrink-0" />
        <p className="text-indigo-300 text-sm">
          Showing invoices routed to your role:{" "}
          <strong className="capitalize">
            {user?.role.replace(/_/g, " ")}
          </strong>
          . Amount authority based on your role level.
        </p>
      </div>

      {invoices.length === 0 ? (
        <div className="bg-slate-800 border border-slate-700/50 rounded-2xl">
          <EmptyState
            icon={CheckCircle2}
            title="All caught up!"
            description="No invoices are pending your approval right now. Check back later."
          />
        </div>
      ) : (
        <div className="space-y-4">
          {invoices.map((invoice) => {
            const hasFraud =
              invoice.fraud_flags && invoice.fraud_flags.length > 0;
            return (
              <div
                key={invoice.id}
                className={`bg-slate-800 border rounded-2xl p-5 transition-colors ${
                  hasFraud
                    ? "border-red-800/50"
                    : "border-slate-700/50 hover:border-slate-600"
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                  {/* Main info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-slate-700 rounded-xl flex items-center justify-center flex-shrink-0">
                        <IndianRupee className="w-5 h-5 text-slate-400" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link
                            to={`/invoices/${invoice.id}`}
                            className="font-semibold text-white hover:text-indigo-400 transition-colors"
                          >
                            {invoice.invoice_number ?? "No Invoice Number"}
                          </Link>
                          <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                          {hasFraud && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-950/60 text-rose-300 border border-rose-700/40 rounded-full text-xs font-medium">
                              <AlertTriangle className="w-3 h-3" />
                              Fraud Flag
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-slate-400 text-sm mt-0.5">
                          <Building2 className="w-3.5 h-3.5" />
                          {invoice.vendor_name ?? "Unknown Vendor"}
                        </div>
                        {hasFraud && (
                          <div className="mt-2 space-y-1">
                            {invoice.fraud_flags!.map((flag, i) => (
                              <p
                                key={i}
                                className="text-xs text-red-400 flex items-start gap-1.5"
                              >
                                <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                                {flag}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Meta */}
                  <div className="flex items-center gap-6 text-sm flex-shrink-0">
                    <div className="text-center">
                      <p className="text-slate-500 text-xs mb-0.5">Amount</p>
                      <p className="text-white font-bold">
                        {formatCurrency(invoice.total_amount)}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-slate-500 text-xs mb-0.5">
                        Invoice Date
                      </p>
                      <p className="text-slate-300">
                        {formatDate(invoice.invoice_date)}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-slate-500 text-xs mb-0.5">
                        Submitted
                      </p>
                      <p className="text-slate-300">
                        {formatDateTime(invoice.created_at)}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-slate-500 text-xs mb-0.5">Routed To</p>
                      <p className="text-slate-300 capitalize">
                        {invoice.current_approver_role?.replace(/_/g, " ") ??
                          "Any"}
                      </p>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-2.5 flex-shrink-0">
                    <button
                      onClick={() => setRejectingInvoice(invoice)}
                      className="flex items-center gap-1.5 px-4 py-2 bg-red-900/30 hover:bg-red-900/50 text-red-300 border border-red-800/40 rounded-xl text-sm font-medium transition-colors"
                    >
                      <XCircle className="w-4 h-4" />
                      Reject
                    </button>
                    <button
                      onClick={() => setApprovingInvoice(invoice)}
                      className="flex items-center gap-1.5 px-4 py-2 bg-emerald-900/30 hover:bg-emerald-900/50 text-emerald-300 border border-emerald-800/40 rounded-xl text-sm font-medium transition-colors"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Approve
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {approvingInvoice && (
        <ApproveCommentsModal
          invoice={approvingInvoice}
          onClose={() => setApprovingInvoice(null)}
          onConfirm={(comments) =>
            approveMutation.mutate({
              id: approvingInvoice.id,
              comments,
            })
          }
          isPending={approveMutation.isPending}
        />
      )}

      {rejectingInvoice && (
        <RejectModal
          invoice={rejectingInvoice}
          onClose={() => setRejectingInvoice(null)}
          onConfirm={(reason) =>
            rejectMutation.mutate({ id: rejectingInvoice.id, reason })
          }
          isPending={rejectMutation.isPending}
        />
      )}
    </div>
  );
}
