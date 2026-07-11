"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

interface SeedResult {
  created: string[];
  updated: string[];
}

interface Issue {
  path: string;
  message: string;
}

export default function AdminPositioningsPage() {
  const { isLoggedIn } = useAuth();

  const [jsonText, setJsonText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SeedResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<Issue[]>([]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setResult(null);
    setError(null);
    setIssues([]);
    try {
      const res = await fetch("/api/admin/seed-positioning", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: jsonText,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? `Request failed (${res.status})`);
        if (Array.isArray(data.issues)) setIssues(data.issues);
        return;
      }
      setResult({ created: data.created ?? [], updated: data.updated ?? [] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-lg font-semibold text-neutral-800">Seed positioning JSON</h1>

      {!isLoggedIn ? (
        <p className="mt-4 text-xs text-neutral-500">Read-only — log in as Admin (top nav) to seed positionings.</p>
      ) : null}

      <section className="mt-8 border-t border-neutral-200 pt-6">
        <h2 className="text-sm font-semibold text-neutral-800">Review &amp; seed to MongoDB</h2>
        <p className="mt-1 text-xs text-neutral-500">
          Paste one PositioningDoc object, or an array of them (e.g. an FR + EN pair), and submit directly to
          MongoDB. No preview step — submitting writes immediately.
        </p>

        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-neutral-700">Positioning JSON</span>
            <textarea
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              rows={22}
              spellCheck={false}
              disabled={!isLoggedIn}
              className="rounded border border-neutral-300 px-3 py-2 font-mono text-xs disabled:bg-neutral-100 disabled:text-neutral-500"
              placeholder='{ "_id": "...", "roleGroup": "...", ... }  or  [{ ... }, { ... }]'
              required
            />
          </label>

          <button
            type="submit"
            disabled={submitting || !isLoggedIn}
            className="self-start rounded bg-cv-navy px-4 py-2 text-xs font-semibold tracking-wide text-white hover:bg-cv-navy/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Seeding…" : "Seed to MongoDB"}
          </button>
        </form>

        {result ? (
          <div className="mt-6 rounded border border-green-300 bg-green-50 px-4 py-3 text-xs text-green-800">
            {result.created.length > 0 ? <p>Created: {result.created.join(", ")}</p> : null}
            {result.updated.length > 0 ? <p>Updated: {result.updated.join(", ")}</p> : null}
            {result.created.length === 0 && result.updated.length === 0 ? <p>No documents written.</p> : null}
            {[...result.created, ...result.updated].length > 0 ? (
              <ul className="mt-2 flex flex-col gap-1">
                {[...result.created, ...result.updated].map((id) => (
                  <li key={id}>
                    <Link href={`/admin/edit/${id}`} className="font-semibold underline hover:no-underline">
                      Edit &amp; export this positioning ({id})
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        {error ? (
          <div className="mt-6 rounded border border-red-300 bg-red-50 px-4 py-3 text-xs text-red-800">
            <p>{error}</p>
            {issues.length > 0 ? (
              <ul className="mt-2 list-disc pl-4">
                {issues.map((issue, i) => (
                  <li key={i}>
                    <code>{issue.path || "(root)"}</code>: {issue.message}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}
