/**
 * Plain node:assert unit tests for assemble() — run via `pnpm run test`.
 * No test framework/runner: each block below throws on failure; a clean
 * run ends with the "all assertions passed" line.
 */
import assert from "node:assert/strict";
import { assemble } from "./assemble";
import type { ProfileDoc, PositioningDoc } from "./cv-data";

const profile: ProfileDoc = {
  _id: "jalal_chafiq",
  personal: {
    name: "Jalal Chafiq",
    email: "chafiq.jalal@gmail.com",
    phone: "+212 674 664 173",
    location: "Casablanca, Morocco",
    languages: [{ lang: "French", level: "fluent" }],
  },
  education: [],
  experience: [
    {
      id: "exp_avis",
      title: "Technical Manager",
      company: "AVIS Maroc, Casablanca",
      location: "Casablanca",
      startDate: "2025-07",
      endDate: null,
      bullets: [
        { id: "avis_b1", text: "Bullet one", tags: [] },
        { id: "avis_b2", text: "Bullet two", tags: [] },
        { id: "avis_b3", text: "Bullet three", tags: [] },
      ],
    },
    {
      id: "exp_dekra",
      title: "Vehicle Technical Inspection Center Manager",
      company: "DEKRA Automotive Maroc, Casablanca",
      location: "Casablanca",
      startDate: "2015-02",
      endDate: "2022-12",
      bullets: [
        { id: "dekra_b1", text: "DEKRA bullet one", tags: [] },
        { id: "dekra_b2", text: "DEKRA bullet two", tags: [] },
      ],
    },
  ],
};

function positioningWith(bulletSelection: PositioningDoc["bulletSelection"]): PositioningDoc {
  return {
    _id: "test_positioning",
    roleGroup: "test_positioning",
    targetTitle: "Test Title",
    summary: "Test summary",
    skillsOrder: ["Skill A", "Skill B"],
    bulletSelection,
    format: "visual",
    language: "en",
  };
}

// (a) filtering works: only the selected bullet ids for a role are included
{
  const positioning = positioningWith({ exp_avis: ["avis_b1", "avis_b3"] });
  const result = assemble(profile, positioning);
  const avis = result.experience.find((e) => e.id === "exp_avis")!;
  assert.deepEqual(avis.bullets, ["Bullet one", "Bullet three"]);
}

// (b) a role omitted from bulletSelection defaults to all of that role's bullets
{
  const positioning = positioningWith({ exp_avis: ["avis_b1"] }); // exp_dekra omitted entirely
  const result = assemble(profile, positioning);
  const dekra = result.experience.find((e) => e.id === "exp_dekra")!;
  assert.deepEqual(dekra.bullets, ["DEKRA bullet one", "DEKRA bullet two"]);
}

// (c) bullet order follows bulletSelection order, not profile order
{
  const positioning = positioningWith({ exp_avis: ["avis_b3", "avis_b1"] });
  const result = assemble(profile, positioning);
  const avis = result.experience.find((e) => e.id === "exp_avis")!;
  assert.deepEqual(avis.bullets, ["Bullet three", "Bullet one"]);
}

// bonus: date formatting, including "Present" for a null endDate
{
  const positioning = positioningWith({});
  const result = assemble(profile, positioning);
  const avis = result.experience.find((e) => e.id === "exp_avis")!;
  const dekra = result.experience.find((e) => e.id === "exp_dekra")!;
  assert.equal(avis.dates, "July 2025 - Present");
  assert.equal(dekra.dates, "February 2015 - December 2022");
}

// (d) fr positioning uses textFr when present
{
  const frProfile: ProfileDoc = {
    ...profile,
    experience: [
      {
        ...profile.experience[0],
        bullets: [{ id: "avis_b1", text: "Bullet one", textFr: "Puce un", tags: [] }],
      },
    ],
  };
  const positioning: PositioningDoc = { ...positioningWith({ exp_avis: ["avis_b1"] }), language: "fr" };
  const result = assemble(frProfile, positioning);
  const avis = result.experience.find((e) => e.id === "exp_avis")!;
  assert.deepEqual(avis.bullets, ["Puce un"]);
}

// (e) fr positioning falls back to English text (and warns) when textFr is missing
{
  const avisOnlyProfile: ProfileDoc = { ...profile, experience: [profile.experience[0]] };
  const positioning: PositioningDoc = { ...positioningWith({ exp_avis: ["avis_b1"] }), language: "fr" };
  const warnings: string[] = [];
  const originalWarn = console.warn;
  console.warn = (msg: string) => warnings.push(msg);
  let result;
  try {
    result = assemble(avisOnlyProfile, positioning);
  } finally {
    console.warn = originalWarn;
  }
  const avis = result.experience.find((e) => e.id === "exp_avis")!;
  assert.deepEqual(avis.bullets, ["Bullet one"]);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /avis_b1/);
}

