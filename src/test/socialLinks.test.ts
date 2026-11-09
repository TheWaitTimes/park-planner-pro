import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { normalizeSocialUrl, visibleSocialLinks } from "@/lib/socialLinks";

const read = (p: string) => readFileSync(path.resolve(process.cwd(), p), "utf8");

describe("normalizeSocialUrl", () => {
  it("adds https:// to a pasted address", () => {
    expect(normalizeSocialUrl("instagram.com/baylakeinsights", "instagram")).toBe(
      "https://instagram.com/baylakeinsights",
    );
    expect(normalizeSocialUrl("x.com/baylakeinsights", "twitter")).toBe(
      "https://x.com/baylakeinsights",
    );
  });

  it("turns a bare handle into that platform's page", () => {
    expect(normalizeSocialUrl("baylakeinsights", "instagram")).toBe(
      "https://instagram.com/baylakeinsights",
    );
    expect(normalizeSocialUrl("@baylakeinsights", "tiktok")).toBe(
      "https://tiktok.com/@baylakeinsights",
    );
    expect(normalizeSocialUrl("baylakeinsights", "youtube")).toBe(
      "https://youtube.com/@baylakeinsights",
    );
    expect(normalizeSocialUrl("baylakeinsights", "twitter")).toBe("https://x.com/baylakeinsights");
  });

  it("leaves a full address alone and trims stray spaces", () => {
    expect(normalizeSocialUrl("  https://tiktok.com/@baylakeinsights  ", "tiktok")).toBe(
      "https://tiktok.com/@baylakeinsights",
    );
    expect(normalizeSocialUrl("http://youtube.com/@baylakeinsights", "youtube")).toBe(
      "http://youtube.com/@baylakeinsights",
    );
  });

  it("returns an empty string when nothing useful was typed", () => {
    expect(normalizeSocialUrl("", "instagram")).toBe("");
    expect(normalizeSocialUrl("   ", "tiktok")).toBe("");
    expect(normalizeSocialUrl("@@@", "twitter")).toBe("");
  });

  it("still prefixes https:// when no platform is given", () => {
    expect(normalizeSocialUrl("baylakeinsights")).toBe("https://baylakeinsights");
  });
});

describe("visibleSocialLinks", () => {
  it("keeps only platforms with a link, in footer order", () => {
    const shown = visibleSocialLinks({
      youtube: "https://youtube.com/@baylakeinsights",
      twitter: "https://x.com/baylakeinsights",
      instagram: "",
      tiktok: "   ",
    });
    expect(shown.map((p) => p.id)).toEqual(["twitter", "youtube"]);
  });

  it("shows nothing before any link is saved", () => {
    expect(visibleSocialLinks({})).toEqual([]);
    expect(visibleSocialLinks({ twitter: "", instagram: "", tiktok: "", youtube: "" })).toEqual([]);
  });
});

describe("social links wiring", () => {
  it("puts the icon row in the site footer", () => {
    expect(read("src/pages/Index.tsx")).toMatch(/<SocialLinks \/>/);
  });

  it("gives admins an editor on the My Pro page", () => {
    expect(read("src/pages/ProDashboard.tsx")).toMatch(/\{isAdmin && <SocialLinksAdmin \/>\}/);
  });
});
