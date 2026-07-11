import type { Db } from "mongodb";
import type { ProfileDoc } from "@/lib/cv-data";

/**
 * Single source of truth for the app's one profile document: the _id every
 * read/write filters on, and the shared lookup that used to be independently
 * re-derived (`db.collection("profile").findOne({ _id: "jalal_chafiq" })`)
 * in every route/script that reads it. Writes that only need the _id as a
 * filter (not the document itself) should import PROFILE_ID directly.
 */

export const PROFILE_ID = "jalal_chafiq" as const;

export async function getProfile(db: Db): Promise<ProfileDoc> {
  const profile = await db.collection<ProfileDoc>("profile").findOne({ _id: PROFILE_ID });
  if (!profile) {
    throw new Error(`Profile document not found (_id: "${PROFILE_ID}").`);
  }
  return profile;
}
