import { describe, expect, it } from "vitest";
import {
  SUBSTACK_URL,
  formatPostDate,
  normalizePosts,
  readTimeFromWordcount,
} from "@/lib/blogFeed";

describe("readTimeFromWordcount", () => {
  it("rounds a short post to one minute", () => {
    expect(readTimeFromWordcount(195)).toBe("1 min read");
  });

  it("scales longer posts at 200 words per minute", () => {
    expect(readTimeFromWordcount(1200)).toBe("6 min read");
  });

  it("hides the read time when no word count is recorded", () => {
    expect(readTimeFromWordcount(0)).toBeNull();
  });
});

describe("formatPostDate", () => {
  it("renders a Substack timestamp as a long date", () => {
    expect(formatPostDate("2026-11-02T05:04:37.420Z")).toBe("November 2, 2026");
  });

  it("returns an empty string for missing or unreadable dates", () => {
    expect(formatPostDate(null)).toBe("");
    expect(formatPostDate("not-a-date")).toBe("");
  });
});

describe("normalizePosts", () => {
  it("keeps shaped posts from the backend function", () => {
    const [post] = normalizePosts([
      {
        id: 223080029,
        title: "Open Thread 458",
        subtitle: "A weekly discussion.",
        url: "https://baylakeinsights.substack.com/p/open-thread-458",
        date: "2026-11-02T05:04:37.420Z",
        cover: "https://substack-post-media.s3.amazonaws.com/public/images/a.png",
        wordcount: 195,
        tags: ["Discussion"],
      },
    ]);
    expect(post.title).toBe("Open Thread 458");
    expect(post.url).toBe("https://baylakeinsights.substack.com/p/open-thread-458");
    expect(post.tags).toEqual(["Discussion"]);
  });

  it("builds a post link from the slug when only raw Substack fields arrive", () => {
    const [post] = normalizePosts([
      { title: "Crowd Report", slug: "crowd-report", post_date: "2026-10-09T12:00:00.000Z" },
    ]);
    expect(post.url).toBe(`${SUBSTACK_URL}/p/crowd-report`);
    expect(post.date).toBe("2026-10-09T12:00:00.000Z");
    expect(post.cover).toBeNull();
    expect(post.wordcount).toBe(0);
  });

  it("drops entries with no title and non-array payloads", () => {
    expect(normalizePosts([{ subtitle: "no title here" }, null, 7])).toEqual([]);
    expect(normalizePosts(undefined)).toEqual([]);
  });
});
