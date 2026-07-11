"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import {
  EXAMPLE_POSITIONING_ID,
  EXAMPLE_POSITIONING_ID_EN,
  buildContextPromptMarkdown,
  contextPromptFilename,
} from "@/lib/context-prompt";
import { ZodIssuesList } from "@/components/ZodIssuesList";
import type { ZodIssueLike } from "@/lib/zod-issues";
import type { ProfileDoc, PositioningDoc } from "@/lib/cv-data";

interface SeedResult {
  created: string[];
  updated: string[];
}

export default function AdminPositioningsPage() {
  const { isLoggedIn } = useAuth();

  const [jsonText, setJsonText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SeedResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<ZodIssueLike[]>([]);

  const [downloadingPrompt, setDownloadingPrompt] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // Fetches everything fresh at click time so the downloaded file reflects
  // the current profile even if it changed since this page loaded.
  async function handleDownloadContextPrompt() {
    setDownloadingPrompt(true);
    setDownloadError(null);
    try {
      const [profile, positioningFr, positioningEn] = await Promise.all([
        fetch("/api/profile").then((res) => {
          if (!res.ok) throw new Error(`Failed to fetch profile (${res.status})`);
          return res.json() as Promise<ProfileDoc>;
        }),
        fetch(`/api/admin/positioning/${EXAMPLE_POSITIONING_ID}`).then((res) => {
          if (!res.ok) throw new Error(`Failed to fetch example positioning (${res.status})`);
          return res.json() as Promise<PositioningDoc>;
        }),
        fetch(`/api/admin/positioning/${EXAMPLE_POSITIONING_ID_EN}`).then((res) => {
          if (!res.ok) throw new Error(`Failed to fetch example positioning (${res.status})`);
          return res.json() as Promise<PositioningDoc>;
        }),
      ]);

      const markdown = buildContextPromptMarkdown(profile, [positioningFr, positioningEn]);
      const blob = new Blob([markdown], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = contextPromptFilename();
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : "Download failed");
    } finally {
      setDownloadingPrompt(false);
    }
  }

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

      <section className="mt-6 rounded border border-neutral-200 bg-neutral-50 px-4 py-3">
        <h2 className="text-sm font-semibold text-neutral-800">Draft a new positioning externally</h2>
        <p className="mt-1 text-xs text-neutral-500">
          Download a single, self-contained prompt file — PositioningDoc/ProfileDoc schema, live examples fetched
          fresh at download time, and the generation rules — to paste into Claude, Gemini, or another AI alongside a
          job offer. Paste the AI&apos;s JSON response into the form below.
        </p>
        <button
          type="button"
          onClick={handleDownloadContextPrompt}
          disabled={downloadingPrompt}
          className="mt-3 rounded bg-cv-navy px-4 py-2 text-xs font-semibold tracking-wide text-white hover:bg-cv-navy/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {downloadingPrompt ? "Preparing…" : "Download context prompt for external AI"}
        </button>
        {downloadError ? <p className="mt-2 text-xs text-red-600">{downloadError}</p> : null}
      </section>

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
            <ZodIssuesList issues={issues} />
          </div>
        ) : null}
      </section>
    </div>
  );
}
