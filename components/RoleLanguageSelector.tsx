"use client";

import { useEffect, useState } from "react";

type Language = "en" | "fr";

interface RoleSummary {
  roleGroup: string;
  label: string;
  variants: Partial<Record<Language, string>>; // language -> positioning _id, from GET /api/positionings
}

interface RoleLanguageSelectorProps {
  /** The positioning _id currently being edited, used to derive the selected role/language. */
  currentPositioningId?: string;
  /** Called with the target positioning _id when the user picks a different role or language. */
  onNavigate: (positioningId: string) => void;
}

/**
 * Role + language picker for app/edit/[positioningId]/page.tsx. Adapted from the
 * grouping logic originally in the deleted components/PositioningPicker.tsx (role
 * dropdown + FR/EN toggle over GET /api/positionings' roleGroup/variants shape) —
 * the difference is this one derives its selected state from the current URL's
 * positioningId instead of owning local selection state, and calls onNavigate()
 * so the caller can do a client-side route change instead of an onSelect callback.
 */
export function RoleLanguageSelector({ currentPositioningId, onNavigate }: RoleLanguageSelectorProps) {
  const [roles, setRoles] = useState<RoleSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/positionings")
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load positionings (${res.status})`);
        return res.json();
      })
      .then((data: RoleSummary[]) => {
        if (!cancelled) setRoles(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load positionings");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const currentRole = roles.find((r) => Object.values(r.variants).some((id) => id === currentPositioningId));
  const currentLanguage = (Object.entries(currentRole?.variants ?? {}).find(([, id]) => id === currentPositioningId)?.[0] ??
    undefined) as Language | undefined;

  if (error) {
    return <span className="text-xs text-red-600">{error}</span>;
  }

  function selectRole(roleGroup: string) {
    const role = roles.find((r) => r.roleGroup === roleGroup);
    if (!role) return;
    const nextLanguage: Language = currentLanguage && role.variants[currentLanguage] ? currentLanguage : role.variants.fr ? "fr" : "en";
    const id = role.variants[nextLanguage];
    if (id) onNavigate(id);
  }

  function selectLanguage(lang: Language) {
    const id = currentRole?.variants[lang];
    if (id) onNavigate(id);
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium text-neutral-600">Role:</span>
      <select
        value={currentRole?.roleGroup ?? ""}
        onChange={(e) => selectRole(e.target.value)}
        aria-label="Role"
        className="rounded border border-neutral-300 bg-white px-3 py-2 text-xs font-medium text-neutral-800"
      >
        <option value="" disabled>
          Select a role…
        </option>
        {roles.map((r) => (
          <option key={r.roleGroup} value={r.roleGroup}>
            {r.label}
          </option>
        ))}
      </select>

      <div className="flex overflow-hidden rounded border border-neutral-300">
        {(["fr", "en"] as const).map((lang) => {
          const disabled = !currentRole?.variants[lang];
          const active = currentLanguage === lang;
          return (
            <button
              key={lang}
              type="button"
              disabled={disabled}
              onClick={() => selectLanguage(lang)}
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
    </div>
  );
}
