export function slugify(text: string): string {
  return (
    text
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "cv"
  );
}

export function makeId(): string {
  return Math.random().toString(36).slice(2, 10);
}
