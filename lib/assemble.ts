import type { ProfileDoc, PositioningDoc, CvData } from "@/lib/cv-data";

/**
 * Merges a ProfileDoc (facts) + PositioningDoc (selection/framing) into one
 * CvData for rendering — filters bullets per bulletSelection, resolves
 * text vs. textFr by language, formats dates. See DOCS.md §7.3.
 */

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function formatMonthYear(isoYearMonth: string): string {
  const [year, month] = isoYearMonth.split("-");
  return `${MONTH_NAMES[Number(month) - 1]} ${year}`;
}

function formatDateRange(startDate: string, endDate: string | null): string {
  return `${formatMonthYear(startDate)} - ${endDate ? formatMonthYear(endDate) : "Present"}`;
}

// Computed fresh on every assemble() call (not stored) so it's never stale —
// `today` is a parameter only so tests can pin it.
function computeAge(dateOfBirthIso: string, today: Date = new Date()): number {
  const dob = new Date(`${dateOfBirthIso}T00:00:00Z`);
  let age = today.getUTCFullYear() - dob.getUTCFullYear();
  const hadBirthdayThisYear =
    today.getUTCMonth() > dob.getUTCMonth() ||
    (today.getUTCMonth() === dob.getUTCMonth() && today.getUTCDate() >= dob.getUTCDate());
  if (!hadBirthdayThisYear) age -= 1;
  return age;
}

// Only street/postalCode — city/country are deliberately dropped here because
// `contact.location` already displays "{city}, {country}" (e.g. "Casablanca,
// Morocco"); including them again in this joined-onto-the-same-line string
// would duplicate that. The full address (all four fields) is still stored
// and available wherever the raw personal.address object is used directly
// (e.g. application forms via the admin editor), just not re-shown here.
function formatAddress(address: NonNullable<ProfileDoc["personal"]["address"]>): string | undefined {
  const parts = [address.street, address.postalCode].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : undefined;
}

type Bullet = ProfileDoc["experience"][number]["bullets"][number];
type EducationEntry = ProfileDoc["education"][number];

function resolveBulletText(bullet: Bullet, language: PositioningDoc["language"]): string {
  if (language === "fr") {
    if (bullet.textFr) return bullet.textFr;
    console.warn(`Missing French translation (textFr) for bullet "${bullet.id}" — falling back to English text.`);
  }
  return bullet.text;
}

function resolveEducationDescription(entry: EducationEntry, language: PositioningDoc["language"]): string | undefined {
  if (language === "fr") {
    if (entry.descriptionFr) return entry.descriptionFr;
    if (entry.description) {
      console.warn(
        `Missing French translation (descriptionFr) for education entry "${entry.id}" — falling back to English description.`,
      );
    }
  }
  return entry.description;
}

export function assemble(profile: ProfileDoc, positioning: PositioningDoc): CvData {
  return {
    photoUrl: "/photo.jpg",
    name: profile.personal.name,
    title: positioning.targetTitle,
    contact: {
      email: profile.personal.email,
      phone: profile.personal.phone,
      location: profile.personal.location,
      address: profile.personal.address ? formatAddress(profile.personal.address) : undefined,
      age: profile.personal.dateOfBirth ? computeAge(profile.personal.dateOfBirth) : undefined,
      website: profile.personal.website,
    },
    summary: positioning.summary,
    experience: profile.experience.map((exp) => {
      const selectedIds = positioning.bulletSelection[exp.id];
      const bulletsById = new Map(exp.bullets.map((b) => [b.id, b]));
      const selectedBullets = selectedIds
        ? selectedIds.map((id) => bulletsById.get(id)).filter((b): b is Bullet => b !== undefined)
        : exp.bullets;
      const bullets = selectedBullets.map((b) => resolveBulletText(b, positioning.language));
      return {
        id: exp.id,
        title: exp.title,
        company: exp.company,
        dates: formatDateRange(exp.startDate, exp.endDate),
        bullets,
      };
    }),
    education: profile.education.map((entry) => ({
      id: entry.id,
      degree: entry.degree,
      school: entry.school,
      endDate: entry.endDate,
      honors: entry.honors,
      description: resolveEducationDescription(entry, positioning.language),
      tags: entry.tags,
    })),
    skills: positioning.skillsOrder,
    languages: profile.personal.languages,
  };
}
