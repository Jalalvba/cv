"use client";

import { useEffect, useState } from "react";
import type { CvData } from "@/lib/cv-data";
import { CVPreview } from "@/components/CVPreview";
import { RoleLanguageSelector } from "@/components/RoleLanguageSelector";
import { slugify } from "@/lib/utils";

interface RoleSummary {
  roleGroup: string;
  label: string;
  variants: Partial<Record<"en" | "fr", string>>;
}

/**
 * Public, read-only Home page: pick a role/language, see the assembled CV,
 * export it as a PDF. No editing UI is ever rendered here, regardless of
 * login state — this page never even imports the auth context. All editing
 * lives behind /admin/edit/[positioningId].
 */
export default function Home() {
  const [positioningId, setPositioningId] = useState<string | undefined>(undefined);
  const [cvData, setCvData] = useState<CvData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // Pick a default role/language once the list of positionings is known.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/positionings")
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load positionings (${res.status})`);
        return res.json() as Promise<RoleSummary[]>;
      })
      .then((roles) => {
        if (cancelled) return;
        const first = roles[0];
        const defaultId = first?.variants.en ?? first?.variants.fr;
        if (defaultId) setPositioningId(defaultId);
        else setLoadError("No positionings available.");
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Failed to load positionings");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!positioningId) return;
    let cancelled = false;
    fetch(`/api/cv/${positioningId}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load CV (${res.status})`);
        return res.json() as Promise<CvData>;
      })
      .then((data) => {
        if (!cancelled) setCvData(data);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Failed to load CV");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [positioningId]);

  // Set loading/clear errors synchronously in the event handler (not in the
  // effect above) so "Loading…" shows immediately on role/language switch
  // instead of leaving the previous CV on screen while re-fetching.
  function handleSelectPositioning(nextPositioningId: string) {
    if (nextPositioningId === positioningId) return;
    setLoading(true);
    setLoadError(null);
    setPositioningId(nextPositioningId);
  }

  async function handleExport() {
    if (!positioningId) return;
    setExporting(true);
    setExportError(null);
    try {
      const cvRes = await fetch(`/api/cv/${positioningId}`);
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
    <div className="min-h-screen pb-24">
      <header className="sticky top-10 z-10 border-b border-neutral-200 bg-white/90 backdrop-blur">
        <div className="flex items-center justify-between px-6 py-3">
          <div>
            <h1 className="text-sm font-semibold text-neutral-800">Jalal Chafiq — CV</h1>
            <p className="text-xs text-neutral-500">Pick a role and language, then export the matching CV.</p>
          </div>
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting || !cvData}
            className="rounded bg-cv-navy px-4 py-2 text-xs font-semibold tracking-wide text-white hover:bg-cv-navy/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {exporting ? "Generating…" : "Export as PDF"}
          </button>
        </div>
        <div className="border-t border-neutral-100 px-6 py-2">
          <RoleLanguageSelector currentPositioningId={positioningId} onNavigate={handleSelectPositioning} />
        </div>
      </header>

      {loadError ? <p className="mx-6 mt-4 text-xs text-red-600">{loadError}</p> : null}
      {exportError ? <p className="mx-6 mt-4 text-xs text-red-600">Export failed: {exportError}</p> : null}

      <div className="mt-8 flex justify-center px-6">
        {loading || !cvData ? (
          <p className="mt-12 text-sm text-neutral-500">Loading…</p>
        ) : (
          <CVPreview data={cvData} />
        )}
      </div>
    </div>
  );
}
