import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ArrowUpRight,
  Mail,
  Newspaper,
  RefreshCw,
  Rss,
  TriangleAlert,
} from "lucide-react";
import bayLakeLogo from "@/assets/bay-lake-logo.png.asset.json";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { cachedFetch, TTL_30_MIN } from "@/lib/liveCache";
import {
  SUBSTACK_EMBED_URL,
  SUBSTACK_NAME,
  SUBSTACK_URL,
  formatPostDate,
  normalizePosts,
  readTimeFromWordcount,
  type BlogPost,
} from "@/lib/blogFeed";

const CACHE_KEY = "substack-posts";
const SKELETONS = [0, 1, 2, 3, 4, 5];

type Status = "loading" | "ready" | "error";

interface FeedResult {
  posts: BlogPost[];
  fetchedAt: string | null;
}

async function loadFeed(): Promise<FeedResult> {
  const { data, error } = await supabase.functions.invoke("substack-posts");
  if (error) {
    const context = (error as { context?: Response }).context;
    let detail = "";
    try {
      if (context) {
        const body = (await context.json()) as { error?: string };
        detail = body?.error ?? "";
      }
    } catch {
      // the function answered without a readable body — fall back to the generic message
    }
    throw new Error(detail || "Could not load posts from Substack.");
  }
  const payload = data as { posts?: unknown; fetchedAt?: string } | null;
  return {
    posts: normalizePosts(payload?.posts),
    fetchedAt: typeof payload?.fetchedAt === "string" ? payload.fetchedAt : null,
  };
}

