export function eventMatchesInterests(
  ev: { category: string; tags: string[] },
  u: { categories: string[]; tags: string[] },
): boolean {
  if (u.categories.includes(ev.category)) return true;
  const userTags = u.tags.map((t) => t.toLowerCase());
  return ev.tags.some((t) => userTags.includes(t.toLowerCase()));
}
