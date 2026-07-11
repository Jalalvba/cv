"use client";

/**
 * Gated admin editor for one positioning: a structured field-by-field form
 * for the profile + positioning documents, Preview PDF, Export & Download,
 * Save changes. Logged out renders only <AdminLoginForm /> — no data fetch,
 * no CV content — see the isLoggedIn checks below. Logged-in data flow:
 * GET /api/profile + /api/admin/positioning/[id] + /api/cv/[id] on load,
 * PATCH /api/admin/update-profile and/or /api/admin/update-positioning on
 * save (see ./diff.ts for exactly which edited fields those routes persist
 * — as of this rebuild, that's the full field set the form exposes: tags,
 * personal.languages, bulletSelection add/remove, and adding/removing whole
 * education entries all now round-trip; see lib/validation.ts).
 *
 * This replaces the raw-JSON-textarea editor from the prior session — a
 * deliberate reversal, not an addition alongside it — because a structured
 * form is the more intuitive day-to-day editing surface; generating
 * positioning JSON externally via an AI is still supported, just via the
 * "Download context prompt" feature on /admin/positionings instead of a
 * paste-into-this-page workflow.
 */

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { ProfileDoc, PositioningDoc, CvData } from "@/lib/cv-data";
import type { ZodIssueLike } from "@/lib/zod-issues";
import { slugify } from "@/lib/utils";
import { RoleLanguageSelector } from "@/components/RoleLanguageSelector";
import { useAuth } from "@/lib/auth-context";
import { AdminLoginForm } from "@/components/AdminLoginForm";
import { ZodIssuesList } from "@/components/ZodIssuesList";
import { diffProfile, diffPositioning } from "./diff";

type PersonalField = "name" | "email" | "phone" | "location" | "website";
type EducationField = "degree" | "school" | "endDate" | "honors";
type AddressField = "street" | "postalCode" | "city" | "country";

const PERSONAL_FIELDS: PersonalField[] = ["name", "email", "phone", "location", "website"];
const EDUCATION_FIELDS: EducationField[] = ["degree", "school", "endDate", "honors"];
const ADDRESS_FIELDS: { field: AddressField; label: string }[] = [
  { field: "street", label: "Street Address" },
  { field: "postalCode", label: "Postal Code" },
  { field: "city", label: "City" },
  { field: "country", label: "Country" },
];

function newId(prefix: string): string {
  const random = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Date.now().toString(36);
  return `${prefix}_${random}`;
}

