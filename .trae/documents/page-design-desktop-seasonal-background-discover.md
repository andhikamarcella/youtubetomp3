# Page Design (Desktop-first)

## Global Styles (All Pages)
- Layout system: CSS Grid for overall page scaffolding; Flexbox inside components.
- Breakpoints: Desktop-first; add tablet/mobile stacking at narrower widths.
- Design tokens:
  - Background: `--bg: #070A12` (dark base behind animations)
  - Surface: `--surface: rgba(255,255,255,0.06)`
  - Text: `--text: #EEF2FF`, muted `--text-muted: rgba(238,242,255,0.72)`
  - Accent: `--accent: #7C3AED` (seasonal accent can override)
  - Radius: 12px; shadow: subtle + blurred
  - Typography: 12/14/16/20/28/40 scale; headings use tighter letter spacing
- Motion:
  - Default transitions: 200–350ms ease-out
  - Reduced motion: disable continuous animations; keep only opacity fades
  - Performance guard: cap active animated layers; prefer opacity/transform over layout

---

## 1) Home Page (`/`)
### Meta Information
- Title: “Home — Seasonal Experience”
- Description: “Seasonal animated background with today’s Hijri-aware theme and trending items.”
- Open Graph: title/description + representative seasonal image

### Page Structure
- Full-bleed animated background layer (behind content)
- Centered content column (max-width ~1100–1200px)
- Stacked sections: Top Nav → Hero/Theme → Trending Now → Footer

### Sections & Components
1. Top Navigation Bar
   - Left: product name/logo
   - Right: links: “Discover”
   - Style: translucent surface with blur; sticky on scroll
2. Seasonal Background Stage
   - Layers: base gradient + 1–2 lightweight animated layers (e.g., particles, soft waves)
   - Theme switch: crossfade between theme containers; pre-load assets before swap
   - Status: subtle “Theme updated” toast when theme changes (optional, non-blocking)
3. Hijri Context Badge
   - Small pill showing Hijri date text (from cached server fetch)
   - Tooltip: “Cached for 24h” (informational)
4. Trending Now Module
   - Card grid (3 columns desktop)
   - Each card: title, short description, optional image
   - States: skeleton loading; empty state; error retry button
   - Interaction: clicking opens `/discover/{slug}`
5. Footer
   - Minimal links and attribution text

---

## 2) Discover Page (`/discover`)
### Meta Information
- Title: “Discover — Search”
- Description: “Search and browse results; pages are shareable via URL parameters.”
- Open Graph: generic discover image

### Page Structure
- Two-column desktop layout:
  - Left: search + optional facets (collapsible)
  - Right: results list

### Sections & Components
1. Search Bar
   - Input + submit button
   - URL sync: updates `?q=` (and pagination params) for shareability
   - Debounce: light debounce for type-ahead feel (avoid aggressive network)
2. Results Header
   - Shows query text and result count (if available)
   - Small “cached” indicator when served from Redis
3. Results List
   - Vertical list of cards; each row: title + snippet + updated date (if available)
   - Click opens `/discover/{slug}`
4. Pagination
   - Next/Prev controls; keep in URL

---

## 3) Discover Detail Page (`/discover/{slug}`)
### Meta Information
- Title: “{Item Title} — Discover”
- Description: “{Item Summary}”
- Open Graph: item image when available; fallback otherwise
- Canonical: `/discover/{slug}`

### Page Structure
- Content header → main article/content → related links
- Wide reading layout: max-width ~860–920px for text

### Sections & Components
1. Breadcrumbs
   - Home → Discover → Current
2. Title Block
   - Title, optional subtitle/description, optional cover image
3. Main Content
   - Render structured content with clear typography
   - Loading should be minimal due to pre-rendering; show fallback skeleton only for edge cases
4. Related Links
   - Link back to Discover (preserve last query when possible)
   - Optional “Trending Now” mini list
5. Not Found State
   - Clear