// (f) education description resolves per language: en positioning uses `description`
{
  const profileWithEdu: ProfileDoc = {
    ...profile,
    education: [
      { id: "edu_phd", degree: "PhD", school: "Some University", endDate: "2024", description: "EN description", descriptionFr: "Description FR", tags: [] },
    ],
  };
  const result = assemble(profileWithEdu, positioningWith({}));
  const edu = result.education.find((e) => e.id === "edu_phd")!;
  assert.equal(edu.description, "EN description");
}

// (g) fr positioning uses descriptionFr when present
{
  const profileWithEdu: ProfileDoc = {
    ...profile,
    education: [
      { id: "edu_phd", degree: "PhD", school: "Some University", endDate: "2024", description: "EN description", descriptionFr: "Description FR", tags: [] },
    ],
  };
  const positioning: PositioningDoc = { ...positioningWith({}), language: "fr" };
  const result = assemble(profileWithEdu, positioning);
  const edu = result.education.find((e) => e.id === "edu_phd")!;
  assert.equal(edu.description, "Description FR");
}

// (h) fr positioning falls back to English description (and warns) when descriptionFr is missing
{
  const profileWithEdu: ProfileDoc = {
    ...profile,
    experience: [],
    education: [{ id: "edu_phd", degree: "PhD", school: "Some University", endDate: "2024", description: "EN description", tags: [] }],
  };
  const positioning: PositioningDoc = { ...positioningWith({}), language: "fr" };
  const warnings: string[] = [];
  const originalWarn = console.warn;
  console.warn = (msg: string) => warnings.push(msg);
  let result;
  try {
    result = assemble(profileWithEdu, positioning);
  } finally {
    console.warn = originalWarn;
  }
  const edu = result.education.find((e) => e.id === "edu_phd")!;
  assert.equal(edu.description, "EN description");
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /edu_phd/);
}

// (i) education entries without a description resolve to undefined, no warning
{
  const profileWithEdu: ProfileDoc = {
    ...profile,
    experience: [],
    education: [{ id: "edu_bac", degree: "Bac", school: "Lycee", endDate: "2009", tags: [] }],
  };
  const positioning: PositioningDoc = { ...positioningWith({}), language: "fr" };
  const warnings: string[] = [];
  const originalWarn = console.warn;
  console.warn = (msg: string) => warnings.push(msg);
  let result;
  try {
    result = assemble(profileWithEdu, positioning);
  } finally {
    console.warn = originalWarn;
  }
  const edu = result.education.find((e) => e.id === "edu_bac")!;
  assert.equal(edu.description, undefined);
  assert.equal(warnings.length, 0);
}

// (j) contact.age is computed from personal.dateOfBirth, undefined when absent
{
  const result = assemble(profile, positioningWith({}));
  assert.equal(result.contact.age, undefined);

  const today = new Date();
  const bornExactlyNYearsAgoToday = new Date(Date.UTC(today.getUTCFullYear() - 40, today.getUTCMonth(), today.getUTCDate()));
  const dob = bornExactlyNYearsAgoToday.toISOString().slice(0, 10);
  const profileWithDob: ProfileDoc = { ...profile, personal: { ...profile.personal, dateOfBirth: dob } };
  const resultWithDob = assemble(profileWithDob, positioningWith({}));
  assert.equal(resultWithDob.contact.age, 40);

  // Birthday is tomorrow: hasn't happened yet this year, so age is one less.
  const tomorrow = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + 1));
  const notYetBirthdayDob = new Date(Date.UTC(tomorrow.getUTCFullYear() - 40, tomorrow.getUTCMonth(), tomorrow.getUTCDate()))
    .toISOString()
    .slice(0, 10);
  const profileNotYetBirthday: ProfileDoc = { ...profile, personal: { ...profile.personal, dateOfBirth: notYetBirthdayDob } };
  assert.equal(assemble(profileNotYetBirthday, positioningWith({})).contact.age, 39);
}

// (k) contact.address is a single formatted line from personal.address, undefined when absent/empty
{
  const result = assemble(profile, positioningWith({}));
  assert.equal(result.contact.address, undefined);

  const profileWithAddress: ProfileDoc = {
    ...profile,
    personal: {
      ...profile.personal,
      address: { street: "Lot 56, Bd Moulay Ismail", postalCode: "20290", city: "Casablanca", country: "Morocco" },
    },
  };
  const resultWithAddress = assemble(profileWithAddress, positioningWith({}));
  assert.equal(resultWithAddress.contact.address, "Lot 56, Bd Moulay Ismail, 20290 Casablanca, Morocco");

  const profileWithEmptyAddress: ProfileDoc = { ...profile, personal: { ...profile.personal, address: {} } };
  assert.equal(assemble(profileWithEmptyAddress, positioningWith({})).contact.address, undefined);
}

console.log("assemble.test.ts: all assertions passed");
