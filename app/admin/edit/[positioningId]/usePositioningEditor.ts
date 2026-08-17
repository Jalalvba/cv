"use client";

import { useCallback, useEffect, useState } from "react";
import type { ProfileDoc, PositioningDoc } from "@/lib/cv-data";
import type { ZodIssueLike } from "@/lib/zod-issues";
import { diffProfile, diffPositioning } from "./diff";
import { newId, textToTags } from "./fields";

/**
 * All non-visual state for the admin editor at
 * app/admin/edit/[positioningId]/page.tsx: loading the two documents,
 * every field mutation the form can perform, and the diff-and-save round
 * trip. Extracted from the page component so the page itself is layout and
 * the sections are pure presentation — each section receives exactly the
 * values and callbacks it uses as props, rather than reading a shared
 * mutable object.
 *
 * Editing is always against a local copy; nothing is written until save()
 * runs, which diffs the copy against the snapshot loaded from the server
 * (see ./diff.ts) and PATCHes only what changed.
 */

/** Profile fields the form edits as plain single-line text inputs. */
export type PersonalField = "name" | "email" | "phone" | "location" | "website" | "dateOfBirth";
/** Education fields the form edits as plain single-line text inputs. */
export type EducationField = "degree" | "school" | "endDate" | "honors";
export type AddressField = "street" | "postalCode" | "city" | "country";

export type ExperienceEntry = ProfileDoc["experience"][number];
export type BulletEntry = ExperienceEntry["bullets"][number];

/** Outcome of one of the two PATCH requests a save can issue. */
export interface SaveOutcome {
  ok: boolean;
  detail: string;
  issues?: ZodIssueLike[];
}

export interface SaveResult {
  profile?: SaveOutcome;
  positioning?: SaveOutcome;
  /** Edits the targeted PATCH routes can't express — reported, never silently dropped. */
  unsupported: string[];
}

/**
 * Reads a PATCH response into a SaveOutcome.
 *
 * Both admin PATCH routes share one response contract ({saved} on success,
 * {error, issues} on failure), so both branches of save() parse it the same
 * way here rather than each repeating the shape checks.
 */
async function readSaveResponse(response: Response): Promise<SaveOutcome> {
  const data = await response.json();
  if (!response.ok) {
    return {
      ok: false,
      detail: data.error ?? `Failed (${response.status})`,
      issues: Array.isArray(data.issues) ? data.issues : undefined,
    };
  }
  return { ok: true, detail: `Saved: ${(data.saved ?? []).join(", ")}` };
}

