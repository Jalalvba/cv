/**
 * Standalone connectivity test — run via `pnpm run test:google`.
 *
 * Verifies the Google service account configured in GOOGLE_SERVICE_ACCOUNT_KEY_B64
 * can (a) list files in a specific Drive folder and (b) write + read back a cell
 * in a specific spreadsheet. Never logs credential content — only metadata
 * (service account email, file counts/names, booleans).
 */
import { google, sheets_v4 } from "googleapis";
import type { Auth } from "googleapis";
import { getGoogleAuth } from "../lib/google";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name} environment variable. Set it in .env.local.`);
  }
  return value;
}

const DRIVE_FOLDER_ID = requireEnv("GOOGLE_DRIVE_TEST_FOLDER_ID");
const SPREADSHEET_ID = requireEnv("GOOGLE_SHEETS_TEST_SPREADSHEET_ID");
const SHEET_GID = 0;

function errorMessage(err: unknown): string {
  if (err && typeof err === "object" && "response" in err) {
    const response = (err as { response?: { data?: unknown } }).response;
    if (response?.data) return JSON.stringify(response.data);
  }
  return err instanceof Error ? err.message : String(err);
}

function isPermissionError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const anyErr = err as { code?: number; status?: number; message?: string };
  if (anyErr.code === 403 || anyErr.status === 403) return true;
  return typeof anyErr.message === "string" && /permission/i.test(anyErr.message);
}

/** Re-derives just the client_email for diagnostics — never logs the private key. */
function getServiceAccountEmail(): string | undefined {
  const keyB64 = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_B64;
  if (!keyB64) return undefined;
  try {
    const decoded = JSON.parse(Buffer.from(keyB64, "base64").toString("utf8"));
    return typeof decoded.client_email === "string" ? decoded.client_email : undefined;
  } catch {
    return undefined;
  }
}

function printPermissionReminder(resourceUrl: string, requiredAccess: string) {
  const email = getServiceAccountEmail();
  console.log(
    `  Reminder: the service account${email ? ` (${email})` : ""} must be manually granted ${requiredAccess} on ${resourceUrl} in the Google Drive/Sheets UI first — this script cannot grant itself access.`,
  );
}

async function testDrive(auth: Auth.GoogleAuth): Promise<boolean> {
  console.log("\n=== Drive test: list files in folder ===");
  try {
    const drive = google.drive({ version: "v3", auth });
    const res = await drive.files.list({
      q: `'${DRIVE_FOLDER_ID}' in parents and trashed = false`,
      fields: "files(id, name)",
      pageSize: 100,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    const files = res.data.files ?? [];
    console.log(`PASS: found ${files.length} file(s)`);
    for (const f of files) console.log(`  - ${f.name}`);
    return true;
  } catch (err) {
    console.log(`FAIL: ${errorMessage(err)}`);
    if (isPermissionError(err)) {
      printPermissionReminder(`https://drive.google.com/drive/folders/${DRIVE_FOLDER_ID}`, "at least Viewer access");
    }
    return false;
  }
}

async function resolveSheetTitle(sheets: sheets_v4.Sheets, sheetId: number): Promise<string> {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const sheet = meta.data.sheets?.find((s) => s.properties?.sheetId === sheetId);
  if (!sheet?.properties?.title) {
    throw new Error(`Could not find a sheet with gid=${sheetId} in this spreadsheet`);
  }
  return sheet.properties.title;
}

async function testSheets(auth: Auth.GoogleAuth): Promise<boolean> {
  console.log("\n=== Sheets test: write + read back A1 ===");
  const sheetUrl = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit?gid=${SHEET_GID}`;
  try {
    const sheets = google.sheets({ version: "v4", auth });
    const title = await resolveSheetTitle(sheets, SHEET_GID);
    const range = `${title}!A1`;

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range,
      valueInputOption: "RAW",
      requestBody: { values: [["ok"]] },
    });

    const readBack = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range });
    const value = readBack.data.values?.[0]?.[0];

    if (value === "ok") {
      console.log(`PASS: wrote "ok" to ${range} and read it back successfully`);
      return true;
    }
    console.log(`FAIL: wrote "ok" but read back ${JSON.stringify(value)} instead of "ok"`);
    return false;
  } catch (err) {
    console.log(`FAIL: ${errorMessage(err)}`);
    if (isPermissionError(err)) {
      printPermissionReminder(sheetUrl, "Editor access");
    }
    return false;
  }
}

async function main() {
  console.log("=== Google service account connectivity test ===");

  let auth: Auth.GoogleAuth;
  try {
    auth = getGoogleAuth();
  } catch (err) {
    console.log(`\nFAIL: could not construct the Google auth client — ${errorMessage(err)}`);
    console.log("\n=== Summary ===");
    console.log("Drive access:      FAIL (no usable credentials)");
    console.log("Sheets read/write: FAIL (no usable credentials)");
    process.exitCode = 1;
    return;
  }

  const driveOk = await testDrive(auth);
  const sheetsOk = await testSheets(auth);

  console.log("\n=== Summary ===");
  console.log(`Drive access:      ${driveOk ? "PASS" : "FAIL"}`);
  console.log(`Sheets read/write: ${sheetsOk ? "PASS" : "FAIL"}`);

  if (!driveOk || !sheetsOk) process.exitCode = 1;
}

main().catch((err) => {
  console.error("Unexpected error:", errorMessage(err));
  process.exitCode = 1;
});
