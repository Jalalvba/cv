import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import type { PositioningDoc } from "@/lib/cv-data";

export const runtime = "nodejs";

// Role-level display names, independent of any positioning's language-specific
// targetTitle. Falls back to a humanized roleGroup for any role not listed here,
// so a newly-seeded role never breaks the picker — it just gets a default label.
const ROLE_LABELS: Record<string, string> = {
  after_sales_manager: "After-Sales Manager",
  technical_trainer: "Technical Trainer",
  fleet_management: "Fleet Manager",
};

function humanize(roleGroup: string): string {
  return roleGroup
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

interface RoleSummary {
  roleGroup: string;
  label: string;
  variants: Partial<Record<PositioningDoc["language"], string>>; // language -> positioning _id
}

export async function GET() {
  const db = await getDb();
  const positionings = await db
    .collection<PositioningDoc>("positionings")
    .find({}, { projection: { _id: 1, roleGroup: 1, language: 1 } })
    .toArray();

  const byRole = new Map<string, RoleSummary>();
  for (const p of positionings) {
    let role = byRole.get(p.roleGroup);
    if (!role) {
      role = { roleGroup: p.roleGroup, label: ROLE_LABELS[p.roleGroup] ?? humanize(p.roleGroup), variants: {} };
      byRole.set(p.roleGroup, role);
    }
    role.variants[p.language] = p._id;
  }

  return NextResponse.json(Array.from(byRole.values()));
}
