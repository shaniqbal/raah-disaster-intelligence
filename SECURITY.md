# Security Policy

RAAH is a public demonstration and handles no real emergency reports.

## Reporting a vulnerability
Please open a private security advisory on GitHub (Security → Report a vulnerability) for `shaniqbal/raah-disaster-intelligence`, or contact the maintainer, Shan Iqbal. Do not include personal data in reports.

## Measures in place
- **Secrets:** only `DASHSCOPE_API_KEY` (optional), read server-side in `/api/copilot`. No `NEXT_PUBLIC_` secrets. `.env*` files are git-ignored.
- **Input validation:** zod on the API body (question ≤ 500 chars) and on scenario parameters (clamped to declared ranges; ids allow-listed). Provider responses are validated, and malformed records are dropped.
- **AI safety:** the model receives only RAAH-computed facts plus the question. The system prompt forbids new facts and claims of dispatch. Output is capped at 2,000 characters, rendered as plain text, and has no tool or code execution. Server logs never include user text or keys.
- **Rate limiting:** 12 Copilot requests per IP per minute. The limiter is in-memory and per serverless instance, so treat it as best effort. Use a shared store (for example Upstash or Vercel KV) for a hard quota.
- **Headers:** Content-Security-Policy (self only; `connect-src` limited to USGS and Open-Meteo), `frame-ancestors 'none'`, `X-Frame-Options: DENY`, `nosniff`, a strict referrer policy, and a Permissions-Policy (geolocation for self only).
- **No unsafe HTML:** the only `dangerouslySetInnerHTML` is a static theme bootstrap script.
- **Privacy:** SOS reports stay in the browser, are purged after 24 h, and have location rounded to about 1 km by default. Contact details are optional. There are no analytics or trackers.
- **Dependencies:** `npm audit --omit=dev` reports 0 vulnerabilities at release.

## Out of scope for the demo
Authentication, authorisation, multi-user persistence and audit storage on a server are not implemented. Do not deploy RAAH for operational use without them.
