# TD Autos — development notes

Technical setup that `README.md` does not cover: local environments, tunnels, scripts and maintenance commands. `README.md` stays the source for installing and running each part; add new technical notes here.

## Google sign-in from a phone (development only)

The phone cannot reach the PC's `localhost`, and Google does not accept a LAN IP as a redirect URI. In development the backend is exposed through a Cloudflare quick tunnel so the phone can finish the OAuth flow, while the web keeps using `localhost`.

How it works: a mobile flow (`client=mobile`) sends Google `GOOGLE_MOBILE_REDIRECT_URI` and exchanges the code with the same URI; a web flow uses `GOOGLE_REDIRECT_URI`. The callback must reach the host that started the flow, because the OAuth state lives in that host's session cookie.

### One-time setup

```bash
brew install cloudflared
```

In `backend/.env`, leave `SESSION_DOMAIN=` empty (a `localhost` cookie domain is rejected on the tunnel host and the OAuth state is lost). `APP_URL` and `GOOGLE_REDIRECT_URI` stay on `localhost`.

### Every time the tunnel starts

The quick tunnel URL lives as long as the `cloudflared` process: it changes on every restart.

1. Start the backend and the tunnel, and keep both running:
   ```bash
   php artisan serve --host=0.0.0.0
   ```
   ```bash
   cloudflared tunnel --url http://localhost:8000
   ```
2. Copy the `https://<words>.trycloudflare.com` URL printed under "Your quick Tunnel has been created!".
3. `backend/.env`: `GOOGLE_MOBILE_REDIRECT_URI=https://<words>.trycloudflare.com/auth/google/callback`, then `php artisan config:clear` and restart `serve`.
4. `frontend/mobile/.env`: `EXPO_PUBLIC_API_URL=https://<words>.trycloudflare.com`, then `npx expo start -c` (`EXPO_PUBLIC_*` values are baked into the bundle, so the cache must be cleared).
5. Google Cloud Console → Google Auth Platform → Clients (old console: APIs & Services → Credentials) → the Web client whose ID is `GOOGLE_CLIENT_ID` → Authorized redirect URIs: add the new callback URI, keep `http://localhost:8000/auth/google/callback`, remove old tunnel URIs, Save. It can take a few minutes to apply.

A newly created tunnel may not resolve on the Mac for a few minutes (DNS negative cache); `dig +short <host> @1.1.1.1` confirms it exists. While the tunnel runs, anyone with the URL reaches the local backend: stop it with `Ctrl+C` when done.

Troubleshooting:

- Google shows `Error 400: invalid_request`: the redirect URI is malformed (for example `https://https://…`) or not registered. Check the `redirect_uri` the backend sends: `curl -s -o /dev/null -w "%{redirect_url}\n" "http://localhost:8000/auth/google/redirect?client=mobile&return_to=exp%3A%2F%2Fx"`.
- White screen after picking the account, with `InvalidStateException` in `storage/logs/laravel.log`: the flow started on a different host than the callback (usually `EXPO_PUBLIC_API_URL` still points to the LAN IP), so the session is missing and the backend falls back to the web URL.

For a URL that does not change, use a named Cloudflare tunnel (account and own domain) or an ngrok static domain.

### Production

