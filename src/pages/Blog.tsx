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
      <h1 className="text-5xl text-foreground mb-2">Blog</h1>
      <p className="text-muted-foreground font-body text-lg mb-8">
        Data-driven insights, tips, and stories from Central Florida's theme parks.
      </p>

      <div className="space-y-6">
        {BLOG_POSTS.map((post) => (
          <article
            key={post.id}
            className="bg-card border border-border rounded-xl p-6 hover:shadow-lg transition-shadow cursor-pointer"
          >
            <div className="flex items-center gap-3 mb-3">
              <span className={`${CATEGORY_COLORS[post.category] || "bg-muted"} text-card font-body text-xs font-bold px-3 py-1 rounded-full`}>
                {post.category}
              </span>
              <span className="text-muted-foreground text-sm font-body">{post.date}</span>
              <span className="text-muted-foreground text-sm font-body">· {post.readTime}</span>
            </div>
            <h2 className="font-display text-3xl text-foreground mb-2 hover:text-secondary transition-colors">
              {post.title}
            </h2>
            <p className="text-muted-foreground font-body leading-relaxed">{post.excerpt}</p>
          </article>
        ))}
      </div>

      <div className="mt-12 text-center py-8 border-2 border-dashed border-border rounded-xl">
        <p className="font-display text-2xl text-muted-foreground">More posts coming soon! ✨</p>
        <p className="text-muted-foreground font-body mt-2">Check back for new data-driven theme park content.</p>
      </div>
    </div>
  );
}
