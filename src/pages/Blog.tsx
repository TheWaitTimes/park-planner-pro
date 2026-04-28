import { useEffect, useMemo, useState } from "react";
import { Plus, Eye, Send, Pencil, Trash2, ArrowLeft, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";

type PostStatus = "draft" | "published";

interface BlogPost {
  id: number;
  title: string;
  excerpt: string;
  body: string;
  date: string;
  category: string;
  readTime: string;
  status: PostStatus;
}

const SEED_POSTS: BlogPost[] = [
  {
    id: 1,
    title: "Top 10 Rides to FastPass at Magic Kingdom",
    excerpt:
      "Maximize your day at Magic Kingdom by targeting these high-demand attractions with your Lightning Lane selections.",
    body: "Maximize your day at Magic Kingdom by targeting these high-demand attractions with your Lightning Lane selections. Our data shows the average wait differential between LL and standby is most pronounced on Seven Dwarfs Mine Train, Tron Lightcycle Run, and Space Mountain.",
    date: "April 10, 2026",
    category: "Strategy",
    readTime: "5 min read",
    status: "published",
  },
  {
    id: 2,
    title: "EPCOT Food & Wine Festival: A Data-Driven Guide",
    excerpt:
      "We crunched the numbers on wait times, booth ratings, and crowd levels to find the best times to visit each booth.",
    body: "We crunched the numbers on wait times, booth ratings, and crowd levels to find the best times to visit each booth.",
    date: "April 5, 2026",
    category: "Events",
    readTime: "8 min read",
    status: "published",
  },
  {
    id: 3,
    title: "Is Park Hopping Worth It? The Numbers Say...",
    excerpt:
      "We simulated 1,000 park days to compare single-park vs park-hopping strategies. The results may surprise you.",
    body: "We simulated 1,000 park days to compare single-park vs park-hopping strategies. The results may surprise you.",
    date: "March 28, 2026",
    category: "Analysis",
    readTime: "6 min read",
    status: "published",
  },
];

const CATEGORIES = ["Strategy", "Events", "Analysis", "News", "Guide"];

const CATEGORY_COLORS: Record<string, string> = {
  Strategy: "bg-park-magic",
  Events: "bg-park-epcot",
  Analysis: "bg-secondary",
  News: "bg-primary",
  Guide: "bg-park-animal",
};

const STORAGE_KEY = "msi_blog_posts_v1";

const formatToday = () =>
  new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

const estimateReadTime = (text: string) => {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.round(words / 200));
  return `${minutes} min read`;
};

type View = "list" | "edit" | "preview";

interface Draft {
  id: number | null;
  title: string;
  excerpt: string;
  body: string;
  category: string;
}

const EMPTY_DRAFT: Draft = {
  id: null,
  title: "",
  excerpt: "",
  body: "",
  category: "Strategy",
};

