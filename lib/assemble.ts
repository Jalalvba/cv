import type { ProfileDoc, PositioningDoc, CvData } from "@/lib/cv-data";

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
