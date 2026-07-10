"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";

/**
 * Full-page login gate for the admin area (app/admin/edit/[positioningId]).
 * Rendered instead of any admin content when logged out — the admin area
 * shows only this form, nothing else, until a valid session exists.
 */
export function AdminLoginForm() {
  const { login } = useAuth();
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const result = await login(password);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error ?? "Login failed");
      return;
    }
    setPassword("");
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-64 flex-col gap-3 rounded border border-neutral-200 bg-white p-6 shadow-sm">
      <div>
        <h1 className="text-sm font-semibold text-neutral-800">Admin login</h1>
        <p className="mt-1 text-xs text-neutral-500">Log in to edit CV content.</p>
      </div>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-neutral-700">Password</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          autoComplete="off"
          autoFocus
          className="rounded border border-neutral-300 px-3 py-2 text-xs"
        />
      </label>
      <button
        type="submit"
        disabled={submitting || password.length === 0}
        className="rounded bg-cv-navy px-4 py-2 text-xs font-semibold tracking-wide text-white hover:bg-cv-navy/90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? "Logging in…" : "Log in"}
      </button>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </form>
  );
}