export default function Blog() {
  const [posts, setPosts] = useState<BlogPost[]>(() => {
    if (typeof window === "undefined") return SEED_POSTS;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw) as BlogPost[];
    } catch {
      /* ignore */
    }
    return SEED_POSTS;
  });
  const [view, setView] = useState<View>("list");
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(posts));
    } catch {
      /* ignore */
    }
  }, [posts]);

  const sortedPosts = useMemo(
    () =>
      [...posts].sort((a, b) => {
        if (a.status !== b.status) return a.status === "draft" ? -1 : 1;
        return b.id - a.id;
      }),
    [posts],
  );

  const startNew = () => {
    setDraft(EMPTY_DRAFT);
    setView("edit");
  };

  const startEdit = (post: BlogPost) => {
    setDraft({
      id: post.id,
      title: post.title,
      excerpt: post.excerpt,
      body: post.body,
      category: post.category,
    });
    setView("edit");
  };

  const validate = () => {
    if (!draft.title.trim()) {
      toast({ title: "Title required", description: "Please enter a post title." });
      return false;
    }
    if (!draft.body.trim()) {
      toast({ title: "Body required", description: "Please write some content." });
      return false;
    }
    return true;
  };

  const upsertPost = (status: PostStatus) => {
    if (!validate()) return null;
    const excerpt = draft.excerpt.trim() || draft.body.trim().slice(0, 180);
    const readTime = estimateReadTime(draft.body);
    let savedId = draft.id;
    setPosts((prev) => {
      if (draft.id !== null) {
        return prev.map((p) =>
          p.id === draft.id
            ? {
                ...p,
                title: draft.title.trim(),
                excerpt,
                body: draft.body.trim(),
                category: draft.category,
                readTime,
                status,
                date: status === "published" && p.status !== "published" ? formatToday() : p.date,
              }
            : p,
        );
      }
      const newId = (prev.reduce((m, p) => Math.max(m, p.id), 0) || 0) + 1;
      savedId = newId;
      return [
        ...prev,
        {
          id: newId,
          title: draft.title.trim(),
          excerpt,
          body: draft.body.trim(),
          category: draft.category,
          readTime,
          date: formatToday(),
          status,
        },
      ];
    });
    setDraft((d) => ({ ...d, id: savedId }));
    return savedId;
  };

  const handleSaveDraft = () => {
    if (upsertPost("draft") !== null) {
      toast({ title: "Draft saved", description: "Your draft is stored locally." });
      setView("list");
    }
  };

  const handlePublish = () => {
    if (upsertPost("published") !== null) {
      toast({ title: "Post published", description: "Your post is now live in the blog." });
      setView("list");
    }
  };

  const handleDelete = (id: number) => {
    setPosts((prev) => prev.filter((p) => p.id !== id));
    toast({ title: "Post deleted" });
  };

  const previewPost: BlogPost = {
    id: draft.id ?? 0,
    title: draft.title || "Untitled post",
    excerpt: draft.excerpt || draft.body.slice(0, 180),
    body: draft.body,
    date: formatToday(),
    category: draft.category,
    readTime: estimateReadTime(draft.body),
    status: "draft",
  };

  if (view === "edit") {
    return (
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => setView("list")}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground font-body mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to posts
        </button>
        <h1 className="text-2xl md:text-3xl text-foreground mb-1 font-semibold tracking-tight">
          {draft.id ? "Edit post" : "New post"}
        </h1>
        <p className="text-muted-foreground font-body text-sm mb-6">
          Compose your post, preview it, then save as draft or publish.
        </p>

        <div className="bg-card border border-border rounded-lg p-6 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="title" className="font-body">Title</Label>
            <Input
              id="title"
              value={draft.title}
              maxLength={140}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder="A clear, specific headline"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2 md:col-span-1">
              <Label className="font-body">Category</Label>
              <Select
                value={draft.category}
                onValueChange={(v) => setDraft({ ...draft, category: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="excerpt" className="font-body">
                Excerpt <span className="text-muted-foreground text-xs">(optional)</span>
              </Label>
              <Input
                id="excerpt"
                value={draft.excerpt}
                maxLength={240}
                onChange={(e) => setDraft({ ...draft, excerpt: e.target.value })}
                placeholder="One-sentence summary shown on the blog list"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="body" className="font-body">Body</Label>
            <Textarea
              id="body"
              value={draft.body}
              onChange={(e) => setDraft({ ...draft, body: e.target.value })}
              placeholder="Write your post here. Plain text — line breaks are preserved."
              className="min-h-[260px] font-body leading-relaxed"
              maxLength={20000}
            />
            <div className="text-xs text-muted-foreground font-body flex justify-between">
              <span>{estimateReadTime(draft.body)}</span>
              <span>{draft.body.trim().split(/\s+/).filter(Boolean).length} words</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
            <Button variant="outline" onClick={() => setView("preview")}>
              <Eye className="w-4 h-4" /> Preview
            </Button>
            <Button variant="secondary" onClick={handleSaveDraft}>
              Save draft
            </Button>
            <Button onClick={handlePublish}>
              <Send className="w-4 h-4" /> Publish
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (view === "preview") {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setView("edit")}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground font-body"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to editor
          </button>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={handleSaveDraft}>Save draft</Button>
            <Button size="sm" onClick={handlePublish}>
              <Send className="w-4 h-4" /> Publish
            </Button>
          </div>
        </div>
        <div className="text-xs uppercase tracking-wide font-body font-semibold text-muted-foreground mb-2">
          Preview
        </div>
        <article className="bg-card border border-border rounded-lg p-8">
          <div className="flex items-center gap-3 mb-4">
            <span
              className={`${CATEGORY_COLORS[previewPost.category] || "bg-muted"} text-white font-body text-[11px] font-semibold uppercase tracking-wide px-2.5 py-1 rounded`}
            >
              {previewPost.category}
            </span>
            <span className="text-muted-foreground text-sm font-body">{previewPost.date}</span>
            <span className="text-muted-foreground text-sm font-body">· {previewPost.readTime}</span>
          </div>
          <h1 className="font-display text-3xl md:text-4xl font-semibold text-foreground mb-4 tracking-tight">
            {previewPost.title}
          </h1>
          <p className="font-body text-lg text-muted-foreground mb-6 leading-relaxed">
            {previewPost.excerpt}
          </p>
          <div className="font-body text-foreground leading-relaxed whitespace-pre-wrap">
            {previewPost.body}
          </div>
        </article>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-start justify-between mb-2 gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl text-foreground mb-2 font-semibold tracking-tight">Blog</h1>
          <p className="text-muted-foreground font-body text-base max-w-2xl">
            Data-driven insights, tips, and stories from Central Florida's theme parks.
          </p>
        </div>
        <Button onClick={startNew} className="shrink-0">
          <Plus className="w-4 h-4" /> New post
        </Button>
      </div>

      <div className="space-y-5 mt-8">
        {sortedPosts.length === 0 && (
          <div className="text-center py-16 border border-dashed border-border rounded-lg bg-muted/30">
            <FileText className="w-6 h-6 mx-auto text-muted-foreground mb-2" />
            <p className="font-display text-base font-semibold text-foreground">No posts yet</p>
            <p className="text-muted-foreground font-body text-sm mt-1">Click "New post" to write your first one.</p>
          </div>
        )}
        {sortedPosts.map((post) => (
          <article
            key={post.id}
            className="bg-card border border-border rounded-lg p-6 hover:border-secondary/40 hover:shadow-sm transition-all"
          >
            <div className="flex items-center gap-3 mb-3 flex-wrap">
              <span
                className={`${CATEGORY_COLORS[post.category] || "bg-muted"} text-white font-body text-[11px] font-semibold uppercase tracking-wide px-2.5 py-1 rounded`}
              >
                {post.category}
              </span>
              {post.status === "draft" && (
                <span className="border border-border text-foreground/70 font-body text-[11px] font-semibold uppercase tracking-wide px-2.5 py-1 rounded">
                  Draft
                </span>
              )}
              <span className="text-muted-foreground text-sm font-body">{post.date}</span>
              <span className="text-muted-foreground text-sm font-body">· {post.readTime}</span>
              <div className="ml-auto flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => startEdit(post)}>
                  <Pencil className="w-4 h-4" /> Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(post.id)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <h2 className="font-display text-xl md:text-2xl font-semibold text-foreground mb-2 tracking-tight">
              {post.title}
            </h2>
            <p className="text-muted-foreground font-body leading-relaxed">{post.excerpt}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
