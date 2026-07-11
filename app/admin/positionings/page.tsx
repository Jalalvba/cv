"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { POSITIONING_DOC_SHAPE, PROFILE_DOC_SHAPE, EXAMPLE_POSITIONING_ID } from "@/lib/schema-templates";
import { ZodIssuesList } from "@/components/ZodIssuesList";
import type { ZodIssueLike } from "@/lib/zod-issues";

interface SeedResult {
  created: string[];
  updated: string[];
}

/**
 * Fetches a real document from a public GET endpoint and renders it as
 * pretty-printed JSON text, so the "example" half of the schema template
 * below is always the actual current data — never a hand-copied snapshot
 * that can drift out of sync with what's really in MongoDB.
 */
function useLiveJsonExample(url: string): string {
  const [text, setText] = useState("Loading example…");

  useEffect(() => {
    let cancelled = false;
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`(${res.status})`);
        return res.json();
      })
      .then((data) => {
        if (!cancelled) setText(JSON.stringify(data, null, 2));
      })
      .catch((err) => {
        if (!cancelled) {
          setText(`// Could not load a live example from ${url}: ${err instanceof Error ? err.message : String(err)}`);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  return text;
}

export default function AdminPositioningsPage() {
  const { isLoggedIn } = useAuth();

  const [jsonText, setJsonText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SeedResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<ZodIssueLike[]>([]);

  const profileExample = useLiveJsonExample("/api/profile");
  const positioningExample = useLiveJsonExample(`/api/admin/positioning/${EXAMPLE_POSITIONING_ID}`);

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

      <details className="mt-8 rounded border border-neutral-200 bg-neutral-50 open:pb-4">
        <summary className="cursor-pointer select-none px-4 py-3 text-sm font-semibold text-neutral-800">
          Show target JSON schema
        </summary>
        <div className="flex flex-col gap-6 border-t border-neutral-200 px-4 pt-4">
          <p className="text-xs text-neutral-500">
            Hand one of these blocks (shape + a real, current example) to an external AI assistant — e.g. &quot;generate a
            PositioningDoc for a Fleet Operations Coordinator role, in English, matching this shape and example&quot; —
            then paste the result into the textarea below. Each block is a single <code>&lt;pre&gt;</code>: click inside
            and Ctrl/Cmd+A to select the whole thing.
          </p>

          <div>
            <h3 className="text-xs font-semibold text-neutral-700">PositioningDoc — shape</h3>
            <pre className="mt-1 max-h-80 overflow-auto rounded border border-neutral-300 bg-white p-3 text-[11px] leading-snug text-neutral-800">
              {POSITIONING_DOC_SHAPE}
            </pre>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-neutral-700">
              PositioningDoc — example (live: {EXAMPLE_POSITIONING_ID})
            </h3>
            <pre className="mt-1 max-h-80 overflow-auto rounded border border-neutral-300 bg-white p-3 text-[11px] leading-snug text-neutral-800">
              {positioningExample}
            </pre>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-neutral-700">ProfileDoc — shape</h3>
            <pre className="mt-1 max-h-80 overflow-auto rounded border border-neutral-300 bg-white p-3 text-[11px] leading-snug text-neutral-800">
              {PROFILE_DOC_SHAPE}
            </pre>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-neutral-700">ProfileDoc — example (live: jalal_chafiq)</h3>
            <pre className="mt-1 max-h-80 overflow-auto rounded border border-neutral-300 bg-white p-3 text-[11px] leading-snug text-neutral-800">
              {profileExample}
            </pre>
          </div>
        </div>
      </details>

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
