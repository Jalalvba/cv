"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

/**
 * Client-side session state: AuthProvider (mounted once in app/layout.tsx)
 * checks GET /api/auth/status on load, and useAuth() exposes isLoggedIn +
 * login()/logout() to any component (TopNav, AdminLoginForm, admin pages).
 */

interface AuthContextValue {
  isLoggedIn: boolean;
  /** True once the initial GET /api/auth/status check has resolved. */
  statusLoaded: boolean;
  login: (password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [statusLoaded, setStatusLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/status")
      .then((res) => res.json())
      .then((data: { isLoggedIn: boolean }) => {
        if (!cancelled) setIsLoggedIn(data.isLoggedIn === true);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setStatusLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (password: string) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: (data as { error?: string }).error ?? `Login failed (${res.status})` };
    }
    setIsLoggedIn(true);
    return { ok: true };
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setIsLoggedIn(false);
  }, []);

  return <AuthContext.Provider value={{ isLoggedIn, statusLoaded, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
