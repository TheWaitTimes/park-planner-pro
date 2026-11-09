import { useEffect, useState } from "react";
import { Loader2, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  SOCIAL_PLATFORMS,
  normalizeSocialUrl,
  type SocialLinks,
  type SocialPlatform,
} from "@/lib/socialLinks";

/** Admin-only editor for the footer's social links (X, Instagram, TikTok, YouTube). */
export default function SocialLinksAdmin() {
  const { toast } = useToast();
  const [links, setLinks] = useState<SocialLinks>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    supabase
      .from("social_links")
      .select("platform,url,sort_order")
      .order("sort_order")
      .then(({ data, error }) => {
        setLoading(false);
        if (error || !data) {
          toast({ title: "Couldn't load social links", description: error?.message ?? "Please try again." });
          return;
        }
        const next: SocialLinks = {};
        for (const row of data) next[row.platform as SocialPlatform] = row.url;
        setLinks(next);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async () => {
    setSaving(true);
    const payload = SOCIAL_PLATFORMS.map((platform, i) => ({
      platform: platform.id,
      url: normalizeSocialUrl(links[platform.id] ?? "", platform.id),
      sort_order: i + 1,
    }));
    const { error } = await supabase.from("social_links").upsert(payload, { onConflict: "platform" });
    setSaving(false);
    if (error) {
      toast({ title: "Couldn't save links", description: error.message });
      return;
    }
    setDirty(false);
    toast({
      title: "Social links saved",
      description: "The footer updates for everyone on their next visit.",
    });
  };

  return (
    <section className="mt-6 rounded-lg border border-border bg-card p-5">
      <div className="flex items-start gap-3">
        <Share2 className="h-5 w-5 text-secondary mt-0.5" />
        <div>
          <h2 className="font-display text-lg font-semibold text-foreground">Social media links</h2>
          <p className="font-body text-sm text-muted-foreground">
            Paste the full page for each account. Only the ones you fill in show up in the footer.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="mt-5 flex items-center gap-2 text-sm font-body text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading links…
        </div>
      ) : (
        <>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {SOCIAL_PLATFORMS.map((platform) => {
              const value = links[platform.id] ?? "";
              const saved = normalizeSocialUrl(value, platform.id);
              return (
                <label key={platform.id} className="block">
                  <span className="font-body text-sm font-medium text-foreground">{platform.label}</span>
                  <Input
                    value={value}
                    onChange={(e) => {
                      setLinks((prev) => ({ ...prev, [platform.id]: e.target.value }));
                      setDirty(true);
                    }}
                    placeholder="full link or just your handle"
                    className="mt-1.5 bg-background font-body"
                  />
                  <span className="mt-1 block font-body text-xs text-muted-foreground">
                    {saved ? (
                      <a
                        href={saved}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-secondary hover:underline"
                      >
                        Live: {saved}
                      </a>
                    ) : (
                      "Not set — hidden from the footer"
                    )}
                  </span>
                </label>
              );
            })}
          </div>

          <div className="mt-5 flex items-center gap-3">
            <Button onClick={save} disabled={saving || !dirty} className="min-h-[44px]">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save social links"}
            </Button>
            {dirty && !saving && (
              <span className="font-body text-sm text-muted-foreground">Unsaved changes</span>
            )}
          </div>
        </>
      )}
    </section>
  );
}
