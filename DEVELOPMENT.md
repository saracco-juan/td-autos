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

## HU05 vehicle facts — storage stage

The additive matching-facts migration and `Vehiculo` casts store actual seats, turbo, power unit,
urban/road consumption (L/100 km), and declared safety/comfort equipment. Existing `moneda`,
`motor` and `potencia` columns are reused. Consumption uses two-decimal precision.

New columns are nullable without defaults: `null` means unknown, `false` means explicitly absent.
No existing vehicle is backfilled from its body type, model or brand. `volante_regulable` means
both height and reach adjustment; `aire_acondicionado` covers AC or climate control. A single
`android_auto_apple_carplay` flag means at least one platform is present. See the API stage below;
forms, CSV and matching remain separate stages.

To verify storage and a forward/rollback cycle without touching a configured database:

```bash
cd backend
php artisan test --filter=VehiculoMatchingFactsTest
```

The tests use SQLite in memory. They check known/unknown values, types and preservation of existing
rows; rollback removes only the new columns (and their values). PostgreSQL DDL is compiled without
connecting; PostgreSQL execution is not covered. No migration was executed against a real database.

## UH-5 core vehicle facts — API stage

Dealer create/update now require `moneda` (ARS/USD), `plazas`, `motor`, `turbo`, `potencia` and
`potencia_unidad` (CV/HP/kW). Gasoline (`nafta`) and diesel also require `consumo_urbano` and
`consumo_ruta` in L/100 km; other fuels may omit them. Seats/power are positive integers; turbo
accepts JSON booleans or multipart 0/1. Consumption is positive with at most two decimals.
Upper bounds come only from storage: seats 32767, power 2147483647, consumption 9999.99.

Create, update, show and list return these facts; unknown legacy values remain null. Currency is
stored as declared, without conversion. Existing ownership, plate, photo and transaction rules stay.
API requests opt into the shared rules; CSV retains its existing contract until its own stage.
The older web form cannot submit the new required facts yet: do not deploy the intermediate chain.
Equipment validation, form controls and matching scores are not part of this stage.

### Manual API check

Start the backend and web app as described in README, using a local test database with the stage-one
migration applied. Sign in on the web as an active dealer. Paste this into that tab's browser console;
only the API host/port may need changing. It uses the same Sanctum session cookie and CSRF header as
the web client. It creates a temporary listing with seven tiny test photos and deletes only that
listing at the end. Do not run this against a production database.

```javascript
await (async () => {
  const api = 'http://localhost:8000';
  await fetch(`${api}/sanctum/csrf-cookie`, { credentials: 'include' });
  const call = async (path, method = 'GET', body) => {
    const headers = { Accept: 'application/json' };
    const token = document.cookie.split('; ').find(c => c.startsWith('XSRF-TOKEN='));
    if (token) headers['X-XSRF-TOKEN'] = decodeURIComponent(token.slice(11));
    if (body && !(body instanceof FormData)) headers['Content-Type'] = 'application/json';
    const response = await fetch(`${api}${path}`, {
      method, headers, credentials: 'include',
      body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    });
    const data = response.status === 204 ? null : await response.json();
    console.log(method, path, response.status, data);
    return { status: response.status, data };
  };
  const session = await call('/api/user'); // 200: signed-in dealer
  if (session.status !== 200) throw new Error('Sign in as an active dealer first.');
  const { data: options } = await call('/api/diagnostico');
  const random = crypto.getRandomValues(new Uint32Array(5));
  const letter = n => String.fromCharCode(65 + n % 26);
  const plate = letter(random[0]) + letter(random[1]) + String(random[2] % 1000).padStart(3, '0') + letter(random[3]) + letter(random[4]);
  const fields = {
    patente: plate, marca: 'Toyota', modelo: 'Corolla', anio: 2021, kilometraje: 45000,
    precio: 20000, moneda: 'USD', plazas: 5, motor: '2.0', turbo: 0,
    potencia: 170, potencia_unidad: 'CV', consumo_urbano: 8.5, consumo_ruta: 6.2,
    transmision: 'automatica', combustible: 'nafta', ubicacion: 'Córdoba',
    carroceria_id: options.carrocerias[0].id,
  };
  const form = new FormData();
  Object.entries(fields).forEach(([key, value]) => form.append(key, String(value)));
  const bytes = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='), c => c.charCodeAt(0));
  for (let i = 0; i < 7; i++) form.append('fotos[]', new File([bytes], `test${i}.png`, { type: 'image/png' }));
  const created = await call('/api/concesionaria/vehiculos', 'POST', form); // 201, USD, 5 seats, turbo false
  if (created.status !== 201) throw new Error('Fixture creation failed; inspect the logged response.');
  const path = `/api/concesionaria/vehiculos/${created.data.vehiculo.id}`;
  try {
    await call(path, 'POST', { ...fields, plazas: 0 }); // 422, errors.plazas, nothing changed
    await call(path); // 200, still 5 seats and seven photos
    await call(path, 'POST', { ...fields, moneda: 'ARS', precio: 25000000, plazas: 7, turbo: true }); // 200, updated facts
    await call('/api/concesionaria/vehiculos'); // 200, listing contains the updated facts
  } finally {
    await call(path, 'DELETE'); // 204, only this newly created fixture removed
  }
})();
```

Automated check: `cd backend; php artisan test --filter=MatchingFactsApiTest` (SQLite in memory).
