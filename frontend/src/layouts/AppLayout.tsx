import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Upload,
  FileText,
  CheckSquare,
  BarChart3,
  LogOut,
  Menu,
  X,
  FileCheck2,
  ChevronRight,
  Shield,
} from "lucide-react";
import { useAuthStore } from "../store/authStore";
import { cn, getRoleLabel, initials } from "../utils";
import type { UserRole } from "../types";

interface NavItem {
  to: string;
  icon: React.ElementType;
  label: string;
  allowedRoles?: UserRole[];
}

const NAV_ITEMS: NavItem[] = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  {
    to: "/upload",
    icon: Upload,
    label: "Upload Invoice",
    allowedRoles: ["admin", "finance_user", "manager", "finance_head"],
  },
  { to: "/invoices", icon: FileText, label: "Invoices" },
  {
    to: "/approvals",
    icon: CheckSquare,
    label: "Approvals",
    allowedRoles: ["admin", "finance_user", "manager", "finance_head"],
  },
  { to: "/analytics", icon: BarChart3, label: "Analytics" },
];

function SidebarContent({ onNavClick }: { onNavClick?: () => void }) {
  const navigate = useNavigate();
  const { user, clearAuth } = useAuthStore();

  const visibleItems = NAV_ITEMS.filter(
    (item) =>
      !item.allowedRoles ||
      (user && item.allowedRoles.includes(user.role))
  );

  const handleLogout = () => {
    clearAuth();
    navigate("/login", { replace: true });
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 border-r border-slate-700/50">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-700/50">
        <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
          <FileCheck2 className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="font-bold text-white text-sm leading-tight">
            IntelliInvoice
          </p>
          <p className="text-indigo-400 text-xs font-medium">AI Platform</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {visibleItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onNavClick}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group",
                isActive
                  ? "bg-indigo-500/15 text-indigo-400 border border-indigo-500/25"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              )
            }
          >
            {({ isActive }) => (
              <>
                <item.icon
                  className={cn(
                    "w-4.5 h-4.5 flex-shrink-0 transition-colors",
                    isActive
                      ? "text-indigo-400"
                      : "text-slate-500 group-hover:text-slate-300"
                  )}
                  size={18}
                />
                <span className="flex-1">{item.label}</span>
                {isActive && (
                  <ChevronRight className="w-3.5 h-3.5 text-indigo-400" />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User footer */}
      <div className="px-3 py-4 border-t border-slate-700/50">
        <div className="flex items-center gap-3 px-3 py-2 mb-1 rounded-lg bg-slate-800/60">
          <div className="w-8 h-8 bg-indigo-600/30 border border-indigo-500/40 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-indigo-300 text-xs font-bold">
              {initials(user?.name ?? "U")}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-slate-100 text-sm font-medium truncate">
              {user?.name}
            </p>
            <div className="flex items-center gap-1">
              <Shield className="w-3 h-3 text-indigo-400" />
              <p className="text-slate-400 text-xs truncate">
                {getRoleLabel(user?.role ?? "auditor")}
              </p>
            </div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-900/20 text-sm transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </div>
  );
}

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-slate-950 overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-shrink-0">
        <div className="w-64">
          <SidebarContent />
        </div>
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="relative w-64 h-full shadow-2xl">
            <SidebarContent onNavClick={() => setSidebarOpen(false)} />
            <button
              onClick={() => setSidebarOpen(false)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile top bar */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 bg-slate-900 border-b border-slate-700/50 flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center">
              <FileCheck2 className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-white text-sm">
              IntelliInvoice AI
            </span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-6 max-w-screen-2xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
