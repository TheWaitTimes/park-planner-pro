import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const read = (p: string) => readFileSync(path.resolve(process.cwd(), p), "utf8");

const indexPage = read("src/pages/Index.tsx");
const app = read("src/App.tsx");

describe("Blog tab in the navigation", () => {
  it("lists Blog as a menu tab with its own icon", () => {
    expect(indexPage).toMatch(/\{ id: "blog", label: "Blog", icon: Newspaper \},/);
  });

  it("renders the Substack feed when the Blog tab is active", () => {
    expect(indexPage).toMatch(/activeTab === "blog" && <BlogFeedContent \/>/);
  });

  it("gives the phone menu one column per tab so Blog is not squeezed out", () => {
    const tabCount = (indexPage.match(/^\s*\{ id: "/gm) ?? []).length;
    expect(tabCount).toBe(9);
    expect(indexPage).toMatch(new RegExp(`grid grid-cols-${tabCount}`));
  });

  it("keeps /blog opening on the Blog tab", () => {
    expect(app).toMatch(/<Route path="\/blog" element=\{<Index initialTab="blog" \/> \} \/>/);
  });
});
