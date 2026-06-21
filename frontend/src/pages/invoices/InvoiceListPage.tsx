import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Search,
  Upload,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  SlidersHorizontal,
  RefreshCw,
} from "lucide-react";

import { invoiceApi } from "../../services/api";
import {
  formatCurrency,
  formatDate,
  formatConfidence,
  getConfidenceColor,
  getStatusConfig,
  truncate,
} from "../../utils";
import { PageLoader, EmptyState, StatusBadge } from "../../components/ui";
import { useDebounce, usePageTitle } from "../../hooks";
import type { InvoiceStatus } from "../../types";

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "All Statuses" },
  { value: "uploaded", label: "Uploaded" },
  { value: "processing", label: "Processing" },
  { value: "pending_approval", label: "Pending Approval" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "fraud_detected", label: "Fraud Detected" },
  { value: "validation_failed", label: "Validation Failed" },
];

export default function InvoiceListPage() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [vendorInput, setVendorInput] = useState("");

  usePageTitle("Invoices");

  const vendor = useDebounce(vendorInput, 400);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["invoices", page, statusFilter, vendor],
    queryFn: () =>
      invoiceApi.list({
        page,
        page_size: 20,
        status: statusFilter || undefined,
        vendor: vendor || undefined,
      }),
    placeholderData: (prev) => prev,
  });

  const handleStatusChange = (value: string) => {
    setStatusFilter(value);
    setPage(1);
  };

  const handleVendorChange = (value: string) => {
    setVendorInput(value);
    setPage(1);
  };

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Invoices</h1>
          <p className="text-slate-400 text-sm mt-1">
            {data
              ? `${data.total.toLocaleString("en-IN")} total invoices`
              : "Loading…"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="p-2.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
          </button>
          <Link
            to="/upload"
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-4 py-2.5 rounded-xl text-sm transition-colors flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            Upload New
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search by vendor name…"
            value={vendorInput}
            onChange={(e) => handleVendorChange(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-xl pl-10 pr-4 py-2.5 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
          />
        </div>
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-slate-500" />
          <select
            value={statusFilter}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <PageLoader />
      ) : !data || data.invoices.length === 0 ? (
        <div className="bg-slate-800 border border-slate-700/50 rounded-2xl">
          <EmptyState
            title="No invoices found"
            description={
              vendorInput || statusFilter
                ? "Try adjusting your search filters"
                : "Upload your first invoice to get started"
            }
            action={
              !vendorInput && !statusFilter ? (
                <Link
                  to="/upload"
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-4 py-2 rounded-lg text-sm transition-colors flex items-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  Upload Invoice
                </Link>
              ) : undefined
            }
          />
        </div>
      ) : (
        <>
          <div className="bg-slate-800 border border-slate-700/50 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left text-slate-400 font-medium px-5 py-4">
                      Invoice
                    </th>
                    <th className="text-left text-slate-400 font-medium px-5 py-4">
                      Vendor
                    </th>
                    <th className="text-left text-slate-400 font-medium px-5 py-4">
                      Date
                    </th>
                    <th className="text-right text-slate-400 font-medium px-5 py-4">
                      Amount
                    </th>
                    <th className="text-left text-slate-400 font-medium px-5 py-4">
                      Status
                    </th>
                    <th className="text-center text-slate-400 font-medium px-5 py-4">
                      Confidence
                    </th>
                    <th className="text-center text-slate-400 font-medium px-5 py-4">
                      Flags
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.invoices.map((invoice) => {
                    const hasFraud =
                      invoice.fraud_flags && invoice.fraud_flags.length > 0;
                    const hasErrors =
                      invoice.validation_errors &&
                      invoice.validation_errors.length > 0;
                    return (
                      <tr
                        key={invoice.id}
                        className="border-b border-slate-700/30 hover:bg-slate-700/20 transition-colors"
                      >
                        <td className="px-5 py-4">
                          <Link
                            to={`/invoices/${invoice.id}`}
                            className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
                          >
                            {invoice.invoice_number
                              ? truncate(invoice.invoice_number, 22)
                              : (
                                <span className="text-slate-500 italic">
                                  No number
                                </span>
                              )}
                          </Link>
                          <p className="text-slate-500 text-xs mt-0.5">
                            {truncate(invoice.file_name, 26)}
                          </p>
                        </td>
                        <td className="px-5 py-4 text-slate-300">
                          {invoice.vendor_name
                            ? truncate(invoice.vendor_name, 26)
                            : (
                              <span className="text-slate-500">—</span>
                            )}
                        </td>
                        <td className="px-5 py-4 text-slate-400">
                          {formatDate(invoice.invoice_date)}
                        </td>
                        <td className="px-5 py-4 text-right font-semibold text-white">
                          {formatCurrency(invoice.total_amount)}
                        </td>
                        <td className="px-5 py-4">
                          <StatusBadge status={invoice.status as InvoiceStatus} />
                        </td>
                        <td className="px-5 py-4 text-center">
                          <span
                            className={`font-semibold ${getConfidenceColor(
                              invoice.confidence_score
                            )}`}
                          >
                            {formatConfidence(invoice.confidence_score)}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-center">
                          {(hasFraud || hasErrors) ? (
                            <span title="Has flags or errors">
                              <AlertTriangle className="w-4 h-4 text-amber-400 mx-auto" />
                            </span>
                          ) : (
                            <span className="text-slate-600 text-xs">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {data.total_pages > 1 && (
            <div className="flex items-center justify-between mt-5">
              <p className="text-slate-500 text-sm">
                Page {data.page} of {data.total_pages} •{" "}
                {data.total.toLocaleString("en-IN")} results
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-xl disabled:opacity-40 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() =>
                    setPage((p) => Math.min(data.total_pages, p + 1))
                  }
                  disabled={page === data.total_pages}
                  className="p-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-xl disabled:opacity-40 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
