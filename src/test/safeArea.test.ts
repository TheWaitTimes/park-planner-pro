import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const read = (p: string) => readFileSync(path.resolve(process.cwd(), p), "utf8");

const css = read("src/index.css");
const indexHtml = read("index.html");
const indexPage = read("src/pages/Index.tsx");

describe("iPhone notch / home-indicator safe areas", () => {
  it("opts into the full viewport so env(safe-area-inset-*) resolves", () => {
    expect(indexHtml).toMatch(/viewport-fit=cover/);
    expect(indexHtml).toMatch(/width=device-width/);
  });

  it("pads the bottom tab bar by the home-indicator inset", () => {
    const rule = css.match(/\.bottom-nav-safe\s*\{[^}]*\}/)?.[0] ?? "";
    expect(rule).toMatch(/env\(safe-area-inset-bottom/);
    expect(rule).toMatch(/max\(/);
  });

  it("reserves bar height plus inset so content is never overlapped", () => {
    const pb = css.match(/\.pb-bottom-nav\s*\{[^}]*\}/)?.[0] ?? "";
    expect(pb).toMatch(/calc\(/);
    expect(pb).toMatch(/3\.5rem/);
    expect(pb).toMatch(/env\(safe-area-inset-bottom/);

    const mb = css.match(/\.mb-bottom-nav\s*\{[^}]*\}/)?.[0] ?? "";
    expect(mb).toMatch(/env\(safe-area-inset-bottom/);
  });

  it("applies the safe-area classes to the mobile bottom nav and page content", () => {
    expect(indexPage).toMatch(/fixed bottom-0[^"`]*bottom-nav-safe/);
    expect(indexPage).toMatch(/pb-bottom-nav/);
    // bar is mobile-only; desktop keeps the top tab strip
    expect(indexPage).toMatch(/md:hidden fixed bottom-0/);
    expect(indexPage).toMatch(/hidden md:block/);
  });

  it("keeps bottom nav tap targets at least 56px tall", () => {
    expect(indexPage).toMatch(/min-h-\[56px\]/);
  });
});
