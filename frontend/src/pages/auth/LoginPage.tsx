import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, FileCheck2, Loader2, Lock, Mail } from "lucide-react";
import toast from "react-hot-toast";

import { authApi } from "../../services/api";
import { useAuthStore } from "../../store/authStore";
import { extractError } from "../../services/apiClient";
import { usePageTitle } from "../../hooks";

const schema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [showPassword, setShowPassword] = useState(false);

  usePageTitle("Sign In");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    try {
      const res = await authApi.login(data.email, data.password);
      setAuth(res.user, res.tokens);
      toast.success(`Welcome back, ${res.user.name.split(" ")[0]}!`);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      toast.error(extractError(err));
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-950/30 via-slate-950 to-slate-950 pointer-events-none" />

      <div className="relative w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-2xl mb-5 shadow-2xl shadow-indigo-500/25">
            <FileCheck2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">
            IntelliInvoice AI
          </h1>
          <p className="text-slate-400 mt-2 text-sm">
            Sign in to your workspace
          </p>
        </div>

        {/* Card */}
        <div className="bg-slate-800/80 backdrop-blur border border-slate-700/60 rounded-2xl p-8 shadow-2xl">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="email"
                  autoComplete="email"
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
                  autoComplete="current-password"
                  placeholder="Your password"
                  className="w-full bg-slate-700/50 border border-slate-600 text-slate-100 rounded-lg pl-10 pr-10 py-2.5 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  {...register("password")}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1.5 text-xs text-red-400">
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-lg transition-colors duration-150 flex items-center justify-center gap-2 mt-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Signing in…
                </>
              ) : (
                "Sign In"
              )}
            </button>
          </form>

          <p className="text-center text-slate-400 text-sm mt-6">
            New to IntelliInvoice?{" "}
            <Link
              to="/register"
              className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
            >
              Create an account
            </Link>
          </p>
        </div>

        <p className="text-center text-slate-600 text-xs mt-6">
          Secured with JWT authentication and bcrypt encryption
        </p>
      </div>
    </div>
  );
}
