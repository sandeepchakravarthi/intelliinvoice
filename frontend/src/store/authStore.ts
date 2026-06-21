import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { TokenResponse, User } from "../types";

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  setAuth: (user: User, tokens: TokenResponse) => void;
  clearAuth: () => void;
  updateUser: (partial: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,

      setAuth: (user, tokens) => {
        localStorage.setItem("access_token", tokens.access_token);
        localStorage.setItem("refresh_token", tokens.refresh_token);
        set({ user, accessToken: tokens.access_token, isAuthenticated: true });
      },

      clearAuth: () => {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        set({ user: null, accessToken: null, isAuthenticated: false });
      },

      updateUser: (partial) => {
        const current = get().user;
        if (current) set({ user: { ...current, ...partial } });
      },
    }),
    {
      name: "intelliinvoice-auth",
      partialize: (s) => ({
        user: s.user,
        accessToken: s.accessToken,
        isAuthenticated: s.isAuthenticated,
      }),
    }
  )
);
