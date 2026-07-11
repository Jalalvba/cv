/**
 * Standalone pipeline verification script — run via `pnpm run test:cv-pipeline`.
 *
 * Fetches the profile and every positioning from MongoDB, runs assemble()
 * on each pair, and validates the result against cvDataSchema. Prints a
 * PASS/FAIL per positioning with resolved bullet counts per role.
 */
import { getDb } from "../lib/db";
import { assemble } from "../lib/assemble";
import { cvDataSchema } from "../lib/validation";
import { getProfile, PROFILE_ID } from "../lib/profile";
import type { PositioningDoc } from "../lib/cv-data";

async function main() {
  console.log("=== MongoDB -> CV pipeline verification ===");

  const db = await getDb();
  let profile;
  try {
    profile = await getProfile(db);
  } catch {
    console.log(`FAIL: no profile document found (_id: "${PROFILE_ID}")`);
    process.exitCode = 1;
    return;
  }
  console.log(`Loaded profile "${profile._id}" (${profile.experience.length} experience entries)`);

  const positionings = await db.collection<PositioningDoc>("positionings").find({}).toArray();
  console.log(`Found ${positionings.length} positioning document(s)\n`);

  if (positionings.length === 0) {
    console.log("FAIL: no positioning documents found");
    process.exitCode = 1;
    return;
  }

  let allPassed = true;

  for (const positioning of positionings) {
    console.log(`--- ${positioning._id} ---`);
    try {
      const cvData = assemble(profile, positioning);
      const result = cvDataSchema.safeParse(cvData);

      const bulletCounts = cvData.experience
        .map((exp) => `${exp.id}: ${exp.bullets.length}`)
        .join(", ");
      console.log(`  bullet counts per role: ${bulletCounts || "(none)"}`);

      if (result.success) {
        console.log(`  PASS: assembled CV data is valid`);
      } else {
        allPassed = false;
        console.log(`  FAIL: schema validation errors:`);
        for (const issue of result.error.issues) {
          console.log(`    - ${issue.path.join(".")}: ${issue.message}`);
        }
      }
    } catch (err) {
      allPassed = false;
      console.log(`  FAIL: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.log("\n=== Summary ===");
  console.log(`${positionings.length} positioning(s) checked, ${allPassed ? "all PASS" : "at least one FAIL"}`);

  if (!allPassed) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error("Unexpected error:", err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  })
  .finally(() => process.exit());
