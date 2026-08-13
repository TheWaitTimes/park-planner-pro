# Mobile-First Polish

Goal: make the app comfortable to use on a phone (360-430px wide) without changing any simulator, optimizer, or ranking logic. All work stays in layout and presentation code.

## Header and navigation
- Shrink the logo and title block on small screens; keep the wordmark on one line.
- The five tabs currently sit in a fixed row and get cramped. Make the tab strip horizontally scrollable with snap alignment and hidden scrollbar, so tabs stay full-size and swipeable.
- Move the account area (email, admin badge, sign in/out) to icon-only on mobile; email text stays hidden below `md`.
- Reduce header padding and page gutters from `px-6 py-10` to tighter mobile values that scale up at `sm`/`md`.

## Home
- Weather stat trio and wait-time cards: single column on mobile, stacked with tighter spacing.
- Park hours grid: single column on phones, two columns from `sm`.
- Longest/shortest wait lists: allow ride names to truncate instead of pushing the wait value off-screen.

## Day Simulator
- Stat tiles: 2-up on mobile is fine but reduce number/label sizes so values don't wrap.
- Ride list rows: stack name and wait/action into a vertical layout under `sm`; make action buttons full-width tap targets (min 44px height).
- Sliders, park pickers, and action modals: full-width controls, larger touch targets, modals sized to viewport with internal scrolling.
- Activity timeline: compress to a single-column list with smaller time gutter.

## Day Optimizer
- The main `lg:grid-cols-[1fr_360px]` split already collapses; add mobile ordering so the results/report panel appears after the builder.
- Slot builder cards and the ride pickers: single column, larger checkboxes/buttons.
- Charts: give the bar charts a min-height and let long ride labels truncate; wrap the stacked chart in a horizontal scroll container so bars stay readable rather than squashed.
- Time budget and per-slot summary: stack to one column below `sm`.

## Rankings
- Matchup layout (`1fr auto 1fr`) becomes a vertical stack on mobile with the "vs" divider between the two option cards.
- Leaderboard table: wrap in a horizontally scrollable container and hide the least important column on phones so the core rank/name/score stays visible.

## Blog
- Post list and editor form: single column; editor textarea gets a taller mobile height and full-width action buttons.

## Global
- Add a small set of responsive utility defaults in the design system (container gutters, section spacing) so pages share consistent mobile padding.
- Ensure `index.html` viewport meta is present and correct.
- Verify no fixed pixel widths cause horizontal page scroll.

## Verification
Drive the preview with Playwright at 390x844 and 430x932, screenshot each tab, and confirm no horizontal overflow and no clipped controls before reporting done.

## Technical notes
- Tailwind responsive prefixes only; no new dependencies.
- No changes to `parkModel.ts`, `simulationReducer.ts`, `rankings.ts`, or any backend code.
- Colors continue to come from existing semantic tokens.
