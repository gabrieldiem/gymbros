# CLAUDE.md: web

React 19 + TypeScript (strict) + Vite single-page app, mobile-first and installable as a PWA. In production it is built to static files and served by nginx, which also proxies `/api` to the api container.

The prototype at `docs/prototype/index.html` is the UX and copy reference. Port screens from it, but use the **calm** visual system in `docs/DESIGN.md`. Bring over the behaviour, not the inline-template code.

## Commands

```bash
npm ci
npm run dev          # Vite on :5173, proxies /api to localhost:8080
npm run build        # tsc --noEmit && vite build → dist/
npm run test         # vitest run
npm run lint         # eslint + prettier --check
npm run e2e          # playwright test (needs the dev stack running)
```

## Stack

- Routing: React Router. The five tabs are `/climb`, `/crew`, `/train`, `/quests`, `/me`.
- Server state: TanStack Query. Every API call goes through `src/api/` (a typed client plus one hook per endpoint). Components never call `fetch` directly.
- Live feel: `refetchInterval` on standings, feed and notifications (20 s while the tab is visible).
- Styling: plain CSS with the custom properties from `src/styles/tokens.css` and CSS Modules per component. No UI kit, no Tailwind.
- Fonts: Barlow Condensed (display numbers, headings) and Barlow (everything else).
- PWA: manifest plus a service worker that caches the app shell (`vite-plugin-pwa`).
- Testing: Vitest + Testing Library for components and hooks, Playwright for e2e smoke and screenshots at 390×844 and 1440×900.

## i18n

- `src/i18n/en.ts` and `src/i18n/es.ts` export the same keys (type-checked: `es` must satisfy `typeof en`). `t(key, vars)` formats numbers with `es-ES` / `en-US`.
- **Every user-visible string goes through `t()`.** No hard-coded copy in components.
- The API sends keys plus variables (score line items, feed events, notifications). Render them with `t()`.
- Spanish uses classic English gym terms, the way people talk at the gym: *push day, pull day, leg day, sets, reps, PR, 1RM, spotter*, and every exercise name in English (Bench press, Back squat, Deadlift, RDL…). The surrounding sentence stays Spanish: "Nuevo PR: Back squat 137.5 kg × 5", "12 sets completados". See `docs/PRODUCT.md` → i18n.
- The default language comes from `navigator.language`. The user can switch it in the top bar and in settings, and the choice is stored on the user profile.

## Rules

- Mobile first: design at 390 px wide, then scale up. A desktop width (≥960 px) gets a side rail instead of the bottom nav.
- Nothing may overflow horizontally at 390 px. The e2e smoke test asserts `scrollWidth === 390`.
- Touch targets are ≥44 px, focus is visible, and `prefers-reduced-motion` is respected.
- Components stay small and presentational. Data fetching lives in the hooks in `src/api/`.
- Every data screen uses `QueryState` (or `LoadingBlock` / `ErrorBlock`) so loading, empty and error states are consistent.
- Don't recompute game rules in the client. Show what the API returns. Optimistic UI is fine for reactions and comments, never for points.
- After any UI change, take a Playwright screenshot at 390×844 and look at it before committing.
