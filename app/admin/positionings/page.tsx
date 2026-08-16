"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { CVPreview } from "@/components/CVPreview";
import { ZodIssuesList } from "@/components/ZodIssuesList";
import { CostBadge } from "@/components/CostBadge";
import type { CostInfo } from "@/lib/gemini-cost-tracker";
import type { ZodIssueLike } from "@/lib/zod-issues";
import type { CvData, PositioningDoc } from "@/lib/cv-data";
import { slugify } from "@/lib/utils";
import { MODEL_TIERS, DEFAULT_TIER, type ModelTier } from "@/lib/geminiModels";

type Language = "en" | "fr";

/**
 * Fully automatic job-offer → CV flow. Paste a job offer, Gemini drafts the
 * FR/EN positioning pair, both are seeded to MongoDB immediately, and the
 * resulting CV is fetched and shown right here for review/export. There is
 * no manual JSON review step and no bulk paste-and-seed tool — this replaced
 * that older two-step workflow (generate → hand-review JSON → seed).
 */
export default function AdminPositioningsPage() {
  const { isLoggedIn } = useAuth();

  const [jobOffer, setJobOffer] = useState("");
  const [modelTier, setModelTier] = useState<ModelTier>(DEFAULT_TIER);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<ZodIssueLike[]>([]);
  // Comes back inline with the generation result, so it renders in the same
  // round trip — no polling, no separate usage fetch.
  const [costInfo, setCostInfo] = useState<CostInfo | null>(null);

  const [positionings, setPositionings] = useState<PositioningDoc[] | null>(null);
  const [language, setLanguage] = useState<Language>("en");
  const [cvData, setCvData] = useState<CvData | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const currentDoc = positionings?.find((p) => p.language === language) ?? null;

  async function loadCv(positioningId: string) {
    const res = await fetch(`/api/cv/${positioningId}`);
    if (!res.ok) throw new Error(`Failed to load CV (${res.status})`);
    setCvData((await res.json()) as CvData);
  }

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    setIssues([]);
    setCostInfo(null);
    setPositionings(null);
    setCvData(null);
    try {
      const genRes = await fetch("/api/admin/generate-positioning", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobOffer, modelTier }),
      });
      const genData = await genRes.json();
      if (!genRes.ok) {
        setError(genData.error ?? `Generation failed (${genRes.status})`);
        if (Array.isArray(genData.issues)) setIssues(genData.issues);
        if (genData.costInfo) setCostInfo(genData.costInfo);
        return;
      }
      setCostInfo(genData.costInfo ?? null);
      const generated: PositioningDoc[] = genData.positionings;

      // Seeded immediately — no manual JSON review step.
      const seedRes = await fetch("/api/admin/seed-positioning", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(generated),
      });
      const seedData = await seedRes.json();
      if (!seedRes.ok) {
        setError(seedData.error ?? `Saving the generated CV failed (${seedRes.status})`);
        if (Array.isArray(seedData.issues)) setIssues(seedData.issues);
        return;
      }

      setPositionings(generated);
      const preferredLanguage: Language = generated.some((p) => p.language === "en") ? "en" : "fr";
      setLanguage(preferredLanguage);
      const preferredDoc = generated.find((p) => p.language === preferredLanguage) ?? generated[0];
      await loadCv(preferredDoc._id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setGenerating(false);
    }
  }

  async function handleSelectLanguage(lang: Language) {
    if (lang === language) return;
    const doc = positionings?.find((p) => p.language === lang);
    if (!doc) return;
    setLanguage(lang);
    try {
      await loadCv(doc._id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load CV");
    }
  }

  async function handleExport() {
    if (!currentDoc) return;
    setExporting(true);
    setExportError(null);
    try {
      const cvRes = await fetch(`/api/cv/${currentDoc._id}`);
      if (!cvRes.ok) throw new Error(`Failed to load CV (${cvRes.status})`);
      const freshData: CvData = await cvRes.json();

      const exportRes = await fetch("/api/export-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(freshData),
      });
      if (!exportRes.ok) throw new Error(`PDF generation failed (${exportRes.status})`);
      const blob = await exportRes.blob();

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${slugify(freshData.name)}-cv.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-lg font-semibold text-neutral-800">Generate a CV from a job offer</h1>
      <p className="mt-1 text-xs text-neutral-500">
        Paste a job offer below. Gemini drafts a matching FR/EN positioning pair, it&apos;s saved automatically, and
        the resulting CV is shown here for you to review and export.
      </p>

      {!isLoggedIn ? (
        <p className="mt-4 text-xs text-neutral-500">Read-only — log in as Admin (top nav) to generate a CV.</p>
      ) : null}

      <label className="mt-6 flex flex-col gap-1">
        <span className="text-xs font-medium text-neutral-700">Job offer text</span>
        <textarea
          value={jobOffer}
          onChange={(e) => setJobOffer(e.target.value)}
          rows={8}
          spellCheck={false}
          disabled={!isLoggedIn}
          className="rounded border border-neutral-300 px-3 py-2 text-xs disabled:bg-neutral-100 disabled:text-neutral-500"
          placeholder="Paste the full job offer here…"
        />
      </label>

      <label className="mt-3 flex flex-col gap-1">
        <span className="text-xs font-medium text-neutral-700">Model</span>
        <select
          value={modelTier}
          onChange={(e) => setModelTier(e.target.value as ModelTier)}
          disabled={!isLoggedIn}
          aria-label="Gemini model tier"
          className="w-fit rounded border border-neutral-300 bg-white px-3 py-2 text-xs font-medium text-neutral-800 disabled:bg-neutral-100 disabled:text-neutral-500"
        >
          {MODEL_TIERS.map((t) => (
            <option key={t.tier} value={t.tier}>
              {t.label} — {t.description}
            </option>
          ))}
        </select>
        <span className="text-[11px] text-neutral-500">
          The concrete model is resolved live per tier; on a rate limit or outage it automatically steps up to the
          next tier.
        </span>
      </label>

      <button
        type="button"
        onClick={handleGenerate}
        disabled={generating || !isLoggedIn || jobOffer.trim().length < 40}
        className="mt-3 rounded bg-cv-navy px-4 py-2 text-xs font-semibold tracking-wide text-white hover:bg-cv-navy/90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {generating ? "Generating…" : "Generate CV"}
      </button>
      {costInfo ? (
        <p className="mt-2">
          <CostBadge costInfo={costInfo} />
        </p>
      ) : null}

      {error ? (
        <div className="mt-6 rounded border border-red-300 bg-red-50 px-4 py-3 text-xs text-red-800">
          <p>{error}</p>
          <ZodIssuesList issues={issues} />
        </div>
      ) : null}

      {positionings && cvData ? (
        <section className="mt-8 border-t border-neutral-200 pt-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-neutral-800">Proposed CV — {currentDoc?._id}</h2>
              <p className="mt-1 text-xs text-neutral-500">
                Saved to MongoDB.{" "}
                <Link href={`/admin/edit/${currentDoc?._id}`} className="underline hover:no-underline">
                  Edit this positioning
                </Link>
                .
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex overflow-hidden rounded border border-neutral-300">
                {(["fr", "en"] as const).map((lang) => {
                  const disabled = !positionings.some((p) => p.language === lang);
                  const active = language === lang;
                  return (
                    <button
                      key={lang}
                      type="button"
                      disabled={disabled}
                      onClick={() => handleSelectLanguage(lang)}
                      aria-pressed={active}
                      className={
                        "px-3 py-2 text-xs font-semibold uppercase " +
                        (active
                          ? "bg-cv-navy text-white"
                          : disabled
                            ? "cursor-not-allowed bg-neutral-100 text-neutral-300"
                            : "bg-white text-neutral-800 hover:bg-neutral-50")
                      }
                    >
                      {lang}
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={handleExport}
                disabled={exporting}
                className="rounded bg-cv-navy px-4 py-2 text-xs font-semibold tracking-wide text-white hover:bg-cv-navy/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {exporting ? "Generating…" : "Export as PDF"}
              </button>
            </div>
          </div>
          {exportError ? <p className="mt-2 text-xs text-red-600">Export failed: {exportError}</p> : null}

          <div className="mt-6 overflow-x-auto">
            <CVPreview data={cvData} />
          </div>
        </section>
      ) : null}
    </div>
  );
}
