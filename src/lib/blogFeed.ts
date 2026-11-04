// Shared helpers for the Substack-powered blog page.

export const SUBSTACK_URL = "https://baylakeinsights.substack.com";
export const SUBSTACK_EMBED_URL = `${SUBSTACK_URL}/embed`;
export const SUBSTACK_NAME = "Bay Lake Insights";
export const WORDS_PER_MINUTE = 200;

export interface BlogPost {
  id: string | number;
  title: string;
  subtitle: string;
  url: string;
  date: string | null;
  cover: string | null;
  wordcount: number;
  tags: string[];
}

export function readTimeFromWordcount(wordcount: number): string | null {
  if (!Number.isFinite(wordcount) || wordcount <= 0) return null;
  const minutes = Math.max(1, Math.round(wordcount / WORDS_PER_MINUTE));
  return `${minutes} min read`;
}

export function formatPostDate(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Substack authors often leave the subtitle as a bare placeholder such as "..." —
 * keep only excerpts that actually carry words so cards don't show junk.
 */
function cleanExcerpt(value: unknown): string {
  const text = typeof value === "string" ? value.trim() : "";
  return /[a-z]/i.test(text) ? text : "";
}

/**
 * Accepts either the shaped posts from the backend function or raw Substack
 * records, and drops anything unusable so one bad entry can't break the grid.
 */
export function normalizePosts(raw: unknown): BlogPost[] {
  if (!Array.isArray(raw)) return [];
  const posts: BlogPost[] = [];

  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const item = entry as Record<string, unknown>;
    const title = typeof item.title === "string" ? item.title.trim() : "";
    if (!title) continue;

    const slug = typeof item.slug === "string" ? item.slug : "";
    const canonical = typeof item.canonical_url === "string" ? item.canonical_url : "";
    const url =
      (typeof item.url === "string" && item.url) ||
      canonical ||
      (slug ? `${SUBSTACK_URL}/p/${slug}` : SUBSTACK_URL);

    posts.push({
      id: (item.id as string | number) ?? slug ?? title,
      title,
      subtitle: cleanExcerpt(item.subtitle),
      url,
      date:
        (typeof item.date === "string" && item.date) ||
        (typeof item.post_date === "string" && item.post_date) ||
        null,
      cover: typeof item.cover === "string" ? item.cover : (typeof item.cover_image === "string" ? item.cover_image : null),
      wordcount: Number(item.wordcount ?? 0) || 0,
      tags: Array.isArray(item.tags)
        ? (item.tags as unknown[]).filter((tag): tag is string => typeof tag === "string")
        : [],
    });
  }

  return posts;
}
