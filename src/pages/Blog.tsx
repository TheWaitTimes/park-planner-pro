const BLOG_POSTS = [
  {
    id: 1,
    title: "Top 10 Rides to FastPass at Magic Kingdom",
    excerpt: "Maximize your day at Magic Kingdom by targeting these high-demand attractions with your Lightning Lane selections.",
    date: "April 10, 2026",
    category: "Strategy",
    readTime: "5 min read",
  },
  {
    id: 2,
    title: "EPCOT Food & Wine Festival: A Data-Driven Guide",
    excerpt: "We crunched the numbers on wait times, booth ratings, and crowd levels to find the best times to visit each booth.",
    date: "April 5, 2026",
    category: "Events",
    readTime: "8 min read",
  },
  {
    id: 3,
    title: "Is Park Hopping Worth It? The Numbers Say...",
    excerpt: "We simulated 1,000 park days to compare single-park vs park-hopping strategies. The results may surprise you.",
    date: "March 28, 2026",
    category: "Analysis",
    readTime: "6 min read",
  },
];

const CATEGORY_COLORS: Record<string, string> = {
  Strategy: "bg-park-magic",
  Events: "bg-park-epcot",
  Analysis: "bg-secondary",
};

export default function Blog() {
  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl md:text-4xl text-foreground mb-2 font-semibold tracking-tight">Blog</h1>
      <p className="text-muted-foreground font-body text-base mb-8 max-w-2xl">
        Data-driven insights, tips, and stories from Central Florida's theme parks.
      </p>

      <div className="space-y-5">
        {BLOG_POSTS.map((post) => (
          <article
            key={post.id}
            className="bg-card border border-border rounded-lg p-6 hover:border-secondary/40 hover:shadow-sm transition-all cursor-pointer"
          >
            <div className="flex items-center gap-3 mb-3">
              <span className={`${CATEGORY_COLORS[post.category] || "bg-muted"} text-white font-body text-[11px] font-semibold uppercase tracking-wide px-2.5 py-1 rounded`}>
                {post.category}
              </span>
              <span className="text-muted-foreground text-sm font-body">{post.date}</span>
              <span className="text-muted-foreground text-sm font-body">· {post.readTime}</span>
            </div>
            <h2 className="font-display text-xl md:text-2xl font-semibold text-foreground mb-2 hover:text-secondary transition-colors tracking-tight">
              {post.title}
            </h2>
            <p className="text-muted-foreground font-body leading-relaxed">{post.excerpt}</p>
          </article>
        ))}
      </div>

      <div className="mt-12 text-center py-10 border border-dashed border-border rounded-lg bg-muted/30">
        <p className="font-display text-base font-semibold text-foreground">More posts coming soon</p>
        <p className="text-muted-foreground font-body text-sm mt-1">Check back for new data-driven theme park content.</p>
      </div>
    </div>
  );
}
