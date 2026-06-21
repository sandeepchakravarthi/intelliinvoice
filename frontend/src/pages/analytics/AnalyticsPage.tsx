import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { BarChart3, TrendingUp, PieChart as PieIcon } from "lucide-react";

import { dashboardApi } from "../../services/api";
import { formatCurrency, formatNumber } from "../../utils";
import { PageLoader } from "../../components/ui";
import { usePageTitle } from "../../hooks";

const CHART_COLORS = [
  "#6366f1",
  "#22c55e",
  "#eab308",
  "#ef4444",
  "#06b6d4",
  "#f97316",
  "#ec4899",
  "#8b5cf6",
];

const TOOLTIP_STYLE = {
  contentStyle: {
    backgroundColor: "#1e293b",
    border: "1px solid #334155",
    borderRadius: "10px",
    color: "#f1f5f9",
    fontSize: "12px",
  },
};

export default function AnalyticsPage() {
  const [months, setMonths] = useState(6);
  usePageTitle("Analytics");

  const { data, isLoading } = useQuery({
    queryKey: ["analytics", months],
    queryFn: () => dashboardApi.analytics(months),
  });

  if (isLoading || !data) return <PageLoader />;

  const pieData = Object.entries(data.status_distribution).map(
    ([name, value]) => ({
      name: name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      value,
    })
  );

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Analytics</h1>
          <p className="text-slate-400 text-sm mt-1">
            Invoice processing trends and insights
          </p>
        </div>
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-slate-500" />
          <select
            value={months}
            onChange={(e) => setMonths(Number(e.target.value))}
            className="bg-slate-800 border border-slate-700 text-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
          >
            <option value={3}>Last 3 months</option>
            <option value={6}>Last 6 months</option>
            <option value={12}>Last 12 months</option>
          </select>
        </div>
      </div>

      {/* Monthly trends */}
      <div className="bg-slate-800 border border-slate-700/50 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-6">
          <TrendingUp className="w-5 h-5 text-indigo-400" />
          <div>
            <h2 className="text-base font-semibold text-white">
              Monthly Volume and Spend
            </h2>
            <p className="text-slate-500 text-xs">
              Invoice count and total amount over time
            </p>
          </div>
        </div>
        {data.monthly_trends.length === 0 ? (
          <div className="flex items-center justify-center h-52 text-slate-500 text-sm">
            No data for the selected period
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={data.monthly_trends}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis
                dataKey="month"
                tick={{ fill: "#64748b", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                yAxisId="left"
                tick={{ fill: "#64748b", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fill: "#64748b", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                {...TOOLTIP_STYLE}
                formatter={(value: number, name: string) => [
                  name === "Total Amount (INR)"
                    ? formatCurrency(value)
                    : formatNumber(value),
                  name,
                ]}
              />
              <Legend
                wrapperStyle={{ color: "#94a3b8", fontSize: "12px" }}
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="count"
                stroke="#6366f1"
                strokeWidth={2.5}
                dot={{ r: 4, fill: "#6366f1" }}
                activeDot={{ r: 6 }}
                name="Invoice Count"
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="amount"
                stroke="#22c55e"
                strokeWidth={2.5}
                dot={{ r: 4, fill: "#22c55e" }}
                activeDot={{ r: 6 }}
                name="Total Amount (INR)"
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Status distribution + vendor spend */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Pie chart */}
        <div className="bg-slate-800 border border-slate-700/50 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-6">
            <PieIcon className="w-5 h-5 text-indigo-400" />
            <h2 className="text-base font-semibold text-white">
              Status Distribution
            </h2>
          </div>
          {pieData.length === 0 ? (
            <div className="flex items-center justify-center h-52 text-slate-500 text-sm">
              No data available
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={65}
                  outerRadius={105}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {pieData.map((_, i) => (
                    <Cell
                      key={i}
                      fill={CHART_COLORS[i % CHART_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip {...TOOLTIP_STYLE} />
                <Legend
                  wrapperStyle={{ color: "#94a3b8", fontSize: "11px" }}
                  iconType="circle"
                  iconSize={8}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Bar chart - top vendors */}
        <div className="bg-slate-800 border border-slate-700/50 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-6">
            <BarChart3 className="w-5 h-5 text-indigo-400" />
            <h2 className="text-base font-semibold text-white">
              Top Vendor Spend
            </h2>
          </div>
          {data.vendor_breakdown.length === 0 ? (
            <div className="flex items-center justify-center h-52 text-slate-500 text-sm">
              No vendor data available
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                data={data.vendor_breakdown.slice(0, 8)}
                layout="vertical"
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#1e293b"
                  horizontal={false}
                />
                <XAxis
                  type="number"
                  tick={{ fill: "#64748b", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                />
                <YAxis
                  type="category"
                  dataKey="vendor"
                  width={95}
                  tick={{ fill: "#94a3b8", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) =>
                    v.length > 13 ? v.slice(0, 13) + "…" : v
                  }
                />
                <Tooltip
                  {...TOOLTIP_STYLE}
                  formatter={(v: number) => [formatCurrency(v), "Total Spend"]}
                />
                <Bar
                  dataKey="total_amount"
                  fill="#6366f1"
                  radius={[0, 5, 5, 0]}
                  name="Spend"
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Vendor table */}
      {data.vendor_breakdown.length > 0 && (
        <div className="bg-slate-800 border border-slate-700/50 rounded-2xl p-6">
          <h2 className="text-base font-semibold text-white mb-5">
            Vendor Breakdown
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left text-slate-400 font-medium pb-3">
                    Vendor
                  </th>
                  <th className="text-right text-slate-400 font-medium pb-3">
                    Invoices
                  </th>
                  <th className="text-right text-slate-400 font-medium pb-3">
                    Total Spend
                  </th>
                  <th className="text-right text-slate-400 font-medium pb-3">
                    Avg Per Invoice
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.vendor_breakdown.map((v) => (
                  <tr
                    key={v.vendor}
                    className="border-b border-slate-700/30 hover:bg-slate-700/20 transition-colors"
                  >
                    <td className="py-3 text-slate-200 font-medium">
                      {v.vendor}
                    </td>
                    <td className="py-3 text-right text-slate-400">
                      {v.count}
                    </td>
                    <td className="py-3 text-right text-white font-semibold">
                      {formatCurrency(v.total_amount)}
                    </td>
                    <td className="py-3 text-right text-slate-400">
                      {v.count > 0
                        ? formatCurrency(v.total_amount / v.count)
                        : "—"}
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