export function usePositioningEditor(positioningId: string | undefined, isLoggedIn: boolean) {
  const [originalProfile, setOriginalProfile] = useState<ProfileDoc | null>(null);
  const [profile, setProfile] = useState<ProfileDoc | null>(null);
  const [originalPositioning, setOriginalPositioning] = useState<PositioningDoc | null>(null);
  const [positioning, setPositioning] = useState<PositioningDoc | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveResult, setSaveResult] = useState<SaveResult | null>(null);

  /**
   * Which bullet/description field this positioning edits. An "fr"
   * positioning edits the French translation in place; every other
   * positioning edits the English source. This is why the same form can
   * serve both languages without a separate translation screen.
   */
  const bulletField: "text" | "textFr" = positioning?.language === "fr" ? "textFr" : "text";
  const educationDescriptionField: "description" | "descriptionFr" =
    positioning?.language === "fr" ? "descriptionFr" : "description";

  // Only fetch admin data once a session is confirmed — logged-out visitors
  // never see this page's data, only the login form.
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

  /** Clears per-document state so a role/language switch doesn't show stale data. */
  const resetForNavigation = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    setSaveResult(null);
    setSaveError(null);
  }, []);

  // ─── Personal ─────────────────────────────────────────────────────────────

  const updatePersonal = useCallback((field: PersonalField, value: string) => {
    setProfile((prev) => (prev ? { ...prev, personal: { ...prev.personal, [field]: value } } : prev));
  }, []);

  const updateAddress = useCallback((field: AddressField, value: string) => {
    setProfile((prev) =>
      prev ? { ...prev, personal: { ...prev.personal, address: { ...prev.personal.address, [field]: value } } } : prev,
    );
  }, []);

  const addLanguage = useCallback(() => {
    setProfile((prev) =>
      prev
        ? { ...prev, personal: { ...prev.personal, languages: [...prev.personal.languages, { lang: "", level: "" }] } }
        : prev,
    );
  }, []);

  const updateLanguage = useCallback((index: number, field: "lang" | "level", value: string) => {
    setProfile((prev) =>
      prev
        ? {
            ...prev,
            personal: {
              ...prev.personal,
              languages: prev.personal.languages.map((lang, i) => (i === index ? { ...lang, [field]: value } : lang)),
            },
          }
        : prev,
    );
  }, []);

  const removeLanguage = useCallback((index: number) => {
    setProfile((prev) =>
      prev
        ? { ...prev, personal: { ...prev.personal, languages: prev.personal.languages.filter((_, i) => i !== index) } }
        : prev,
    );
  }, []);

  // ─── Education ────────────────────────────────────────────────────────────

  const updateEducation = useCallback((id: string, field: EducationField, value: string) => {
    setProfile((prev) =>
      prev ? { ...prev, education: prev.education.map((e) => (e.id === id ? { ...e, [field]: value } : e)) } : prev,
    );
  }, []);

  const updateEducationDescription = useCallback(
    (id: string, value: string) => {
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              education: prev.education.map((e) => (e.id === id ? { ...e, [educationDescriptionField]: value } : e)),
            }
          : prev,
      );
    },
    [educationDescriptionField],
  );

  const updateEducationTags = useCallback((id: string, text: string) => {
    const tags = textToTags(text);
    setProfile((prev) =>
      prev ? { ...prev, education: prev.education.map((e) => (e.id === id ? { ...e, tags } : e)) } : prev,
    );
  }, []);

  const addEducation = useCallback(() => {
    setProfile((prev) =>
      prev
        ? {
            ...prev,
            education: [...prev.education, { id: newId("edu"), degree: "", school: "", endDate: "", tags: [] }],
          }
        : prev,
    );
  }, []);

  const removeEducation = useCallback((id: string) => {
    setProfile((prev) => (prev ? { ...prev, education: prev.education.filter((e) => e.id !== id) } : prev));
  }, []);

  // ─── Experience bullets ───────────────────────────────────────────────────

  const updateBullet = useCallback(
    (experienceId: string, bulletId: string, value: string) => {
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
    },
    [bulletField],
  );

  const updateBulletTags = useCallback((experienceId: string, bulletId: string, text: string) => {
    const tags = textToTags(text);
    setProfile((prev) =>
      prev
        ? {
            ...prev,
            experience: prev.experience.map((exp) =>
              exp.id === experienceId
                ? { ...exp, bullets: exp.bullets.map((b) => (b.id === bulletId ? { ...b, tags } : b)) }
                : exp,
            ),
          }
        : prev,
    );
  }, []);

  /**
   * The bullet ids this positioning surfaces for a role.
   *
   * A role missing from `bulletSelection` means "include all of this role's
   * bullets" (see DOCS.md §7.2), so the fallback here mirrors assemble()'s
   * — otherwise the editor would show an empty role for something the CV
   * actually renders in full.
   */
  const selectedBulletIds = useCallback(
    (exp: ExperienceEntry): string[] => positioning?.bulletSelection[exp.id] ?? exp.bullets.map((b) => b.id),
    [positioning],
  );

  const setSelectedBulletIds = useCallback((experienceId: string, ids: string[]) => {
    setPositioning((prev) =>
      prev ? { ...prev, bulletSelection: { ...prev.bulletSelection, [experienceId]: ids } } : prev,
    );
  }, []);

  const addBulletToSelection = useCallback(
    (exp: ExperienceEntry, bulletId: string) => {
      const current = selectedBulletIds(exp);
      if (current.includes(bulletId)) return;
      setSelectedBulletIds(exp.id, [...current, bulletId]);
    },
    [selectedBulletIds, setSelectedBulletIds],
  );

  const removeBulletFromSelection = useCallback(
    (exp: ExperienceEntry, bulletId: string) => {
      setSelectedBulletIds(
        exp.id,
        selectedBulletIds(exp).filter((id) => id !== bulletId),
      );
    },
    [selectedBulletIds, setSelectedBulletIds],
  );

  // ─── Positioning: title / summary / skills ────────────────────────────────

  const updateTargetTitle = useCallback((value: string) => {
    setPositioning((prev) => (prev ? { ...prev, targetTitle: value } : prev));
  }, []);

  const updateSummary = useCallback((value: string) => {
    setPositioning((prev) => (prev ? { ...prev, summary: value } : prev));
  }, []);

  const updateSkill = useCallback((index: number, value: string) => {
    setPositioning((prev) =>
      prev ? { ...prev, skillsOrder: prev.skillsOrder.map((s, i) => (i === index ? value : s)) } : prev,
    );
  }, []);

  const addSkill = useCallback(() => {
    setPositioning((prev) => (prev ? { ...prev, skillsOrder: [...prev.skillsOrder, ""] } : prev));
  }, []);

  const removeSkill = useCallback((index: number) => {
    setPositioning((prev) => (prev ? { ...prev, skillsOrder: prev.skillsOrder.filter((_, i) => i !== index) } : prev));
  }, []);

  /** Moves a skill one position up (-1) or down (+1); a no-op at either end. */
  const moveSkill = useCallback((index: number, direction: -1 | 1) => {
    setPositioning((prev) => {
      if (!prev) return prev;
      const target = index + direction;
      if (target < 0 || target >= prev.skillsOrder.length) return prev;
      const next = [...prev.skillsOrder];
      [next[index], next[target]] = [next[target], next[index]];
      return { ...prev, skillsOrder: next };
    });
  }, []);

  // ─── Save ─────────────────────────────────────────────────────────────────

  /**
   * Diffs both edited documents against their loaded snapshots and PATCHes
   * only what changed, to whichever of the two admin routes owns it.
   *
   * The two requests run concurrently because they touch different
   * collections and neither depends on the other's outcome. Each updates its
   * own snapshot on success, so a partial failure (profile saved, positioning
   * rejected) leaves the next save diffing correctly rather than re-sending
   * the already-persisted half.
   */
  async function save() {
    if (!profile || !originalProfile || !positioning || !originalPositioning || !positioningId) return;

    setSaving(true);
    setSaveError(null);
    setSaveResult(null);

    const { patch: profilePatch, unsupported: profileUnsupported } = diffProfile(originalProfile, profile);
    const { patch: positioningPatch, unsupported: positioningUnsupported } = diffPositioning(
      originalPositioning,
      positioning,
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
            results.profile = await readSaveResponse(res);
            if (results.profile.ok) setOriginalProfile(profile);
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
            results.positioning = await readSaveResponse(res);
            if (results.positioning.ok) setOriginalPositioning(positioning);
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

  return {
    profile,
    positioning,
    loading,
    loadError,
    saving,
    saveError,
    saveResult,
    bulletField,
    educationDescriptionField,
    resetForNavigation,
    save,
    personal: { updatePersonal, updateAddress, addLanguage, updateLanguage, removeLanguage },
    education: { updateEducation, updateEducationDescription, updateEducationTags, addEducation, removeEducation },
    bullets: { updateBullet, updateBulletTags, selectedBulletIds, addBulletToSelection, removeBulletFromSelection },
    skills: { updateTargetTitle, updateSummary, updateSkill, addSkill, removeSkill, moveSkill },
  };
}
