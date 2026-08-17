"use client";

/**
 * Gated admin editor for one positioning.
 *
 * This file is the entry point only: it decides what to render (login form,
 * loading state, or the form), owns the PDF preview/export actions, and lays
 * out the sections. Everything else is split out:
 *
 *  - ./usePositioningEditor — loading both documents, every field mutation,
 *    and the diff-and-save round trip
 *  - ./sections/* — one component per group of fields, each taking exactly
 *    the values and callbacks it uses as props
 *  - ./diff.ts — which edits the targeted PATCH routes can actually persist
 *  - ./SaveResultPanel — what the last save did and didn't store
 *
 * Logged out, this renders ONLY <AdminLoginForm /> — no data fetch, no CV
 * content. Drafting a whole new positioning from a job offer is a separate,
 * fully automatic flow at /admin/positionings.
 */

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { RoleLanguageSelector } from "@/components/RoleLanguageSelector";
import { AdminLoginForm } from "@/components/AdminLoginForm";
import { useAuth } from "@/lib/auth-context";
import { downloadCvPdf, renderCvPdf } from "@/lib/cv-pdf-client";
import { usePositioningEditor } from "./usePositioningEditor";
import { SaveResultPanel } from "./SaveResultPanel";
import { PositioningSection } from "./sections/PositioningSection";
import { PersonalSection } from "./sections/PersonalSection";
import { EducationSection } from "./sections/EducationSection";
import { ExperienceBulletsSection } from "./sections/ExperienceBulletsSection";
import { SkillsSection } from "./sections/SkillsSection";

export default function EditPositioningPage() {
  const params = useParams<{ positioningId: string }>();
  const router = useRouter();
  const positioningId = params.positioningId;
  const { isLoggedIn, statusLoaded, logout } = useAuth();

  const editor = usePositioningEditor(positioningId, isLoggedIn);
  const { profile, positioning, loading, loadError, saving, saveError, saveResult } = editor;

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // Revoke the previous preview object URL whenever it's replaced or the page
  // unmounts — otherwise every preview pins another PDF blob in memory.
  useEffect(() => {
    if (!previewUrl) return;
    return () => {
      URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // Reset page state in the event handler (not in an effect), so "Loading…"
  // shows immediately during client-side navigation instead of leaving the
  // previous positioning's data on screen while re-fetching.
  function handleNavigate(nextPositioningId: string) {
    if (nextPositioningId === positioningId) return;
    editor.resetForNavigation();
    setPreviewUrl(null);
    setPreviewError(null);
    router.push(`/admin/edit/${nextPositioningId}`);
  }

  async function handlePreview() {
    setPreviewing(true);
    setPreviewError(null);
    try {
      const { blob } = await renderCvPdf(positioningId);
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
      await downloadCvPdf(positioningId);
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
              Edit fields below, then Save changes.{" "}
              <Link href="/admin/positionings" className="underline hover:no-underline">
                Generate a new CV from a job offer
              </Link>{" "}
              if you&apos;d rather draft a whole new positioning that way.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/admin/positionings"
              className="rounded border border-neutral-300 px-4 py-2 text-xs font-semibold tracking-wide text-neutral-700 hover:bg-neutral-50"
            >
              Generate from job offer
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
              onClick={() => editor.save()}
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

      {saveResult ? <SaveResultPanel result={saveResult} /> : null}
      {saveError ? <p className="mx-6 mt-2 text-xs text-red-600">{saveError}</p> : null}

      {previewUrl ? (
        <section className="mx-6 mt-4">
          <h2 className="text-sm font-semibold text-cv-navy">PDF Preview</h2>
          <iframe
            title="CV PDF preview"
            src={previewUrl}
            className="mt-2 h-[85vh] w-full rounded border border-neutral-300"
          />
        </section>
      ) : null}

      {loading || !profile || !positioning ? (
        <p className="mt-12 text-center text-sm text-neutral-500">Loading…</p>
      ) : (
        <div className="mx-auto my-8 max-w-3xl px-6">
          <PositioningSection
            targetTitle={positioning.targetTitle}
            summary={positioning.summary}
            onTargetTitleChange={editor.skills.updateTargetTitle}
            onSummaryChange={editor.skills.updateSummary}
          />

          <PersonalSection
            personal={profile.personal}
            onPersonalChange={editor.personal.updatePersonal}
            onAddressChange={editor.personal.updateAddress}
            onAddLanguage={editor.personal.addLanguage}
            onLanguageChange={editor.personal.updateLanguage}
            onRemoveLanguage={editor.personal.removeLanguage}
          />

          <EducationSection
            education={profile.education}
            descriptionField={editor.educationDescriptionField}
            onFieldChange={editor.education.updateEducation}
            onDescriptionChange={editor.education.updateEducationDescription}
            onTagsChange={editor.education.updateEducationTags}
            onAdd={editor.education.addEducation}
            onRemove={editor.education.removeEducation}
          />

          <ExperienceBulletsSection
            experience={profile.experience}
            bulletField={editor.bulletField}
            selectedBulletIds={editor.bullets.selectedBulletIds}
            onBulletChange={editor.bullets.updateBullet}
            onBulletTagsChange={editor.bullets.updateBulletTags}
            onAddBullet={editor.bullets.addBulletToSelection}
            onRemoveBullet={editor.bullets.removeBulletFromSelection}
          />

          <SkillsSection
            skills={positioning.skillsOrder}
            onSkillChange={editor.skills.updateSkill}
            onMoveSkill={editor.skills.moveSkill}
            onRemoveSkill={editor.skills.removeSkill}
            onAddSkill={editor.skills.addSkill}
          />
        </div>
      )}
    </div>
  );
}
