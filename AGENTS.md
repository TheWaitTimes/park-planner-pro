# Repository rules

- The `/blog` page gets its posts from the `substack-posts` backend function, never from a browser call to Substack: Substack's JSON API sends no cross-origin headers, so a direct fetch is blocked by the browser. Only Substack's `/embed` widget may be placed in an iframe — individual post pages refuse to be framed.
- Pro access is checked live against Stripe by the `check-subscription` function (active monthly/yearly subscription, or a succeeded payment tagged `plan=lifetime`); there is no subscriptions table or webhook. Price IDs live in `supabase/functions/_shared/stripe-plans.ts`.
