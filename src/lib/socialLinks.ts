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

/**
 * Make a pasted handle or URL clickable: trims it and adds https:// when the
 * admin typed a bare address like "instagram.com/baylakeinsights".
 */
export function normalizeSocialUrl(input: string): string {
  const trimmed = (input ?? "").trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed.replace(/^\/+/, "")}`;
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
