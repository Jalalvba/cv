"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { ProfileDoc, PositioningDoc, CvData } from "@/lib/cv-data";
import { slugify } from "@/lib/utils";
import { RoleLanguageSelector } from "@/components/RoleLanguageSelector";
import { useAuth } from "@/lib/auth-context";
import { AdminLoginForm } from "@/components/AdminLoginForm";

type PersonalField = "name" | "email" | "phone" | "location" | "website";
type EducationField = "degree" | "school" | "endDate" | "honors";
type BulletField = "text" | "textFr";

const PERSONAL_FIELDS: PersonalField[] = ["name", "email", "phone", "location", "website"];
const EDUCATION_FIELDS: EducationField[] = ["degree", "school", "endDate", "honors"];

interface SaveOutcome {
  ok: boolean;
  detail: string;
}

export default function EditPositioningPage() {
  const params = useParams<{ positioningId: string }>();
  const router = useRouter();
  const positioningId = params.positioningId;
  const { isLoggedIn, statusLoaded, logout } = useAuth();

  const [profile, setProfile] = useState<ProfileDoc | null>(null);
  const [originalProfile, setOriginalProfile] = useState<ProfileDoc | null>(null);
  const [positioning, setPositioning] = useState<PositioningDoc | null>(null);
  const [originalPositioning, setOriginalPositioning] = useState<PositioningDoc | null>(null);
  const [cvData, setCvData] = useState<CvData | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveResult, setSaveResult] = useState<{ profile?: SaveOutcome; positioning?: SaveOutcome } | null>(null);

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
        setProfile(profileData);
        setOriginalProfile(profileData);
        setPositioning(positioningData);
        setOriginalPositioning(positioningData);
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

  const bulletField: BulletField = positioning?.language === "fr" ? "textFr" : "text";

  // Which experience/bullets this positioning actually includes — mirrors
  // lib/assemble.ts's bulletSelection fallback (an omitted role shows all its bullets).
  const scopedGroups = useMemo(() => {
    if (!profile || !positioning) return [];
    return profile.experience
      .map((exp) => {
        const selectedIds = positioning.bulletSelection[exp.id];
        const bullets = selectedIds
          ? selectedIds
              .map((id) => exp.bullets.find((b) => b.id === id))
              .filter((b): b is ProfileDoc["experience"][number]["bullets"][number] => b !== undefined)
          : exp.bullets;
        return { experienceId: exp.id, title: exp.title, company: exp.company, bullets };
      })
      .filter((group) => group.bullets.length > 0);
  }, [profile, positioning]);

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

  function updatePersonal(field: PersonalField, value: string) {
    setProfile((prev) => (prev ? { ...prev, personal: { ...prev.personal, [field]: value } } : prev));
  }

  function updateEducation(id: string, field: EducationField, value: string) {
    setProfile((prev) =>
      prev ? { ...prev, education: prev.education.map((e) => (e.id === id ? { ...e, [field]: value } : e)) } : prev,
    );
  }

  function updateBullet(experienceId: string, bulletId: string, value: string) {
    setProfile((prev) =>
      prev
        ? {
            ...prev,
            experience: prev.experience.map((exp) =>
              exp.id === experienceId
                ? {
                    ...exp,
                    bullets: exp.bullets.map((b) => (b.id === bulletId ? { ...b, [bulletField]: value } : b)),
                  }
                : exp,
            ),
          }
        : prev,
    );
  }

  function updateSkill(index: number, value: string) {
    setPositioning((prev) =>
      prev ? { ...prev, skillsOrder: prev.skillsOrder.map((s, i) => (i === index ? value : s)) } : prev,
    );
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

    const personalDiff: Partial<Record<PersonalField, string>> = {};
    for (const field of PERSONAL_FIELDS) {
      const current = profile.personal[field] ?? "";
      const before = originalProfile.personal[field] ?? "";
      if (current !== before) personalDiff[field] = current;
    }

    const educationDiff: (Partial<Record<EducationField, string>> & { id: string })[] = [];
    for (const edu of profile.education) {
      const orig = originalProfile.education.find((e) => e.id === edu.id);
      if (!orig) continue;
      const fields: Partial<Record<EducationField, string>> = {};
      for (const field of EDUCATION_FIELDS) {
        const current = edu[field] ?? "";
        const before = orig[field] ?? "";
        if (current !== before) fields[field] = current;
      }
      if (Object.keys(fields).length > 0) educationDiff.push({ id: edu.id, ...fields });
    }

    const bulletsDiff: { experienceId: string; bulletId: string; text: string; field: BulletField }[] = [];
    for (const exp of profile.experience) {
      const origExp = originalProfile.experience.find((e) => e.id === exp.id);
      if (!origExp) continue;
      for (const bullet of exp.bullets) {
        const origBullet = origExp.bullets.find((b) => b.id === bullet.id);
        if (!origBullet) continue;
        const current = bullet[bulletField] ?? "";
        const before = origBullet[bulletField] ?? "";
        if (current !== before) {
          bulletsDiff.push({ experienceId: exp.id, bulletId: bullet.id, text: current, field: bulletField });
        }
      }
    }

    const skillsChanged = JSON.stringify(positioning.skillsOrder) !== JSON.stringify(originalPositioning.skillsOrder);
    const hasProfileChanges = Object.keys(personalDiff).length > 0 || educationDiff.length > 0 || bulletsDiff.length > 0;

    if (!hasProfileChanges && !skillsChanged) {
      setSaveError(null);
      setSaveResult({});
      return;
    }

    setSaving(true);
    setSaveError(null);
    setSaveResult(null);

    const results: { profile?: SaveOutcome; positioning?: SaveOutcome } = {};
    const requests: Promise<void>[] = [];

    if (hasProfileChanges) {
      requests.push(
        fetch("/api/admin/update-profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...(Object.keys(personalDiff).length > 0 ? { personal: personalDiff } : {}),
            ...(educationDiff.length > 0 ? { education: educationDiff } : {}),
            ...(bulletsDiff.length > 0 ? { bullets: bulletsDiff } : {}),
          }),
        })
          .then(async (res) => {
            const data = await res.json();
            if (!res.ok) {
              results.profile = { ok: false, detail: data.error ?? `Failed (${res.status})` };
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

    if (skillsChanged) {
      requests.push(
        fetch("/api/admin/update-positioning", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ positioningId, skillsOrder: positioning.skillsOrder }),
        })
          .then(async (res) => {
            const data = await res.json();
            if (!res.ok) {
              results.positioning = { ok: false, detail: data.error ?? `Failed (${res.status})` };
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
              {positioning
                ? `language: ${positioning.language} — format: ${positioning.format} — bullets edit ${bulletField === "textFr" ? "textFr" : "text"} in profile`
                : "Bullets, skills, personal info, and education for this positioning."}
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
              disabled={saving || !profile || !positioning}
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
      {saveError ? <p className="mx-6 mt-4 text-xs text-red-600">{saveError}</p> : null}
      {saveResult ? (
        <div className="mx-6 mt-4 flex flex-col gap-1 text-xs">
          {saveResult.profile ? (
            <p className={saveResult.profile.ok ? "text-green-700" : "text-red-600"}>
              Profile (bullets/personal/education): {saveResult.profile.ok ? "✓" : "✗"} {saveResult.profile.detail}
            </p>
          ) : null}
          {saveResult.positioning ? (
            <p className={saveResult.positioning.ok ? "text-green-700" : "text-red-600"}>
              Positioning (skills): {saveResult.positioning.ok ? "✓" : "✗"} {saveResult.positioning.detail}
            </p>
          ) : null}
          {!saveResult.profile && !saveResult.positioning ? <p className="text-neutral-500">No changes to save.</p> : null}
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
      ) : profile && positioning ? (
        <div className="mx-auto my-8 max-w-3xl px-6">
          {cvData ? (
            <section className="rounded border border-neutral-200 bg-neutral-50 p-4">
              <h2 className="text-sm font-semibold text-cv-navy">Assembled title &amp; summary (text preview)</h2>
              <p className="mt-1 text-xs text-neutral-600">{cvData.title}</p>
              <p className="mt-1 text-xs text-neutral-500">{cvData.summary}</p>
            </section>
          ) : null}

          <section className="mt-8">
            <h2 className="text-sm font-semibold text-cv-navy">Personal</h2>
            <div className="mt-3 grid grid-cols-2 gap-4">
              {PERSONAL_FIELDS.map((field) => (
                <label key={field} className="flex flex-col gap-1 text-xs">
                  <span className="font-medium capitalize text-neutral-700">{field}</span>
                  <input
                    value={profile.personal[field] ?? ""}
                    onChange={(e) => updatePersonal(field, e.target.value)}
                    placeholder={field === "website" ? "example.com" : undefined}
                    className="rounded border border-neutral-300 px-3 py-2"
                  />
                </label>
              ))}
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
                          className="rounded border border-neutral-300 px-3 py-2"
                        />
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-8 border-t border-neutral-200 pt-6">
            <h2 className="text-sm font-semibold text-cv-navy">
              Experience bullets included in this positioning ({bulletField === "textFr" ? "editing textFr" : "editing text"})
            </h2>
            <div className="mt-3 flex flex-col gap-6">
              {scopedGroups.map((group) => (
                <div key={group.experienceId}>
                  <p className="text-xs font-semibold text-neutral-800">
                    {group.title} — {group.company}
                  </p>
                  <ul className="mt-2 flex flex-col gap-2">
                    {group.bullets.map((bullet) => (
                      <li key={bullet.id}>
                        <textarea
                          value={bullet[bulletField] ?? ""}
                          onChange={(e) => updateBullet(group.experienceId, bullet.id, e.target.value)}
                          rows={2}
                          className="w-full rounded border border-neutral-300 px-3 py-2 text-xs"
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-8 border-t border-neutral-200 pt-6">
            <h2 className="text-sm font-semibold text-cv-navy">Skills (this positioning only)</h2>
            <div className="mt-3 flex flex-col gap-2">
              {positioning.skillsOrder.map((skill, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    value={skill}
                    onChange={(e) => updateSkill(i, e.target.value)}
                    className="flex-1 rounded border border-neutral-300 px-3 py-2 text-xs"
                  />
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
      ) : null}
    </div>
  );
}
