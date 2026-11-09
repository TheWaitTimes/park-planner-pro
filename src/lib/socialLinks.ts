import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type SocialPlatform = "twitter" | "instagram" | "tiktok" | "youtube";

export const SOCIAL_PLATFORMS: { id: SocialPlatform; label: string }[] = [
  { id: "twitter", label: "X (Twitter)" },
  { id: "instagram", label: "Instagram" },
  { id: "tiktok", label: "TikTok" },
  { id: "youtube", label: "YouTube" },
];

export type SocialLinks = Partial<Record<SocialPlatform, string>>;

/** Where a bare handle like "@baylakeinsights" actually lives on each platform. */
const HANDLE_URL: Record<SocialPlatform, (handle: string) => string> = {
  twitter: (h) => `https://x.com/${h}`,
  instagram: (h) => `https://instagram.com/${h}`,
  tiktok: (h) => `https://tiktok.com/@${h}`,
  youtube: (h) => `https://youtube.com/@${h}`,
};

/**
 * Make a pasted handle or URL clickable: adds https:// to an address like
 * "instagram.com/baylakeinsights", or builds the page for a bare handle like
 * "@baylakeinsights" when the platform is known.
 */
export function normalizeSocialUrl(input: string, platform?: SocialPlatform): string {
  const trimmed = (input ?? "").trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.includes("/")) return `https://${trimmed.replace(/^\/+/, "")}`;
  const handle = trimmed.replace(/^@+/, "");
  if (!handle) return "";
  if (platform) return HANDLE_URL[platform](handle);
  return `https://${handle}`;
}

/** Platforms that actually have a link, kept in footer order. */
export function visibleSocialLinks(links: SocialLinks) {
  return SOCIAL_PLATFORMS.filter((p) => (links[p.id] ?? "").trim() !== "");
}

/** Social links as stored by an admin; empty or missing links are left out. */
export function useSocialLinks() {
  const [links, setLinks] = useState<SocialLinks>({});

  useEffect(() => {
    let active = true;
    supabase
      .from("social_links")
      .select("platform,url,sort_order")
      .order("sort_order")
      .then(({ data }) => {
        if (!active || !data) return;
        const next: SocialLinks = {};
        for (const row of data) next[row.platform as SocialPlatform] = row.url;
        setLinks(next);
      });
    return () => {
      active = false;
    };
  }, []);

  return links;
}