function PostCard({ post }: { post: BlogPost }) {
  const readTime = readTimeFromWordcount(post.wordcount);
  const date = formatPostDate(post.date);
  const tag = post.tags[0];

  return (
    <a
      href={post.url}
      target="_blank"
      rel="noreferrer"
      className="group flex flex-col overflow-hidden rounded-lg border border-border bg-card transition-all hover:border-secondary/50 hover:shadow-md"
    >
      <div className="relative aspect-[16/9] overflow-hidden bg-muted">
        {post.cover ? (
          <img
            src={post.cover}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-primary/5">
            <img
              src={bayLakeLogo.url}
              alt=""
              width={2000}
              height={2000}
              className="h-20 w-20 object-contain opacity-25"
            />
          </div>
        )}
        {tag && (
          <span className="absolute left-3 top-3 rounded bg-secondary px-2.5 py-1 font-body text-[11px] font-semibold uppercase tracking-wide text-secondary-foreground">
            {tag}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-5">
        <div className="flex flex-wrap items-center gap-x-2 font-body text-xs text-muted-foreground">
          {date && <span>{date}</span>}
          {date && readTime && <span aria-hidden="true">·</span>}
          {readTime && <span>{readTime}</span>}
        </div>
        <h3 className="font-display text-lg font-semibold leading-snug text-foreground group-hover:text-secondary">
          {post.title}
        </h3>
        {post.subtitle && (
          <p className="line-clamp-3 font-body text-sm leading-relaxed text-muted-foreground">
            {post.subtitle}
          </p>
        )}
        <span className="mt-auto inline-flex items-center gap-1.5 pt-3 font-body text-sm font-medium text-secondary">
          Read on Substack
          <ArrowUpRight className="h-4 w-4" />
        </span>
      </div>
    </a>
  );
}

function SkeletonCard() {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="aspect-[16/9] animate-pulse bg-muted" />
      <div className="space-y-3 p-5">
        <div className="h-3 w-24 animate-pulse rounded bg-muted" />
        <div className="h-5 w-full animate-pulse rounded bg-muted" />
        <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}

function SubscribePanel() {
  return (
    <section className="mt-12 rounded-lg border border-border bg-card p-6">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary/10">
          <Mail className="h-4 w-4 text-secondary" />
        </div>
        <div>
          <h2 className="font-display text-lg font-semibold text-foreground">
            Get every post by email
          </h2>
          <p className="mt-1 font-body text-sm text-muted-foreground">
            Subscribe to {SUBSTACK_NAME} on Substack and new posts arrive in your inbox the
            moment they go live.
          </p>
        </div>
      </div>
      <iframe
        src={SUBSTACK_EMBED_URL}
        title={`${SUBSTACK_NAME} on Substack`}
        frameBorder={0}
        scrolling="no"
        loading="lazy"
        className="mt-5 h-[320px] w-full max-w-[480px] rounded-lg border border-border bg-card"
      />
    </section>
  );
}

export default function BlogFeed() {
  const [status, setStatus] = useState<Status>("loading");
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    const previous = document.title;
    document.title = `Blog | ${SUBSTACK_NAME}`;
    return () => {
      document.title = previous;
    };
  }, []);

  const load = useCallback(async (force = false) => {
    setStatus("loading");
    setProblem(null);
    try {
      const result = await cachedFetch<FeedResult>(CACHE_KEY, TTL_30_MIN, loadFeed, force);
      setPosts(result.posts);
      setFetchedAt(result.fetchedAt);
      setStatus("ready");
    } catch (err) {
      setProblem(err instanceof Error ? err.message : "Could not load posts.");
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    void load(false);
  }, [load]);

  const updatedLabel = (() => {
    if (!fetchedAt) return null;
    const date = new Date(fetchedAt);
    if (Number.isNaN(date.getTime())) return null;
    return `Updated ${date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
  })();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="bg-header border-b border-header-foreground/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 gap-4 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <img
              src={bayLakeLogo.url}
              alt="Bay Lake Insights Co. logo"
              width={2000}
              height={2000}
              className="h-20 w-20 object-contain shrink-0"
            />
            <h1 className="font-display text-base sm:text-xl text-header-foreground font-semibold">
              Bay Lake Insights Co.
            </h1>
          </div>
          <Link
            to="/"
            className="shrink-0 text-header-foreground/70 hover:text-header-foreground text-sm font-body inline-flex items-center gap-1.5"
          >
            <ArrowLeft className="w-4 h-4" /> Back to site
          </Link>
        </div>
      </header>

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-secondary">
              <Rss className="h-4 w-4" />
              <span className="font-body text-xs font-semibold uppercase tracking-wide">
                {SUBSTACK_NAME} on Substack
              </span>
            </div>
            <h2 className="mt-2 font-display text-3xl md:text-4xl font-semibold tracking-tight text-foreground">
              Blog
            </h2>
            <p className="mt-2 max-w-2xl font-body text-base text-muted-foreground">
              Data-driven writing on Central Florida's theme parks, straight from the newsletter.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {updatedLabel && status === "ready" && (
              <span className="font-body text-xs text-muted-foreground">{updatedLabel}</span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => void load(true)}
              disabled={status === "loading"}
              className="shrink-0"
            >
              <RefreshCw className="h-4 w-4" /> Refresh
            </Button>
          </div>
        </div>

        <div className="mt-8">
          {status === "loading" && (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {SKELETONS.map((key) => (
                <SkeletonCard key={key} />
              ))}
            </div>
          )}

          {status === "error" && (
            <div className="rounded-lg border border-border bg-card p-8 text-center">
              <TriangleAlert className="mx-auto mb-2 h-6 w-6 text-destructive" />
              <p className="font-display text-base font-semibold text-foreground">
                Posts aren't loading right now
              </p>
              <p className="mt-1 font-body text-sm text-muted-foreground">{problem}</p>
              <Button className="mt-4" onClick={() => void load(true)}>
                <RefreshCw className="h-4 w-4" /> Try again
              </Button>
            </div>
          )}

          {status === "ready" && posts.length === 0 && (
            <div className="rounded-lg border border-dashed border-border bg-muted/30 p-10 text-center">
              <Newspaper className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
              <p className="font-display text-base font-semibold text-foreground">No posts yet</p>
              <p className="mt-1 font-body text-sm text-muted-foreground">
                {SUBSTACK_NAME} hasn't published anything yet. Subscribe below and you'll get the
                first one the moment it's out.
              </p>
            </div>
          )}

          {status === "ready" && posts.length > 0 && (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {posts.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>
          )}
        </div>

        <SubscribePanel />

        <p className="mt-8 font-body text-xs text-muted-foreground">
          Posts come from{" "}
          <a
            className="font-medium text-primary underline"
            href={SUBSTACK_URL}
            target="_blank"
            rel="noreferrer"
          >
            {SUBSTACK_NAME} on Substack
          </a>
          . This page refreshes every 30 minutes.
        </p>
      </main>

      <footer className="border-t border-border text-muted-foreground text-center py-6 font-body text-sm mt-12">
        Bay Lake Insights Co. © 2026
      </footer>
    </div>
  );
}