The backend has a public HTTPS URL (`https://<vercel host>/backend`, see [Deploy](#deploy)), so no tunnel is needed: `GOOGLE_REDIRECT_URI` points to it and serves web and app, `GOOGLE_MOBILE_REDIRECT_URI` stays empty (falls back to it), and Google Cloud holds a single callback URI. The built app returns through `tdautos://` (`MOBILE_REDIRECT_PREFIXES`); `exp://` (Expo Go) is only accepted outside production.

## Code shared by web and mobile (`frontend/shared/`)

Pure TypeScript used by both apps, today the diagnosis model (`diagnosis/`: types, questions, draft rules). It must not import React, React Native or any npm package: neither app installs dependencies for that folder.

- Import it as `@shared/<path>` (for example `@shared/diagnosis/steps`). Web resolves the alias in `tsconfig.app.json` `paths` and `vite.config.ts` `resolve.alias` (plus `server.fs.allow` for the dev server). Mobile resolves it from `tsconfig.json` `paths`, which Expo Metro and `jest-expo` read; `metro.config.js` adds the folder to `watchFolders`. The shared folder has no `node_modules`, so whatever its files import (Babel runtime helpers included) is resolved from the app's own `node_modules`: `metro.config.js` `resolver.nodeModulesPaths` and `jest.config.js` `modulePaths`. Keep shared code free of npm imports.
- Its unit tests (`*.test.ts` next to the code) run in the web suite (`vitest.config.ts` `include`), which also reports their coverage. Their `vitest` import resolves through a `paths` entry in `tsconfig.app.json`. CI rewrites the `../shared/` lcov paths to `frontend/shared/` for SonarQube Cloud. Mobile only tests its screens.
- ESLint does not reach this folder (each config stops at its app root); web `tsc -b` type-checks it.

## Deploy

Everything runs on free plans: the SPA on Vercel, the API as a Docker web service on Render, database and files on Supabase. The browser only talks to the Vercel host: `frontend/web/vercel.json` proxies `/backend/*` to Render, so the session cookie, CSRF and Google sign-in stay on one origin (no CORS, no custom domain). The `/backend` prefix keeps API routes such as `POST /login` apart from SPA pages with the same path.

| Environment | Branch | Web (Vercel) | API (Render) | Database and files |
| --- | --- | --- | --- | --- |
| local | any | `http://localhost:5173` | `http://localhost:8000` | SQLite (`db:local`) or your own Supabase |
| development | `develop` | `https://td-autos-git-develop-<scope>.vercel.app` | `td-autos-api-dev` | Supabase project `td-autos-dev` |
| production | `main` | `https://td-autos.vercel.app` | `td-autos-api` | Supabase project `td-autos` |

A push to `develop` or `main` redeploys both sides of that environment. Other Vercel previews (feature branches, PRs) are proxied to the development API, never to production.

### Hostnames: where to adjust them

The names above are the planned ones; the real ones appear once the accounts exist. If they differ:

- **Vercel production host** (`td-autos.vercel.app`): the `has.host` value of the first rewrite in `frontend/web/vercel.json`. If it does not match, production traffic silently goes to the development API.
- **Render service URLs** (`td-autos-api.onrender.com`, `td-autos-api-dev.onrender.com`): the rewrite destinations in `frontend/web/vercel.json` and the GitHub variables of the cron.
- **Vercel host of each environment**: the `APP_URL`, `FRONTEND_URL`, `SANCTUM_STATEFUL_DOMAINS` and `GOOGLE_REDIRECT_URI` values of each Render service, and the Google redirect URIs.

### One-time setup

1. **Supabase** (two projects, `td-autos` and `td-autos-dev`, same region; `us-east-1` sits next to Render's `virginia`):
   - Database: Connect → Session pooler, copy the URI (`postgresql://postgres.<ref>:<password>@aws-<n>-<region>.pooler.supabase.com:5432/postgres`) as `DB_URL`. Do not use the direct connection: it is IPv6-only and Render has no IPv6. Do not use the transaction pooler (port 6543): it does not support prepared statements.
   - Storage: create a **public** bucket for vehicle photos (`SUPABASE_STORAGE_BUCKET`, for example `vehiculos`) and a **private** bucket for payment receipts (`SUPABASE_STORAGE_PRIVATE_BUCKET`, for example `comprobantes`).
   - Storage → S3 connection: copy the endpoint (`SUPABASE_STORAGE_ENDPOINT`) and region (`SUPABASE_STORAGE_REGION`), and create an access key (`SUPABASE_STORAGE_KEY` / `SUPABASE_STORAGE_SECRET`, shown once). `SUPABASE_STORAGE_URL` is `https://<ref>.supabase.co/storage/v1/object/public/<photos bucket>`.
2. **Render**: New → Blueprint, pick this repo; Render reads `render.yaml` and creates both services. Fill the values marked `sync: false` per service (table below). Render asks for them only at this point: later, edit them in the service's Environment tab. Generate each `APP_KEY` locally with `php artisan key:generate --show` (a different one per environment; Render's `generateValue` is not a valid Laravel key). The first deploy runs the migrations (`backend/docker/start.sh`).
3. **Vercel**: Add New → Project, import this repo, Root Directory `frontend/web` (framework Vite; build command and rewrites come from `vercel.json`). Keep "Include files outside the root directory in the Build Step" enabled: the web imports `frontend/shared`. Project name `td-autos` gives the planned production host. Production branch: `main` (Settings → Environments). No environment variables are needed: the build bakes `VITE_API_URL=/backend`.
4. **Google Cloud Console** → Google Auth Platform → Clients → the Web client: add `https://td-autos.vercel.app/backend/auth/google/callback` and `https://td-autos-git-develop-<scope>.vercel.app/backend/auth/google/callback` to the authorized redirect URIs, and both hosts (without path) to the authorized JavaScript origins. Keep the localhost entries.
5. **Mail**: Gmail API from a dedicated account, see [Mail](#mail) below.
6. **GitHub** → Settings → Secrets and variables → Actions: variables `PROD_API_URL` / `DEV_API_URL` (the Render URLs, `https://td-autos-api.onrender.com`), secrets `CRON_SECRET_PROD` / `CRON_SECRET_DEV` (the `CRON_SECRET` of each Render service, `openssl rand -hex 32`). Run the "Cron" workflow once by hand (Actions → Cron → Run workflow) to check both environments answer `200`.
7. **First administrator**: Render free has no Shell and no one-off jobs, so run the command locally against the environment's database. The session pooler is IPv4, so it works from home:
   ```bash
   cd backend
   php artisan config:clear
   DB_CONNECTION=pgsql DB_URL='<session pooler URI of that environment>' php artisan admin:create
   ```
   Real environment variables win over `backend/.env`, so the local file is not touched. Make sure the first deploy already ran the migrations.

### Environment variables (Render)

Same keys in both services; "value" is the same for both unless it says otherwise. Secrets are never committed.

| Key | Value | Secret |
| --- | --- | --- |
| `APP_NAME`, `APP_ENV`, `APP_DEBUG` | `TD Autos`, `production`, `false` (in `render.yaml`) | no |
| `LOG_CHANNEL` | `stderr` (logs in Render's Logs tab) | no |
| `DB_CONNECTION` | `pgsql` | no |
| `SESSION_DRIVER`, `CACHE_STORE`, `QUEUE_CONNECTION` | `database`, `database`, `sync` | no |
| `SESSION_SECURE_COOKIE` | `true` | no |
| `VEHICLE_PHOTOS_DISK`, `RECEIPTS_DISK` | `supabase`, `supabase_private` | no |
| `MAIL_MAILER`, `MAIL_FROM_NAME` | `gmail`, `TD Autos` (in `render.yaml`) | no |
| `APP_KEY` | `base64:…` from `php artisan key:generate --show`, one per environment | yes |
| `APP_URL` | `https://<vercel host>/backend` | no |
| `FRONTEND_URL` | `https://<vercel host>` | no |
| `SANCTUM_STATEFUL_DOMAINS` | `<vercel host>` (no scheme) | no |
| `GOOGLE_REDIRECT_URI` | `https://<vercel host>/backend/auth/google/callback` | no |
| `DB_URL` | Supabase session pooler URI of the environment | yes |
| `SUPABASE_STORAGE_KEY`, `SUPABASE_STORAGE_SECRET` | S3 access key of the environment's project | yes |
| `SUPABASE_STORAGE_REGION`, `SUPABASE_STORAGE_ENDPOINT`, `SUPABASE_STORAGE_URL` | from the project's S3 connection settings | no |
| `SUPABASE_STORAGE_BUCKET`, `SUPABASE_STORAGE_PRIVATE_BUCKET` | public photos bucket, private receipts bucket | no |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Web client of Google Cloud (can be shared by both environments) | secret: yes |
| `CRON_SECRET` | `openssl rand -hex 32`, one per environment; empty disables the cron endpoint | yes |
| `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN` | mail OAuth client and refresh token, see [Mail](#mail) (can be shared by both environments) | yes |
| `MAIL_FROM_ADDRESS` | the dedicated Gmail address, see [Mail](#mail) | no |
| `ADMIN_NOTIFICATION_EMAILS` | comma-separated admins notified of new payment receipts (optional) | no |
| `TRANSFER_HOLDER`, `TRANSFER_CUIT`, `TRANSFER_BANK`, `TRANSFER_CBU`, `TRANSFER_ALIAS`, `SUBSCRIPTION_MONTHLY_AMOUNT`, `TRANSFER_ADVISOR_WHATSAPP` | bank transfer data shown to dealers; add them in the Environment tab when known (not in `render.yaml`) | no |

`<vercel host>` is `td-autos.vercel.app` for `td-autos-api` and `td-autos-git-develop-<scope>.vercel.app` for `td-autos-api-dev`. `SESSION_DOMAIN` stays unset (host-only cookie). Anything else keeps the defaults of `backend/config/`.

Mobile builds point at the same proxy: `EXPO_PUBLIC_API_URL=https://<vercel host>/backend`, so Google sign-in keeps its session on one host.

### Mail

Render free blocks outbound SMTP (ports 25, 465 and 587), so deployed environments send mail through the **Gmail API over HTTPS** from a dedicated Gmail account: `MAIL_MAILER=gmail` (`backend/app/Mail/Transport/GmailApiTransport.php`). It exchanges a long-lived refresh token for an access token (cached until shortly before it expires) and posts each message to `users.messages.send`. Local and CI keep the default `log` mailer; nothing changes there.

One-time setup (the same account and credentials can serve both environments):

1. Create the dedicated Gmail account (for example `tdautos.noreply@gmail.com`). It is the sender: `MAIL_FROM_ADDRESS` must be this address, Gmail rewrites any other `From`.
2. Google Cloud Console, in the existing project → APIs & Services → Library → **Gmail API** → Enable.
3. Google Auth Platform → Audience: user type **External**, publishing status **In production** (Publish app). In "Testing", refresh tokens for non-basic scopes such as `gmail.send` expire after 7 days and mail stops. Google may show an "unverified app" warning on sign-in; only the dedicated account signs in, so continue past it.
4. Google Auth Platform → Data access: add the scope `https://www.googleapis.com/auth/gmail.send`.
5. Google Auth Platform → Clients → Create client: type **Web application**, name `TD Autos mail` (a separate client, not the Socialite one), authorized redirect URI `https://developers.google.com/oauthplayground`. Copy the client ID and secret.
6. Open [OAuth 2.0 Playground](https://developers.google.com/oauthplayground): gear icon → "Use your own OAuth credentials", paste the client ID and secret (access type offline). In step 1 enter the scope `https://www.googleapis.com/auth/gmail.send`, Authorize APIs, **sign in as the dedicated account** and allow. Step 2 → "Exchange authorization code for tokens", copy the **refresh token**.
7. In each Render service (Environment tab): `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN` and `MAIL_FROM_ADDRESS` (the dedicated address). `MAIL_MAILER=gmail` and `MAIL_FROM_NAME=TD Autos` come from `render.yaml`.
8. Check: request a password reset on the deployed web and confirm the mail arrives. A failure shows in Render's Logs tab as `Gmail API rejected the message (HTTP <status>)` or `Could not get a Gmail API access token (HTTP <status>)`; a `400` on the token usually means the refresh token was revoked or expired (repeat step 6).

Limits: a consumer Gmail account sends up to 500 messages a day and 500 recipients per message; above that Gmail blocks sending for up to 24 hours. The refresh token stops working if the account password changes (tokens with Gmail scopes are revoked), if it goes unused for six months, or if access is removed from the account; repeat step 6 and update `GMAIL_REFRESH_TOKEN`.

### Free-plan limits

- **Render**: a service sleeps after 15 minutes without traffic; the next request waits about a minute while it starts (Vercel waits up to 120 s for the first byte, so it is slow but does not fail). The 750 free instance hours per month are shared by both services; the hourly cron wakes each one every hour (about 15 minutes of uptime per wake-up). The disk is ephemeral: files live in Supabase Storage.
- **Vercel**: the request body limit of the `/backend` proxy is not documented; check a 5 MB photo and receipt upload on the first deploy.
- **Supabase**: free projects pause after a week without activity; restore them from the dashboard. The hourly cron queries the database, which should count as activity; check the dashboard after the first week.
- **GitHub Actions**: scheduled workflows only run from the default branch (`develop`, so the cron starts once this workflow is merged there) and are disabled after 60 days without repository activity; re-enable them in the Actions tab.

## Scripts and commands

| What | Command | Notes |
| --- | --- | --- |
| Demo database | `php artisan db:local [--path=<file>]` | Rebuilds `backend/database/manual.sqlite` from scratch (deletes the target file). SQLite only. |
| Administrator account | `php artisan admin:create` | Creates an admin user. |
| Duplication on new code | `node scripts/check-duplication.mjs [--base origin/develop] [--max 3]` | From the repo root. Runs jscpd (100 tokens, 10 lines, Sonar's CPD defaults) over `sonar.sources`, keeps the clones that touch lines changed against the merge base (uncommitted and untracked files included) and fails over the limit. CI runs it on every PR. jscpd wants Node 22; Node 20 only warns. |
| Subscription lifecycle | `php artisan suscripciones:procesar` | Inactivates subscriptions past grace, hides their vehicles, deletes those past retention. |
| Engram manifest merge driver | `git config merge.engram-manifest.driver "node scripts/engram-merge-manifest.mjs %O %A %B"` | Once per clone. Merges `engram/*/.engram/manifest.json` as the union of chunks (`.gitattributes`). GitHub does not run it: if `develop` gained engram commits, merge `origin/develop` into the branch locally before merging the PR. |
| Engram import / export | `engram sync --import` / `engram sync --project td-autos` | Run from `engram/<name>/` (see `AGENTS.md`). |

With the merge driver registered, uncommitted engram changes can move to another branch: `git stash push -u -- engram/<name>`, `git switch <branch>`, `git stash pop`.

Do not leave engram changes staged, stashed or uncommitted: after every export, commit `engram/<name>/` on the branch you are working on (`chore: sync engram memories`), so the memory travels with that work and a branch switch cannot strand it in a stash.
