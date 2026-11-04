# Repository rules

- The `/blog` page gets its posts from the `substack-posts` backend function, never from a browser call to Substack: Substack's JSON API sends no cross-origin headers, so a direct fetch is blocked by the browser. Only Substack's `/embed` widget may be placed in an iframe — individual post pages refuse to be framed.
