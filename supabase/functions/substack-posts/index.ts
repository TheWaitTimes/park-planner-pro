// Serves the latest posts from the Bay Lake Insights Substack publication.
// Substack's own JSON API sends no cross-origin headers, so the browser cannot
// call it directly — this function fetches it server-side and trims the payload.

const SUBSTACK_BASE = "https://baylakeinsights.substack.com";
const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 24;
const FETCH_TIMEOUT_MS = 12_000;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=60",
    },
  });
}

interface RawPost {
  id?: number;
  title?: string;
  subtitle?: string;
  slug?: string;
  canonical_url?: string;
  post_date?: string;
  updated_at?: string;
  cover_image?: string | null;
  wordcount?: number;
  postTags?: { name?: string }[];
}

function shapePost(post: RawPost) {
  return {
    id: post.id ?? post.slug ?? post.title ?? "",
    title: post.title ?? "Untitled",
    subtitle: post.subtitle ?? post.description ?? "",
    url: post.canonical_url ?? `${SUBSTACK_BASE}/p/${post.slug ?? ""}`,
    date: post.post_date ?? post.updated_at ?? null,
    cover: post.cover_image ?? null,
    wordcount: post.wordcount ?? 0,
    tags: (post.postTags ?? []).map((tag) => tag?.name).filter((name): name is string => !!name),
  };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  const url = new URL(request.url);
  const requested = Number(url.searchParams.get("limit"));
  const limit =
    Number.isFinite(requested) && requested > 0
      ? Math.min(Math.floor(requested), MAX_LIMIT)
      : DEFAULT_LIMIT;

  try {
    const upstream = await fetch(`${SUBSTACK_BASE}/api/v1/posts?limit=${limit}`, {
      headers: {
        Accept: "application/json",
        "User-Agent": "BayLakeInsights-website (https://park-planner-hub.lovable.app)",
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (!upstream.ok) {
      return jsonResponse({ error: `Substack responded with ${upstream.status}` }, 502);
    }

    const payload = await upstream.json();
    const posts = Array.isArray(payload?.posts) ? payload.posts.map(shapePost) : [];

    return jsonResponse({ posts, fetchedAt: new Date().toISOString() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not reach Substack";
    return jsonResponse({ error: message }, 502);
  }
});
