# Release Checklist & Deployment Guide

## Validation evidence (2026-10-20, branch `claude/friendly-galileo-fvo0r1`)

| Gate | Command | Result |
| --- | --- | --- |
| Lint | `npm run lint` | 0 errors, 0 warnings |
| Type check | `npm run typecheck` | passed (TypeScript strict) |
| Unit + integration | `npm run test` | **62 / 62 passed** (8 files) |
| Production build | `npm run build` | passed — 18 routes (13 static pages, 2 API routes, manifest, robots, not-found) |
| End-to-end (Playwright, desktop 1440×900 + mobile 390×844) | `npm run test:e2e` | **30 passed, 4 skipped** (desktop-only checks skipped on mobile by design) |
| Offline | e2e `offline.spec.ts` | simulator, copilot and demo work with the network disabled after first load |
| Live-provider failure | e2e | USGS / Open-Meteo failures shown as UNAVAILABLE; mocked success shown as LIVE |
| Horizontal overflow | e2e + screenshots | 0 px at 360, 390, 1440 and 1920 widths on key pages |
| Console errors | e2e | none on the homepage, simulator or demo (blocked live requests excluded) |
| Production dependency audit | `npm audit --omit=dev` | **0 vulnerabilities** (PostCSS pinned to 8.5.31 via `overrides`) |

### Lighthouse (measured)
Lighthouse 12.8.2, default mobile preset (simulated 4× CPU throttling, slow 4G), local `next start`, live APIs unreachable:

| Page | Performance | Accessibility | Best practices | SEO |
| --- | --- | --- | --- | --- |
| `/` | 74 | 96 | 96 | 100 |
| `/mission-control` | 79 | 97 | 93 | 100 |
| `/simulator` | 62 | 97 | 96 | 100 |
| `/demo` | 73 | 100 | 96 | 100 |
| `/sos` (earlier run) | 94 | 96 | 96 | 100 |

Performance is limited by main-thread simulation and routing. Moving the engine to a web worker is the next optimisation.

### Known dev-only advisories
`npm audit` (including dev dependencies) reports advisories in `vitest@3` (tinypool, @vitest/mocker) and `braces` via `eslint-config-next`. These are not shipped to users. `vitest@4` could not be installed because of an npm 10 resolver bug; retry with a newer npm.

## Pre-release checks
- [x] No `.env` or secrets tracked (`.gitignore` covers `.env*` except `.env.example`)
- [x] API keys read server-side only (`DASHSCOPE_API_KEY` in `/api/copilot`)
- [x] Security headers (CSP, frame-ancestors none, nosniff, referrer, permissions policy)
- [x] Demo-safety labels on every page; SOS states that nothing is sent
- [x] README reflects actual capabilities
- [ ] Owner chooses a licence (none added — all rights reserved until chosen)
- [ ] Production URL verified after deployment (needs owner action, below)

## Deploying to Vercel (owner steps)

The build environment had no Vercel access, so deployment needs the owner's account.

1. Go to **vercel.com → Add New → Project → Import Git Repository** and select `shaniqbal/raah-disaster-intelligence`.
2. Framework preset: **Next.js** (auto-detected). Build command `next build`, output default. Node 20 or newer.
3. **Production branch:** Vercel deploys `main` to production. Until this branch is merged, every push to `claude/friendly-galileo-fvo0r1` creates a **Preview** deployment. Use that preview to verify first.
4. Environment variables (Project → Settings → Environment Variables):
   - `NEXT_PUBLIC_SITE_URL` = the final URL (for Open Graph metadata)
   - Optional: `DASHSCOPE_API_KEY` (Alibaba Cloud Model Studio), `QWEN_MODEL` (default `qwen-plus`), `QWEN_BASE_URL`
5. Deploy, then verify on the preview URL:
   - `/api/health` returns `{"status":"ok"}`, with `aiProvider` reporting `qwen-configured` if a key is set
   - each route in the table in ARCHITECTURE.md loads
   - `/live` shows LIVE data (the browser can reach USGS / Open-Meteo)
   - `/demo` completes, and the presenter notes open with N
   - DevTools → Application → Service Workers is active; with "Offline" ticked, `/simulator` still loads
6. **Do not** overwrite the existing `ai-disaster-app-five.vercel.app` project. Create a new project (for example `raah-disaster-intelligence`) or a custom domain.
7. Once the preview is verified and the owner approves, merge the branch into `main` to promote it to production.
