"use client";

/**
 * Gated admin editor for one positioning: a raw JSON editor for the profile
 * + positioning documents, Preview PDF, Export & Download, Save changes.
 * Logged out renders only <AdminLoginForm /> — no data fetch, no CV content
 * — see the isLoggedIn checks below. Logged-in data flow: GET /api/profile +
 * /api/admin/positioning/[id] + /api/cv/[id] on load (combined into one
 * { profile, positioning } JSON blob pre-filling the textarea), PATCH
 * /api/admin/update-profile and/or /api/admin/update-positioning on save
 * (existing targeted-edit routes, reused as-is — see the diff* helpers
 * below for exactly which edited fields those routes can actually persist).
 *
 * Replaces the previous field-by-field editor (deleted, not archived — see
 * git history if that per-field UI is ever needed for reference) to match
 * how this tool is actually used: generating JSON externally via an AI
 * assistant using the schema template on /admin/positionings, then pasting
 * the result back in here.
 */

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { ProfileDoc, PositioningDoc, CvData } from "@/lib/cv-data";
import { profileDocSchema, positioningDocSchema } from "@/lib/validation";
import { zodIssues, type ZodIssueLike } from "@/lib/zod-issues";
import { slugify } from "@/lib/utils";
import { RoleLanguageSelector } from "@/components/RoleLanguageSelector";
import { useAuth } from "@/lib/auth-context";
import { AdminLoginForm } from "@/components/AdminLoginForm";
import { ZodIssuesList } from "@/components/ZodIssuesList";
import { diffProfile, diffPositioning } from "./diff";

interface SaveOutcome {
  ok: boolean;
  detail: string;
}

interface SaveResult {
  profile?: SaveOutcome;
  positioning?: SaveOutcome;
  unsupported: string[];
}