function tagsToText(tags: string[]): string {
  return tags.join(", ");
}
function textToTags(text: string): string[] {
  return text
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

interface SaveOutcome {
  ok: boolean;
  detail: string;
  issues?: ZodIssueLike[];
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
  const [profile, setProfile] = useState<ProfileDoc | null>(null);
  const [originalPositioning, setOriginalPositioning] = useState<PositioningDoc | null>(null);
  const [positioning, setPositioning] = useState<PositioningDoc | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveResult, setSaveResult] = useState<SaveResult | null>(null);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const bulletField: "text" | "textFr" = positioning?.language === "fr" ? "textFr" : "text";
  const educationDescField: "description" | "descriptionFr" = positioning?.language === "fr" ? "descriptionFr" : "description";

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
    ])
      .then(([profileData, positioningData]) => {
        if (cancelled) return;
        setOriginalProfile(profileData);
        setProfile(profileData);
        setOriginalPositioning(positioningData);
        setPositioning(positioningData);
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
    setSaveResult(null);
    setSaveError(null);
    setPreviewUrl(null);
    setPreviewError(null);
    router.push(`/admin/edit/${nextPositioningId}`);
  }

  // ---- Personal ----
  function updatePersonal(field: PersonalField, value: string) {
    setProfile((prev) => (prev ? { ...prev, personal: { ...prev.personal, [field]: value } } : prev));
  }
  function addLanguage() {
    setProfile((prev) => (prev ? { ...prev, personal: { ...prev.personal, languages: [...prev.personal.languages, { lang: "", level: "" }] } } : prev));
  }
  function updateLanguage(index: number, field: "lang" | "level", value: string) {
    setProfile((prev) =>
      prev
        ? { ...prev, personal: { ...prev.personal, languages: prev.personal.languages.map((l, i) => (i === index ? { ...l, [field]: value } : l)) } }
        : prev,
    );
  }
  function removeLanguage(index: number) {
    setProfile((prev) =>
      prev ? { ...prev, personal: { ...prev.personal, languages: prev.personal.languages.filter((_, i) => i !== index) } } : prev,
    );
  }
  function updateAddress(field: AddressField, value: string) {
    setProfile((prev) =>
      prev ? { ...prev, personal: { ...prev.personal, address: { ...prev.personal.address, [field]: value } } } : prev,
    );
  }

  // ---- Education ----
  function updateEducation(id: string, field: EducationField, value: string) {
    setProfile((prev) => (prev ? { ...prev, education: prev.education.map((e) => (e.id === id ? { ...e, [field]: value } : e)) } : prev));
  }
  function updateEducationDescription(id: string, value: string) {
    setProfile((prev) =>
      prev ? { ...prev, education: prev.education.map((e) => (e.id === id ? { ...e, [educationDescField]: value } : e)) } : prev,
    );
  }
  function updateEducationTags(id: string, text: string) {
    const tags = textToTags(text);
    setProfile((prev) => (prev ? { ...prev, education: prev.education.map((e) => (e.id === id ? { ...e, tags } : e)) } : prev));
  }
  function addEducation() {
    setProfile((prev) =>
      prev
        ? { ...prev, education: [...prev.education, { id: newId("edu"), degree: "", school: "", endDate: "", tags: [] }] }
        : prev,
    );
  }
  function removeEducation(id: string) {
    setProfile((prev) => (prev ? { ...prev, education: prev.education.filter((e) => e.id !== id) } : prev));
  }

  // ---- Experience bullets ----
  function updateBullet(experienceId: string, bulletId: string, value: string) {
    setProfile((prev) =>
      prev
        ? {
            ...prev,
            experience: prev.experience.map((exp) =>
              exp.id === experienceId
                ? { ...exp, bullets: exp.bullets.map((b) => (b.id === bulletId ? { ...b, [bulletField]: value } : b)) }
                : exp,
            ),
          }
        : prev,
    );
  }
  function updateBulletTags(experienceId: string, bulletId: string, text: string) {
    const tags = textToTags(text);
    setProfile((prev) =>
      prev
        ? {
            ...prev,
            experience: prev.experience.map((exp) =>
              exp.id === experienceId ? { ...exp, bullets: exp.bullets.map((b) => (b.id === bulletId ? { ...b, tags } : b)) } : exp,
            ),
          }
        : prev,
    );
  }

  function selectedBulletIds(exp: ProfileDoc["experience"][number]): string[] {
    return positioning?.bulletSelection[exp.id] ?? exp.bullets.map((b) => b.id);
  }
  function setSelectedBulletIds(experienceId: string, ids: string[]) {
    setPositioning((prev) => (prev ? { ...prev, bulletSelection: { ...prev.bulletSelection, [experienceId]: ids } } : prev));
  }
  function addBulletToSelection(exp: ProfileDoc["experience"][number], bulletId: string) {
    const current = selectedBulletIds(exp);
    if (current.includes(bulletId)) return;
    setSelectedBulletIds(exp.id, [...current, bulletId]);
  }
  function removeBulletFromSelection(exp: ProfileDoc["experience"][number], bulletId: string) {
    setSelectedBulletIds(
      exp.id,
      selectedBulletIds(exp).filter((id) => id !== bulletId),
    );
  }

  // ---- Positioning: targetTitle / summary / skills ----
  function updateTargetTitle(value: string) {
    setPositioning((prev) => (prev ? { ...prev, targetTitle: value } : prev));
  }
  function updateSummary(value: string) {
    setPositioning((prev) => (prev ? { ...prev, summary: value } : prev));
  }
  function updateSkill(index: number, value: string) {
    setPositioning((prev) => (prev ? { ...prev, skillsOrder: prev.skillsOrder.map((s, i) => (i === index ? value : s)) } : prev));
  }
  function addSkill() {
    setPositioning((prev) => (prev ? { ...prev, skillsOrder: [...prev.skillsOrder, ""] } : prev));
  }
  function removeSkill(index: number) {
    setPositioning((prev) => (prev ? { ...prev, skillsOrder: prev.skillsOrder.filter((_, i) => i !== index) } : prev));
  }
  function moveSkill(index: number, direction: -1 | 1) {
    setPositioning((prev) => {
      if (!prev) return prev;
      const target = index + direction;
      if (target < 0 || target >= prev.skillsOrder.length) return prev;
      const next = [...prev.skillsOrder];
      [next[index], next[target]] = [next[target], next[index]];
      return { ...prev, skillsOrder: next };
    });
  }

  async function handleSave() {
    if (!profile || !originalProfile || !positioning || !originalPositioning) return;

    setSaving(true);
    setSaveError(null);
    setSaveResult(null);

    const { patch: profilePatch, unsupported: profileUnsupported } = diffProfile(originalProfile, profile);
    const { patch: positioningPatch, unsupported: positioningUnsupported } = diffPositioning(originalPositioning, positioning);
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
              results.profile = {
                ok: false,
                detail: data.error ?? `Failed (${res.status})`,
                issues: Array.isArray(data.issues) ? data.issues : undefined,
              };
              return;
            }
            results.profile = { ok: true, detail: `Saved: ${(data.saved ?? []).join(", ")}` };
            setOriginalProfile(profile);
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
              results.positioning = {
                ok: false,
                detail: data.error ?? `Failed (${res.status})`,
                issues: Array.isArray(data.issues) ? data.issues : undefined,
              };
              return;
            }
            results.positioning = { ok: true, detail: `Saved: ${(data.saved ?? []).join(", ")}` };
            setOriginalPositioning(positioning);
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

  const inputClass = "rounded border border-neutral-300 px-3 py-2 text-xs";

  return (
    <div className="min-h-screen pb-24">
      <header className="sticky top-10 z-10 border-b border-neutral-200 bg-white/90 backdrop-blur">
        <div className="flex items-center justify-between px-6 py-3">
          <div>
            <h1 className="text-sm font-semibold text-neutral-800">Edit positioning: {positioningId}</h1>
            <p className="text-xs text-neutral-500">
              Edit fields below, then Save changes.{" "}
              <Link href="/admin/positionings" className="underline hover:no-underline">
                Download a context prompt for external AI
              </Link>{" "}
              if you&apos;d rather draft a whole new positioning that way.
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
              disabled={saving || loading || !profile || !positioning}
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

      {saveResult ? (
        <div className="mx-6 mt-4 flex flex-col gap-1 text-xs">
          {saveResult.profile ? (
            <div className={saveResult.profile.ok ? "text-green-700" : "text-red-600"}>
              <p>
                Profile (personal/education/bullets): {saveResult.profile.ok ? "✓" : "✗"} {saveResult.profile.detail}
              </p>
              {saveResult.profile.issues ? <ZodIssuesList issues={saveResult.profile.issues} /> : null}
            </div>
          ) : null}
          {saveResult.positioning ? (
            <div className={saveResult.positioning.ok ? "text-green-700" : "text-red-600"}>
              <p>
                Positioning (title/summary/skills/bulletSelection): {saveResult.positioning.ok ? "✓" : "✗"} {saveResult.positioning.detail}
              </p>
              {saveResult.positioning.issues ? <ZodIssuesList issues={saveResult.positioning.issues} /> : null}
            </div>
          ) : null}
          {!saveResult.profile && !saveResult.positioning ? <p className="text-neutral-500">No changes to save.</p> : null}
          {saveResult.unsupported.length > 0 ? (
            <div className="mt-1 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-amber-800">
              <p className="font-semibold">
                Not saved — not supported by Save (structural adds/removes outside this form&apos;s controls; use the Seed
                Positioning JSON tool instead):
              </p>
              <ul className="mt-1 list-disc pl-4">
                {saveResult.unsupported.map((u, i) => (
                  <li key={i}>{u}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
      {saveError ? <p className="mx-6 mt-2 text-xs text-red-600">{saveError}</p> : null}

      {previewUrl ? (
        <section className="mx-6 mt-4">
          <h2 className="text-sm font-semibold text-cv-navy">PDF Preview</h2>
          <iframe title="CV PDF preview" src={previewUrl} className="mt-2 h-[85vh] w-full rounded border border-neutral-300" />
        </section>
      ) : null}

      {loading || !profile || !positioning ? (
        <p className="mt-12 text-center text-sm text-neutral-500">Loading…</p>
      ) : (
        <div className="mx-auto my-8 max-w-3xl px-6">
          <section>
            <h2 className="text-sm font-semibold text-cv-navy">Positioning</h2>
            <div className="mt-3 flex flex-col gap-4">
              <label className="flex flex-col gap-1 text-xs">
                <span className="font-medium text-neutral-700">Target title</span>
                <input value={positioning.targetTitle} onChange={(e) => updateTargetTitle(e.target.value)} className={inputClass} />
              </label>
              <label className="flex flex-col gap-1 text-xs">
                <span className="font-medium text-neutral-700">Summary</span>
                <textarea value={positioning.summary} onChange={(e) => updateSummary(e.target.value)} rows={4} className={inputClass} />
              </label>
            </div>
          </section>

          <section className="mt-8 border-t border-neutral-200 pt-6">
            <h2 className="text-sm font-semibold text-cv-navy">Personal</h2>
            <div className="mt-3 grid grid-cols-2 gap-4">
              {PERSONAL_FIELDS.map((field) => (
                <label key={field} className="flex flex-col gap-1 text-xs">
                  <span className="font-medium capitalize text-neutral-700">{field}</span>
                  <input
                    value={profile.personal[field] ?? ""}
                    onChange={(e) => updatePersonal(field, e.target.value)}
                    placeholder={field === "website" ? "example.com" : undefined}
                    className={inputClass}
                  />
                </label>
              ))}
            </div>

            <div className="mt-4">
              <span className="text-xs font-medium text-neutral-700">
                Address <span className="font-normal text-neutral-400">(for application forms — not shown on the CV)</span>
              </span>
              <div className="mt-2 grid grid-cols-2 gap-4">
                {ADDRESS_FIELDS.map(({ field, label }) => (
                  <label key={field} className="flex flex-col gap-1 text-xs">
                    <span className="font-medium text-neutral-700">{label}</span>
                    <input
                      value={profile.personal.address?.[field] ?? ""}
                      onChange={(e) => updateAddress(field, e.target.value)}
                      className={inputClass}
                    />
                  </label>
                ))}
              </div>
            </div>

            <div className="mt-4">
              <span className="text-xs font-medium text-neutral-700">Languages</span>
              <div className="mt-2 flex flex-col gap-2">
                {profile.personal.languages.map((lang, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      value={lang.lang}
                      onChange={(e) => updateLanguage(i, "lang", e.target.value)}
                      placeholder="Language"
                      className={`${inputClass} flex-1`}
                    />
                    <input
                      value={lang.level}
                      onChange={(e) => updateLanguage(i, "level", e.target.value)}
                      placeholder="Level"
                      className={`${inputClass} flex-1`}
                    />
                    <button
                      type="button"
                      onClick={() => removeLanguage(i)}
                      aria-label="Remove language"
                      className="rounded border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addLanguage}
                  className="mt-1 self-start rounded border border-cv-navy px-3 py-2 text-xs font-semibold text-cv-navy hover:bg-cv-navy/5"
                >
                  + Add language
                </button>
              </div>
            </div>
          </section>

          <section className="mt-8 border-t border-neutral-200 pt-6">
            <h2 className="text-sm font-semibold text-cv-navy">Education</h2>
            <div className="mt-3 flex flex-col gap-4">
              {profile.education.map((edu) => (
                <div key={edu.id} className="rounded border border-neutral-200 p-4">
                  <div className="grid grid-cols-2 gap-4">
                    {EDUCATION_FIELDS.map((field) => (
                      <label key={field} className="flex flex-col gap-1 text-xs">
                        <span className="font-medium capitalize text-neutral-700">{field}</span>
                        <input
                          value={edu[field] ?? ""}
                          onChange={(e) => updateEducation(edu.id, field, e.target.value)}
                          className={inputClass}
                        />
                      </label>
                    ))}
                  </div>
                  <label className="mt-3 flex flex-col gap-1 text-xs">
                    <span className="font-medium text-neutral-700">
                      Description ({educationDescField === "descriptionFr" ? "FR" : "EN"})
                    </span>
                    <textarea
                      value={edu[educationDescField] ?? ""}
                      onChange={(e) => updateEducationDescription(edu.id, e.target.value)}
                      rows={2}
                      className={inputClass}
                    />
                  </label>
                  <label className="mt-3 flex flex-col gap-1 text-xs">
                    <span className="font-medium text-neutral-700">Tags (comma-separated)</span>
                    <input value={tagsToText(edu.tags)} onChange={(e) => updateEducationTags(edu.id, e.target.value)} className={inputClass} />
                  </label>
                  <button
                    type="button"
                    onClick={() => removeEducation(edu.id)}
                    className="mt-3 rounded border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                  >
                    Remove entry
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addEducation}
                className="self-start rounded border border-cv-navy px-3 py-2 text-xs font-semibold text-cv-navy hover:bg-cv-navy/5"
              >
                + Add education entry
              </button>
            </div>
          </section>

          <section className="mt-8 border-t border-neutral-200 pt-6">
            <h2 className="text-sm font-semibold text-cv-navy">
              Experience bullets ({bulletField === "textFr" ? "editing textFr" : "editing text"})
            </h2>
            <div className="mt-3 flex flex-col gap-4">
              {profile.experience.map((exp) => {
                const selectedIds = selectedBulletIds(exp);
                const selectedBullets = selectedIds
                  .map((id) => exp.bullets.find((b) => b.id === id))
                  .filter((b): b is ProfileDoc["experience"][number]["bullets"][number] => b !== undefined);
                const availableToAdd = exp.bullets.filter((b) => !selectedIds.includes(b.id));

                return (
                  <details key={exp.id} open className="rounded border border-neutral-200 p-4">
                    <summary className="cursor-pointer select-none text-xs font-semibold text-neutral-800">
                      {exp.title} — {exp.company}
                    </summary>
                    <ul className="mt-3 flex flex-col gap-3">
                      {selectedBullets.map((bullet) => (
                        <li key={bullet.id} className="rounded border border-neutral-200 p-3">
                          <textarea
                            value={bullet[bulletField] ?? ""}
                            onChange={(e) => updateBullet(exp.id, bullet.id, e.target.value)}
                            rows={2}
                            className={`${inputClass} w-full`}
                          />
                          <div className="mt-2 flex items-center gap-2">
                            <input
                              value={tagsToText(bullet.tags)}
                              onChange={(e) => updateBulletTags(exp.id, bullet.id, e.target.value)}
                              placeholder="Tags (comma-separated)"
                              className={`${inputClass} flex-1`}
                            />
                            <button
                              type="button"
                              onClick={() => removeBulletFromSelection(exp, bullet.id)}
                              className="rounded border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                            >
                              Remove
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                    {availableToAdd.length > 0 ? (
                      <select
                        value=""
                        onChange={(e) => {
                          if (e.target.value) addBulletToSelection(exp, e.target.value);
                        }}
                        className={`${inputClass} mt-3 w-full`}
                      >
                        <option value="">+ Add bullet from profile…</option>
                        {availableToAdd.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.id}: {b.text.length > 70 ? `${b.text.slice(0, 70)}…` : b.text}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <p className="mt-3 text-xs text-neutral-400">All of this role&apos;s profile bullets are already included.</p>
                    )}
                  </details>
                );
              })}
            </div>
          </section>

          <section className="mt-8 border-t border-neutral-200 pt-6">
            <h2 className="text-sm font-semibold text-cv-navy">Skills (this positioning only)</h2>
            <div className="mt-3 flex flex-col gap-2">
              {positioning.skillsOrder.map((skill, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input value={skill} onChange={(e) => updateSkill(i, e.target.value)} className={`${inputClass} flex-1`} />
                  <button
                    type="button"
                    onClick={() => moveSkill(i, -1)}
                    disabled={i === 0}
                    aria-label="Move up"
                    className="rounded border border-neutral-300 px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => moveSkill(i, 1)}
                    disabled={i === positioning.skillsOrder.length - 1}
                    aria-label="Move down"
                    className="rounded border border-neutral-300 px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => removeSkill(i)}
                    aria-label="Remove skill"
                    className="rounded border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addSkill}
                className="mt-2 self-start rounded border border-cv-navy px-3 py-2 text-xs font-semibold text-cv-navy hover:bg-cv-navy/5"
              >
                + Add skill
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
