import type { ZodIssueLike } from "@/lib/zod-issues";

/** Renders a zod validation issue list identically wherever a paste-JSON tool needs to show one. */
export function ZodIssuesList({ issues }: { issues: ZodIssueLike[] }) {
  if (issues.length === 0) return null;
  return (
    <ul className="mt-2 list-disc pl-4">
      {issues.map((issue, i) => (
        <li key={i}>
          <code>{issue.path || "(root)"}</code>: {issue.message}
        </li>
      ))}
    </ul>
  );
}
