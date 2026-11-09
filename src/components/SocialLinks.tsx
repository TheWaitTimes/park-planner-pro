import { FaXTwitter, FaInstagram, FaTiktok, FaYoutube } from "react-icons/fa6";
import { useSocialLinks, visibleSocialLinks, type SocialPlatform } from "@/lib/socialLinks";

const ICONS: Record<SocialPlatform, typeof FaXTwitter> = {
  twitter: FaXTwitter,
  instagram: FaInstagram,
  tiktok: FaTiktok,
  youtube: FaYoutube,
};

/** Footer row of social icons. Only platforms with a saved link are shown. */
export default function SocialLinks() {
  const links = useSocialLinks();
  const shown = visibleSocialLinks(links);

  if (shown.length === 0) return null;

  return (
    <nav aria-label="Social media" className="flex items-center justify-center gap-3">
      {shown.map((platform) => {
        const Icon = ICONS[platform.id];
        return (
          <a
            key={platform.id}
            href={links[platform.id]}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={platform.label}
            title={platform.label}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-foreground/80 transition-colors hover:bg-secondary hover:text-secondary-foreground"
          >
            <Icon className="h-5 w-5" aria-hidden="true" />
          </a>
        );
      })}
    </nav>
  );
}
