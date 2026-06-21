import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Eye,
  EyeOff,
  FileCheck2,
  Loader2,
  Lock,
  Mail,
  User,
  ShieldCheck,
} from "lucide-react";
import toast from "react-hot-toast";

import { authApi } from "../../services/api";
import { useAuthStore } from "../../store/authStore";
import { extractError } from "../../services/apiClient";
import { usePageTitle } from "../../hooks";

const schema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Enter a valid email address"),
  password: z
    .string()
    .min(8, "Minimum 8 characters")
    .regex(/[A-Z]/, "Must contain an uppercase letter")
    .regex(/[0-9]/, "Must contain a number"),
  role: z.enum([
    "finance_user",
    "manager",
    "finance_head",
    "auditor",
  ]),
});

type FormData = z.infer<typeof schema>;

const ROLES = [
  {
    value: "finance_user",
    label: "Finance User",
    desc: "Upload and process invoices",
  },
  {
    value: "manager",
    label: "Manager",
    desc: "Approve invoices up to ₹50,000",
  },
  {
    value: "finance_head",
    label: "Finance Head",
    desc: "Full approval authority",
  },
  { value: "auditor", label: "Auditor", desc: "Read-only access" },
];

export default function RegisterPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [showPassword, setShowPassword] = useState(false);

  usePageTitle("Create Account");

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { role: "finance_user" },
  });

  const password = watch("password", "");

  const strengthChecks = [
    { label: "8+ characters", ok: password.length >= 8 },
    { label: "Uppercase letter", ok: /[A-Z]/.test(password) },
    { label: "Number", ok: /[0-9]/.test(password) },
  ];

  const onSubmit = async (data: FormData) => {
    try {
      const res = await authApi.register(
        data.name,
        data.email,
        data.password,
        data.role
      );
      setAuth(res.user, res.tokens);
      toast.success("Account created successfully!");
      navigate("/dashboard", { replace: true });
    } catch (err) {
      toast.error(extractError(err));
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-950/30 via-slate-950 to-slate-950 pointer-events-none" />

      <div className="relative w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-2xl mb-5 shadow-2xl shadow-indigo-500/25">
            <FileCheck2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">
            Create Account
          </h1>
          <p className="text-slate-400 mt-2 text-sm">
            Join IntelliInvoice AI
          </p>
        </div>

        <div className="bg-slate-800/80 backdrop-blur border border-slate-700/60 rounded-2xl p-8 shadow-2xl">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Full Name
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="John Smith"
                  className="w-full bg-slate-700/50 border border-slate-600 text-slate-100 rounded-lg pl-10 pr-4 py-2.5 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  {...register("name")}
                />
              </div>
              {errors.name && (
                <p className="mt-1.5 text-xs text-red-400">
                  {errors.name.message}
                </p>
              )}
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="email"
                  placeholder="you@company.com"
                  className="w-full bg-slate-700/50 border border-slate-600 text-slate-100 rounded-lg pl-10 pr-4 py-2.5 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  {...register("email")}
                />
              </div>
              {errors.email && (
                <p className="mt-1.5 text-xs text-red-400">
                  {errors.email.message}
                </p>
              )}
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Create a strong password"
                  className="w-full bg-slate-700/50 border border-slate-600 text-slate-100 rounded-lg pl-10 pr-10 py-2.5 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  {...register("password")}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              {password && (
                <div className="mt-2 flex gap-3">
                  {strengthChecks.map((check) => (
                    <div
                      key={check.label}
                      className="flex items-center gap-1 text-xs"
                    >
                      <div
                        className={`w-1.5 h-1.5 rounded-full ${
                          check.ok ? "bg-emerald-400" : "bg-slate-600"
                        }`}
                      />
                      <span
                        className={
                          check.ok ? "text-emerald-400" : "text-slate-500"
                        }
                      >
                        {check.label}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {errors.password && (
                <p className="mt-1.5 text-xs text-red-400">
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* Role */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Role
              </label>
              <div className="grid grid-cols-2 gap-2">
                {ROLES.map((role) => (
                  <label
                    key={role.value}
                    className="relative cursor-pointer"
                  >
                    <input
                      type="radio"
                      value={role.value}
                      className="sr-only peer"
                      {...register("role")}
                    />
                    <div className="p-3 rounded-lg border border-slate-600 bg-slate-700/40 peer-checked:border-indigo-500 peer-checked:bg-indigo-500/10 transition-all">
                      <div className="flex items-start gap-2">
                        <ShieldCheck className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-slate-200 text-xs font-medium">
                            {role.label}
                          </p>
                          <p className="text-slate-500 text-xs mt-0.5">
                            {role.desc}
                          </p>
                        </div>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
              {errors.role && (
                <p className="mt-1.5 text-xs text-red-400">
                  {errors.role.message}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 mt-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating account…
                </>
              ) : (
                "Create Account"
              )}
            </button>
          </form>

          <p className="text-center text-slate-400 text-sm mt-6">
            Already have an account?{" "}
            <Link
              to="/login"
              className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
