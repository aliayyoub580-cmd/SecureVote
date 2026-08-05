# SecureVote — Election Management System

Production-oriented SPA (Vite + React + TypeScript) backed by **Supabase** (Postgres, Auth, Storage, Realtime). Voting logic and row-level security live in SQL migrations and RPCs.

## Quick start

```bash
npm ci
cp .env.example .env
# fill VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm run dev
```

## Environment variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `VITE_SUPABASE_URL` | Yes (prod) | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Yes (prod) | Supabase anon (public) key |
| `VITE_STRICT_ENV` | Optional | `true` = fail fast in production build if Supabase env missing/invalid |
| `VITE_TURNSTILE_SITE_KEY` | Optional | Cloudflare Turnstile on login/register (verify server-side for strong protection) |

## Security architecture (summary)

- **RLS & SQL**: Policies and `security definer` RPCs in `supabase/migrations/` enforce access; the JS client never runs raw SQL (Supabase client = parameterized APIs → **SQL injection** mitigated).
- **XSS**: Rich election HTML is sanitized with **DOMPurify** before `dangerouslySetInnerHTML` (see `src/lib/sanitize-html.ts`).
- **Auth**: Supabase Auth with **PKCE** (`src/lib/supabase/client.ts`). Session in app storage module (`auth-storage`).
- **CSRF**: API calls use bearer-style session from Supabase client, not classic cookie form posts; pair with SameSite cookies on your domain if you add cookie-based APIs later.
- **CAPTCHA**: Optional **Turnstile** when `VITE_TURNSTILE_SITE_KEY` is set. **Production**: validate the token with Cloudflare’s siteverify API from a **Supabase Edge Function** or backend (not implemented in this repo by default).
- **Rate limiting**: Light **client-side** throttle on auth (`src/lib/client-rate-limit.ts`). **Production**: also enable Supabase Auth rate limits / WAF / Vercel firewall.
- **Storage**: Candidate images bucket policies in migrations (scoped insert/update/delete).
- **Audit**: `audit_logs` + optional IP/UA enrichment via `record_audit_event` RPC (see migrations `20260519140000_audit_transparency.sql`).

## Build & quality

```bash
npm run lint
npm run build
```

GitHub Actions (`.github/workflows/ci.yml`) runs lint + build on push/PR. CI injects dummy Supabase env so Vite can compile.

## Deploy — Vercel

1. Connect the Git repo to Vercel; framework **Vite**; output **`dist`**.
2. Set environment variables in the Vercel project (same as `.env.example`, without exposing service role keys in the client).
3. `vercel.json` adds security headers, long-cache for `/assets/*`, and SPA rewrites.

**Supabase**: run all migrations on the linked project (`supabase db push` or SQL editor). Enable **email confirmation**, **MFA** (optional), and **leaked password protection** in Auth settings for production.

## Production checklist

- [ ] All `supabase/migrations/*.sql` applied to production DB  
- [ ] RLS enabled on every public table; no `service_role` keys in the browser  
- [ ] `VITE_STRICT_ENV=true` on production builds after env vars are set in Vercel  
- [ ] Turnstile **server-side** verification (Edge Function) if CAPTCHA is required  
- [ ] Custom domain + HTTPS (Vercel default)  
- [ ] CORS: Supabase dashboard allows your production origin  
- [ ] Storage bucket public read only where needed; uploads authenticated  
- [ ] Backups / PITR on Supabase  
- [ ] Error monitoring (Sentry, etc.) — wire to `ErrorBoundary` / `logger` as needed  
- [ ] Remove dev-only logging and test accounts  

## Folder map (high level)

- `src/app/` — router shell (`app.tsx`, lazy `app-routes.tsx`)
- `src/components/` — UI, layout, feature widgets
- `src/lib/` — env, logger, sanitization, utilities, Supabase client
- `src/pages/` — route-level screens
- `src/services/` — data access / orchestration
- `supabase/migrations/` — schema, RLS, RPCs

## License

Private / internal — adjust as appropriate for your organization.
