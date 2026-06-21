import { useQuery } from "@tanstack/react-query";
import {
  TrendingUp,
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  IndianRupee,
  Timer,
  BarChart3,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

import { dashboardApi } from "../../services/api";
import { formatCurrency, formatDate, formatNumber } from "../../utils";
import { PageLoader, StatusBadge } from "../../components/ui";
import { useAuthStore } from "../../store/authStore";
import { usePageTitle } from "../../hooks";
import type { InvoiceStatus } from "../../types";

const TOOLTIP_STYLE = {
  contentStyle: {
    backgroundColor: "#1e293b",
    border: "1px solid #334155",
    borderRadius: "10px",
    color: "#f1f5f9",
    fontSize: "12px",
  },
  cursor: { stroke: "#6366f1", strokeWidth: 1 },
};

interface KpiCardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  sub?: string;
  trend?: "up" | "down" | "neutral";
}

function KpiCard({
  title,
  value,
  icon: Icon,
  iconBg,
  iconColor,
  sub,
}: KpiCardProps) {
  return (
    <div className="bg-slate-800 border border-slate-700/50 rounded-2xl p-5 hover:border-slate-600 transition-colors">
      <div className="flex items-start justify-between mb-4">
        <p className="text-slate-400 text-sm font-medium">{title}</p>
        <div className={`w-10 h-10 ${iconBg} rounded-xl flex items-center justify-center`}>
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </div>
      </div>
      <p className="text-3xl font-bold text-white tracking-tight">{value}</p>
      {sub && <p className="text-slate-500 text-xs mt-1">{sub}</p>}
    </div>
  );
}

const STATUS_ORDER: InvoiceStatus[] = [
  "pending_approval",
  "approved",
  "rejected",
  "fraud_detected",
  "processing",
  "validation_failed",
  "uploaded",
  "extracted",
];

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  usePageTitle("Dashboard");

  const { data: stats, isLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: dashboardApi.stats,
    refetchInterval: 30_000,
  });

  if (isLoading || !stats) return <PageLoader />;

  const chartData = stats.monthly_trend.slice(-14);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">
          Welcome back, {user?.name.split(" ")[0]} 👋
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Here is your invoice processing overview
        </p>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          title="Total Invoices"
          value={formatNumber(stats.total_invoices)}
          icon={FileText}
          iconBg="bg-indigo-500/15"
          iconColor="text-indigo-400"
          sub="All time"
        />
        <KpiCard
          title="Pending Approval"
          value={formatNumber(stats.pending_approvals)}
          icon={Clock}
          iconBg="bg-yellow-500/15"
          iconColor="text-yellow-400"
          sub="Awaiting action"
        />
        <KpiCard
          title="Approved Today"
          value={formatNumber(stats.approved_today)}
          icon={CheckCircle2}
          iconBg="bg-emerald-500/15"
          iconColor="text-emerald-400"
        />
        <KpiCard
          title="Fraud Alerts"
          value={formatNumber(stats.fraud_alerts)}
          icon={ShieldAlert}
          iconBg="bg-red-500/15"
          iconColor="text-red-400"
          sub="Requires review"
        />
      </div>

      {/* Second row KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          title="Total Processed"
          value={formatCurrency(stats.total_amount_processed)}
          icon={IndianRupee}
          iconBg="bg-emerald-500/15"
          iconColor="text-emerald-400"
          sub="Approved invoices"
        />
        <KpiCard
          title="Rejected Today"
          value={formatNumber(stats.rejected_today)}
          icon={XCircle}
          iconBg="bg-red-500/15"
          iconColor="text-red-400"
        />
        <KpiCard
          title="Avg Processing Time"
          value={`${stats.average_processing_time_hours.toFixed(1)}h`}
          icon={Timer}
          iconBg="bg-blue-500/15"
          iconColor="text-blue-400"
          sub="Per invoice"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Area chart */}
        <div className="xl:col-span-2 bg-slate-800 border border-slate-700/50 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-base font-semibold text-white">
                Invoice Volume (Last 14 Days)
              </h2>
              <p className="text-slate-500 text-xs mt-0.5">
                Daily upload trend
              </p>
            </div>
            <BarChart3 className="w-5 h-5 text-slate-500" />
          </div>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "#64748b", fontSize: 11 }}
                  tickFormatter={(v) => v.slice(5)}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "#64748b", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip {...TOOLTIP_STYLE} />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="#6366f1"
                  strokeWidth={2}
                  fill="url(#colorCount)"
                  name="Invoices"
                  dot={false}
                  activeDot={{ r: 4, fill: "#6366f1" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-52 text-slate-500 text-sm">
              No data yet. Upload your first invoice.
            </div>
          )}
        </div>

        {/* Status breakdown */}
        <div className="bg-slate-800 border border-slate-700/50 rounded-2xl p-6">
          <h2 className="text-base font-semibold text-white mb-5">
            Status Breakdown
          </h2>
          <div className="space-y-3">
            {STATUS_ORDER.filter(
              (s) => (stats.invoices_by_status[s] ?? 0) > 0
            ).map((status) => {
              const count = stats.invoices_by_status[status] ?? 0;
              const pct =
                stats.total_invoices > 0
                  ? Math.round((count / stats.total_invoices) * 100)
                  : 0;
              return (
                <div key={status}>
                  <div className="flex items-center justify-between mb-1.5">
                    <StatusBadge status={status} />
                    <span className="text-slate-400 text-xs">
                      {count} ({pct}%)
                    </span>
                  </div>
                  <div className="h-1 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {Object.keys(stats.invoices_by_status).length === 0 && (
              <p className="text-slate-500 text-sm">No invoices yet</p>
            )}
          </div>
        </div>
      </div>

      {/* Top vendors */}
      {stats.top_vendors.length > 0 && (
        <div className="bg-slate-800 border border-slate-700/50 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-5">
            <TrendingUp className="w-5 h-5 text-indigo-400" />
            <h2 className="text-base font-semibold text-white">
              Top Vendors by Spend
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left text-slate-400 font-medium pb-3 pr-4">
                    Rank
                  </th>
                  <th className="text-left text-slate-400 font-medium pb-3">
                    Vendor
                  </th>
                  <th className="text-right text-slate-400 font-medium pb-3">
                    Invoices
                  </th>
                  <th className="text-right text-slate-400 font-medium pb-3">
                    Total Spend
                  </th>
                  <th className="text-right text-slate-400 font-medium pb-3 pl-4">
                    Last Invoice
                  </th>
                </tr>
              </thead>
              <tbody>
                {stats.top_vendors.slice(0, 8).map((v, i) => (
                  <tr
                    key={v.vendor}
                    className="border-b border-slate-700/30 hover:bg-slate-700/20 transition-colors"
                  >
                    <td className="py-3 pr-4">
                      <span className="text-slate-500 text-xs font-mono">
                        #{i + 1}
                      </span>
                    </td>
                    <td className="py-3 text-slate-200 font-medium">
                      {v.vendor}
                    </td>
                    <td className="py-3 text-right text-slate-400">
                      {v.invoice_count}
                    </td>
                    <td className="py-3 text-right text-white font-semibold">
                      {formatCurrency(v.total_amount)}
                    </td>
                    <td className="py-3 text-right text-slate-500 pl-4">
                      —
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