export default function EditPositioningPage() {
  const params = useParams<{ positioningId: string }>();
  const router = useRouter();
  const positioningId = params.positioningId;
  const { isLoggedIn, statusLoaded, logout } = useAuth();

  const [originalProfile, setOriginalProfile] = useState<ProfileDoc | null>(null);
  const [originalPositioning, setOriginalPositioning] = useState<PositioningDoc | null>(null);
  const [cvData, setCvData] = useState<CvData | null>(null);
  const [jsonText, setJsonText] = useState("");

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [validationIssues, setValidationIssues] = useState<ZodIssueLike[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveResult, setSaveResult] = useState<SaveResult | null>(null);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // Only fetch admin data once a session is confirmed — logged-out visitors
  // never see this page's data, only the AdminLoginForm below.
  useEffect(() => {
    if (!isLoggedIn || !positioningId) return;
    let cancelled = false;
    Promise.all([
      fetch("/api/profile").then((res) => {
        if (!res.ok) throw new Error(`Failed to load profile (${res.status})`);
        return res.json() as Promise<ProfileDoc>;
      }),
      fetch(`/api/admin/positioning/${positioningId}`).then((res) => {
        if (!res.ok) throw new Error(`Failed to load positioning (${res.status})`);
        return res.json() as Promise<PositioningDoc>;
      }),
      fetch(`/api/cv/${positioningId}`).then((res) => {
        if (!res.ok) throw new Error(`Failed to load assembled CV (${res.status})`);
        return res.json() as Promise<CvData>;
      }),
    ])
      .then(([profileData, positioningData, cvDataResult]) => {
        if (cancelled) return;
        setOriginalProfile(profileData);
        setOriginalPositioning(positioningData);
        setJsonText(JSON.stringify({ profile: profileData, positioning: positioningData }, null, 2));
        setCvData(cvDataResult);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Failed to load");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isLoggedIn, positioningId]);

  // Revoke the previous preview object URL whenever it's replaced or the page unmounts.
  useEffect(() => {
    if (!previewUrl) return;
    return () => {
      URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // Reset page state for a role/language switch in the event handler (not in an
  // effect), so the "Loading…" state shows immediately during client-side navigation
  // instead of leaving the previous positioning's data on screen while re-fetching.
  function handleNavigate(nextPositioningId: string) {
    if (nextPositioningId === positioningId) return;
    setLoading(true);
    setLoadError(null);
    setParseError(null);
    setValidationIssues([]);
    setSaveResult(null);
    setSaveError(null);
    setPreviewUrl(null);
    setPreviewError(null);
    router.push(`/admin/edit/${nextPositioningId}`);
  }

  async function handleSave() {
    if (!originalProfile || !originalPositioning) return;

    setSaving(true);
    setParseError(null);
    setValidationIssues([]);
    setSaveError(null);
    setSaveResult(null);

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText);
    } catch (err) {
      setSaving(false);
      setParseError(err instanceof Error ? err.message : "Invalid JSON");
      return;
    }

    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      setSaving(false);
      setParseError('Expected a JSON object shaped { "profile": {...}, "positioning": {...} }, not an array or primitive.');
      return;
    }
    const obj = parsed as Record<string, unknown>;
    if (!("profile" in obj) || !("positioning" in obj)) {
      setSaving(false);
      setParseError('Expected a JSON object with both "profile" and "positioning" keys.');
      return;
    }

    const profileResult = profileDocSchema.safeParse(obj.profile);
    const positioningResult = positioningDocSchema.safeParse(obj.positioning);

    const issues: ZodIssueLike[] = [
      ...(profileResult.success ? [] : zodIssues(profileResult.error).map((i) => ({ ...i, path: `profile.${i.path}` }))),
      ...(positioningResult.success
        ? []
        : zodIssues(positioningResult.error).map((i) => ({ ...i, path: `positioning.${i.path}` }))),
    ];
    if (issues.length > 0 || !profileResult.success || !positioningResult.success) {
      setSaving(false);
      setValidationIssues(issues);
      setSaveError(`Validation failed: ${issues.length} issue(s) below.`);
      return;
    }

    const editedProfile = profileResult.data;
    const editedPositioning = positioningResult.data;

    if (editedPositioning._id !== positioningId) {
      setSaving(false);
      setSaveError(
        `positioning._id must stay "${positioningId}" — renaming a positioning isn't supported here; use the Seed Positioning JSON tool instead.`,
      );
      return;
    }

    const { patch: profilePatch, unsupported: profileUnsupported } = diffProfile(originalProfile, editedProfile);
    const { patch: positioningPatch, unsupported: positioningUnsupported } = diffPositioning(
      originalPositioning,
      editedPositioning,
    );
    const unsupported = [...profileUnsupported, ...positioningUnsupported];

    const hasProfileChanges = Object.keys(profilePatch).length > 0;
    const hasPositioningChanges = Object.keys(positioningPatch).length > 0;

    if (!hasProfileChanges && !hasPositioningChanges) {
      setSaving(false);
      setSaveResult({ unsupported });
      return;
    }

    const results: SaveResult = { unsupported };
    const requests: Promise<void>[] = [];

    if (hasProfileChanges) {
      requests.push(
        fetch("/api/admin/update-profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(profilePatch),
        })
          .then(async (res) => {
            const data = await res.json();
            if (!res.ok) {
              results.profile = { ok: false, detail: data.error ?? `Failed (${res.status})` };
              return;
            }
            results.profile = { ok: true, detail: `Saved: ${(data.saved ?? []).join(", ")}` };
            setOriginalProfile(editedProfile);
          })
          .catch((err) => {
            results.profile = { ok: false, detail: err instanceof Error ? err.message : "Request failed" };
          }),
      );
    }

    if (hasPositioningChanges) {
      requests.push(
        fetch("/api/admin/update-positioning", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ positioningId, ...positioningPatch }),
        })
          .then(async (res) => {
            const data = await res.json();
            if (!res.ok) {
              results.positioning = { ok: false, detail: data.error ?? `Failed (${res.status})` };
              return;
            }
            results.positioning = { ok: true, detail: `Saved: ${(data.saved ?? []).join(", ")}` };
            setOriginalPositioning(editedPositioning);
          })
          .catch((err) => {
            results.positioning = { ok: false, detail: err instanceof Error ? err.message : "Request failed" };
          }),
      );
    }

    await Promise.all(requests);
    setSaving(false);
    setSaveResult(results);

    const anyFailed = (results.profile && !results.profile.ok) || (results.positioning && !results.positioning.ok);
    setSaveError(anyFailed ? "One or more saves failed — see details below." : null);
  }

  async function fetchRenderedPdf(): Promise<{ blob: Blob; data: CvData }> {
    if (!positioningId) throw new Error("No positioning selected");
    const cvRes = await fetch(`/api/cv/${positioningId}`);
    if (!cvRes.ok) throw new Error(`Failed to load CV (${cvRes.status})`);
    const freshData: CvData = await cvRes.json();
    setCvData(freshData);

    const exportRes = await fetch("/api/export-pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(freshData),
    });
    if (!exportRes.ok) throw new Error(`PDF generation failed (${exportRes.status})`);
    const blob = await exportRes.blob();
    return { blob, data: freshData };
  }

  async function handlePreview() {
    setPreviewing(true);
    setPreviewError(null);
    try {
      const { blob } = await fetchRenderedPdf();
      setPreviewUrl(URL.createObjectURL(blob));
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : "Preview failed");
    } finally {
      setPreviewing(false);
    }
  }

  async function handleExport() {
    setExporting(true);
    setExportError(null);
    try {
      const { blob, data } = await fetchRenderedPdf();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${slugify(data.name)}-cv.pdf`;
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

  if (!statusLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-neutral-500">Loading…</p>
      </div>
    );
  }

  // Logged out: show ONLY the login form. No CV preview, no editing UI, no
  // data fetch — that read-only experience lives on the public Home page.
  if (!isLoggedIn) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <AdminLoginForm />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24">
      <header className="sticky top-10 z-10 border-b border-neutral-200 bg-white/90 backdrop-blur">
        <div className="flex items-center justify-between px-6 py-3">
          <div>
            <h1 className="text-sm font-semibold text-neutral-800">Edit positioning: {positioningId}</h1>
            <p className="text-xs text-neutral-500">
              Edit the JSON below, then Save changes.{" "}
              <Link href="/admin/positionings" className="underline hover:no-underline">
                See target JSON schema &amp; example
              </Link>
              .
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/admin/positionings"
              className="rounded border border-neutral-300 px-4 py-2 text-xs font-semibold tracking-wide text-neutral-700 hover:bg-neutral-50"
            >
              Seed Positionings
            </Link>
            <button
              type="button"
              onClick={handlePreview}
              disabled={previewing || loading}
              className="rounded border border-neutral-300 px-4 py-2 text-xs font-semibold tracking-wide text-neutral-700 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {previewing ? "Rendering…" : "Preview PDF"}
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={exporting || loading}
              className="rounded border border-cv-navy px-4 py-2 text-xs font-semibold tracking-wide text-cv-navy hover:bg-cv-navy/5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {exporting ? "Generating…" : "Export & Download"}
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || loading || !originalProfile || !originalPositioning}
              className="rounded bg-cv-navy px-4 py-2 text-xs font-semibold tracking-wide text-white hover:bg-cv-navy/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
            <button
              type="button"
              onClick={() => logout()}
              className="rounded px-3 py-2 text-xs font-semibold tracking-wide text-neutral-500 hover:text-neutral-800"
            >
              Logout
            </button>
          </div>
        </div>
        <div className="border-t border-neutral-100 px-6 py-2">
          <RoleLanguageSelector currentPositioningId={positioningId} onNavigate={handleNavigate} />
        </div>
      </header>

      {loadError ? <p className="mx-6 mt-4 text-xs text-red-600">{loadError}</p> : null}
      {exportError ? <p className="mx-6 mt-4 text-xs text-red-600">Export failed: {exportError}</p> : null}
      {previewError ? <p className="mx-6 mt-4 text-xs text-red-600">Preview failed: {previewError}</p> : null}

      {parseError ? (
        <div className="mx-6 mt-4 rounded border border-red-300 bg-red-50 px-4 py-3 text-xs text-red-800">
          <p className="font-semibold">Couldn&apos;t parse JSON:</p>
          <p className="mt-1">{parseError}</p>
        </div>
      ) : null}

      {saveError ? (
        <div className="mx-6 mt-4 rounded border border-red-300 bg-red-50 px-4 py-3 text-xs text-red-800">
          <p>{saveError}</p>
          <ZodIssuesList issues={validationIssues} />
        </div>
      ) : null}

      {saveResult ? (
        <div className="mx-6 mt-4 flex flex-col gap-1 text-xs">
          {saveResult.profile ? (
            <p className={saveResult.profile.ok ? "text-green-700" : "text-red-600"}>
              Profile (bullets/personal/education): {saveResult.profile.ok ? "✓" : "✗"} {saveResult.profile.detail}
            </p>
          ) : null}
          {saveResult.positioning ? (
            <p className={saveResult.positioning.ok ? "text-green-700" : "text-red-600"}>
              Positioning (skills/title/summary): {saveResult.positioning.ok ? "✓" : "✗"} {saveResult.positioning.detail}
            </p>
          ) : null}
          {!saveResult.profile && !saveResult.positioning ? <p className="text-neutral-500">No changes to save.</p> : null}
          {saveResult.unsupported.length > 0 ? (
            <div className="mt-1 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-amber-800">
              <p className="font-semibold">Not saved — not supported by Save yet (edit these via the Seed Positioning JSON tool, or the change was a structural add/remove):</p>
              <ul className="mt-1 list-disc pl-4">
                {saveResult.unsupported.map((u, i) => (
                  <li key={i}>{u}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {previewUrl ? (
        <section className="mx-6 mt-4">
          <h2 className="text-sm font-semibold text-cv-navy">PDF Preview</h2>
          <iframe title="CV PDF preview" src={previewUrl} className="mt-2 h-[85vh] w-full rounded border border-neutral-300" />
        </section>
      ) : null}

      {loading ? (
        <p className="mt-12 text-center text-sm text-neutral-500">Loading…</p>
      ) : (
        <div className="mx-auto my-8 max-w-4xl px-6">
          {cvData ? (
            <section className="rounded border border-neutral-200 bg-neutral-50 p-4">
              <h2 className="text-sm font-semibold text-cv-navy">Assembled title &amp; summary (text preview)</h2>
              <p className="mt-1 text-xs text-neutral-600">{cvData.title}</p>
              <p className="mt-1 text-xs text-neutral-500">{cvData.summary}</p>
            </section>
          ) : null}

          <section className="mt-8">
            <h2 className="text-sm font-semibold text-cv-navy">Profile &amp; positioning JSON</h2>
            <p className="mt-1 text-xs text-neutral-500">
              This is the full profile document plus this positioning&apos;s document, pre-filled with the current data.
              Edit and click Save changes above. Only a subset of fields can actually be persisted by Save — see the
              amber warning after saving if you changed something outside that subset (e.g. tags, bulletSelection,
              adding/removing bullets or roles); those still go through the Seed Positioning JSON tool.
            </p>
            <textarea
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              rows={36}
              spellCheck={false}
              className="mt-3 w-full rounded border border-neutral-300 px-3 py-2 font-mono text-xs"
            />
          </section>
        </div>
      )}
    </div>
  );
}
