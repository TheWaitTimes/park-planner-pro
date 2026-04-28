import { useEffect, useMemo, useState } from "react";
import { Plus, Eye, Send, Pencil, Trash2, ArrowLeft, FileText, LogIn } from "lucide-react";
import { Link } from "react-router-dom";
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
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type PostStatus = "draft" | "published";

interface BlogPost {
  id: string;
  title: string;
  excerpt: string;
  body: string;
  category: string;
  status: PostStatus;
  read_time: string;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  author_id: string | null;
}

const CATEGORIES = ["Strategy", "Events", "Analysis", "News", "Guide"];

const CATEGORY_COLORS: Record<string, string> = {
  Strategy: "bg-park-magic",
  Events: "bg-park-epcot",
  Analysis: "bg-secondary",
  News: "bg-primary",
  Guide: "bg-park-animal",
};

const formatDate = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "Unpublished";

const estimateReadTime = (text: string) => {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.round(words / 200));
  return `${minutes} min read`;
};

type View = "list" | "edit" | "preview";

interface Draft {
  id: string | null;
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
  const { isAdmin, user } = useAuth();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>("list");
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadPosts();
    // Reload when admin status changes (so admins see drafts)
  }, [isAdmin]);

  const loadPosts = async () => {
    setLoading(true);
    const query = supabase
      .from("posts")
      .select("*")
      .order("status", { ascending: true }) // draft before published
      .order("published_at", { ascending: false, nullsFirst: true })
      .order("created_at", { ascending: false });
    const { data, error } = await query;
    if (error) {
      toast({ title: "Could not load posts", description: error.message });
      setPosts([]);
    } else {
      setPosts((data ?? []) as BlogPost[]);
    }
    setLoading(false);
  };

  const sortedPosts = useMemo(
    () =>
      [...posts].sort((a, b) => {
        if (a.status !== b.status) return a.status === "draft" ? -1 : 1;
        const aDate = a.published_at ?? a.created_at;
        const bDate = b.published_at ?? b.created_at;
        return new Date(bDate).getTime() - new Date(aDate).getTime();
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

  const upsertPost = async (status: PostStatus) => {
    if (!validate() || !user) return false;
    setSaving(true);
    const excerpt = draft.excerpt.trim() || draft.body.trim().slice(0, 180);
    const read_time = estimateReadTime(draft.body);
    const payload = {
      title: draft.title.trim(),
      excerpt,
      body: draft.body.trim(),
      category: draft.category,
      status,
      read_time,
    };

    let error: { message: string } | null = null;
    if (draft.id) {
      const existing = posts.find((p) => p.id === draft.id);
      const becomingPublished = status === "published" && existing?.status !== "published";
      const { error: updErr } = await supabase
        .from("posts")
        .update({
          ...payload,
          ...(becomingPublished ? { published_at: new Date().toISOString() } : {}),
        })
        .eq("id", draft.id);
      error = updErr;
    } else {
      const { error: insErr } = await supabase.from("posts").insert({
        ...payload,
        author_id: user.id,
        published_at: status === "published" ? new Date().toISOString() : null,
      });
      error = insErr;
    }

    setSaving(false);
    if (error) {
      toast({ title: "Save failed", description: error.message });
      return false;
    }
    await loadPosts();
    return true;
  };

  const handleSaveDraft = async () => {
    if (await upsertPost("draft")) {
      toast({ title: "Draft saved" });
      setView("list");
    }
  };

  const handlePublish = async () => {
    if (await upsertPost("published")) {
      toast({ title: "Post published", description: "Your post is now live." });
      setView("list");
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("posts").delete().eq("id", id);
    if (error) {
      toast({ title: "Delete failed", description: error.message });
      return;
    }
    toast({ title: "Post deleted" });
    setPosts((prev) => prev.filter((p) => p.id !== id));
  };

  const previewPost = {
    title: draft.title || "Untitled post",
    excerpt: draft.excerpt || draft.body.slice(0, 180),
    body: draft.body,
    category: draft.category,
    read_time: estimateReadTime(draft.body),
    published_at: new Date().toISOString(),
  };

  // ---- Editor view ----
  if (view === "edit" && isAdmin) {
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
            <Button variant="outline" onClick={() => setView("preview")} disabled={saving}>
              <Eye className="w-4 h-4" /> Preview
            </Button>
            <Button variant="secondary" onClick={handleSaveDraft} disabled={saving}>
              Save draft
            </Button>
            <Button onClick={handlePublish} disabled={saving}>
              <Send className="w-4 h-4" /> Publish
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ---- Preview view ----
  if (view === "preview" && isAdmin) {
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
            <Button variant="secondary" size="sm" onClick={handleSaveDraft} disabled={saving}>Save draft</Button>
            <Button size="sm" onClick={handlePublish} disabled={saving}>
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
            <span className="text-muted-foreground text-sm font-body">{formatDate(previewPost.published_at)}</span>
            <span className="text-muted-foreground text-sm font-body">· {previewPost.read_time}</span>
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

  // ---- List view ----
  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-start justify-between mb-2 gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl text-foreground mb-2 font-semibold tracking-tight">Blog</h1>
          <p className="text-muted-foreground font-body text-base max-w-2xl">
            Data-driven insights, tips, and stories from Central Florida's theme parks.
          </p>
        </div>
        {isAdmin && (
          <Button onClick={startNew} className="shrink-0">
            <Plus className="w-4 h-4" /> New post
          </Button>
        )}
      </div>

      <div className="space-y-5 mt-8">
        {loading && (
          <div className="text-center py-12 text-muted-foreground font-body text-sm">
            Loading posts...
          </div>
        )}

        {!loading && sortedPosts.length === 0 && (
          <div className="text-center py-16 border border-dashed border-border rounded-lg bg-muted/30">
            <FileText className="w-6 h-6 mx-auto text-muted-foreground mb-2" />
            <p className="font-display text-base font-semibold text-foreground">No posts yet</p>
            <p className="text-muted-foreground font-body text-sm mt-1">
              {isAdmin
                ? 'Click "New post" to write your first one.'
                : "Check back soon for data-driven theme park content."}
            </p>
            {!isAdmin && (
              <Link
                to="/login"
                className="inline-flex items-center gap-1.5 text-secondary hover:underline font-body text-sm mt-4"
              >
                <LogIn className="w-4 h-4" /> Admin sign in
              </Link>
            )}
          </div>
        )}

        {!loading &&
          sortedPosts.map((post) => (
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
                <span className="text-muted-foreground text-sm font-body">
                  {formatDate(post.status === "published" ? post.published_at : post.created_at)}
                </span>
                <span className="text-muted-foreground text-sm font-body">· {post.read_time}</span>
                {isAdmin && (
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
                )}
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
