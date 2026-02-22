## 1. Product Overview
A Next.js web experience with a seasonal animated background that adapts using Hijri calendar context (24h cached), plus SEO-friendly “Trending Now” and `/discover/{slug}` pages.
It prioritizes smooth, lightweight motion, fast navigation, and cached data fetching for consistent performance.

## 2. Core Features

### 2.1 Feature Module
Our requirements consist of the following main pages:
1. **Home**: seasonal animated background, Hijri-aware theme selection (cached), “Trending Now” content block.
2. **Discover**: search UI, Redis-cached search results, result list linking to detail pages.
3. **Discover Detail** (`/discover/{slug}`): SEO metadata, pre-rendered content page, internal links back to Discover.

### 2.3 Page Details
| Page Name | Module Name | Feature description |
|-----------|-------------|------------------|
| Home | Seasonal Background Engine | Render animated background with: detect current “seasonal theme” based on current date and Hijri context; run lightweight animations (no heavy video); maintain stable FPS by lowering motion under load; respect reduced-motion setting. |
| Home | Smooth Theme Transitions | Crossfade or morph between themes on date change (and on route navigation) with no visible flash; pre-load next theme assets before switching. |
| Home | Hijri Date Fetch + 24h Cache | Fetch Hijri data once per 24h (per day + timezone); use cached response when available; fall back to last-known cached value when the Hijri API is unavailable. |
| Home | Trending Now | Display a curated/trending list; show loading, empty, and error states; link each item to `/discover/{slug}` when applicable. |
| Discover | Search Experience | Allow entering a query; show results list with basic snippet/title; keep the URL in sync with query for shareable links. |
| Discover | Redis-cached Results | Cache search responses keyed by normalized query parameters; return cached results fast; set TTL and invalidate/refresh when needed. |
| Discover Detail | SEO Page Rendering | Render a stable canonical page for a given slug; include title/description; generate OpenGraph data; ensure predictable URL and metadata for crawlers. |
| Discover Detail | Pre-rendering | Pre-render the most important slugs and revalidate periodically; gracefully handle unknown slugs with a consistent not-found experience. |
| Discover Detail | Content Layout | Display primary content; include related links (e.g., back to Discover, optionally to Trending items) to keep crawl depth low. |

## 3. Core Process
**Visitor Flow**
1. You land on **Home** and immediately see a seasonal animated background.
2. The app loads Hijri context (using the cached value when available) and applies the correct theme; transitions happen smoothly.
3. You scan **Trending Now** items and select one.
4. You arrive at **Discover Detail** (`/discover/{slug}`), which is pre-rendered for fast first paint and SEO.
5. If you want to explore more, you go to **Discover**, search, and open more detail pages.

```mermaid
graph TD
  A["Home"] --> B["Discover"]
  A --> C["Discover Detail (/discover/{slug})"]
  B --> C
  C