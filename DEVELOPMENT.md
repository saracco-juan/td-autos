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

For a URL that does not change, use a named Cloudflare tunnel (account and own domain) or an ngrok static domain.

### Production

The backend has its own public HTTPS URL, so no tunnel is needed: `GOOGLE_REDIRECT_URI` points to it and serves web and app, `GOOGLE_MOBILE_REDIRECT_URI` stays empty (falls back to it), and Google Cloud holds a single callback URI. The built app returns through `tdautos://` (`MOBILE_REDIRECT_PREFIXES`); `exp://` (Expo Go) is only accepted outside production.

## Scripts and commands

| What | Command | Notes |
| --- | --- | --- |
| Demo database | `php artisan db:local [--path=<file>]` | Rebuilds `backend/database/manual.sqlite` from scratch (deletes the target file). SQLite only. |
| Administrator account | `php artisan admin:create` | Creates an admin user. |
| Subscription lifecycle | `php artisan suscripciones:procesar` | Inactivates subscriptions past grace, hides their vehicles, deletes those past retention. |
| Engram manifest merge driver | `git config merge.engram-manifest.driver "node scripts/engram-merge-manifest.mjs %O %A %B"` | Once per clone. Merges `engram/*/.engram/manifest.json` as the union of chunks (`.gitattributes`). GitHub does not run it: if `develop` gained engram commits, merge `origin/develop` into the branch locally before merging the PR. |
| Engram import / export | `engram sync --import` / `engram sync --project td-autos` | Run from `engram/<name>/` (see `AGENTS.md`). |

With the merge driver registered, uncommitted engram changes can move to another branch: `git stash push -u -- engram/<name>`, `git switch <branch>`, `git stash pop`.
