# TD Autos — getting started

How to install and run each part locally, and the commands to test, lint and build them. Deeper local setups (demo database, Google sign-in from a phone, shared code) are in [`development.md`](development.md); deployed environments are in [`infrastructure.md`](infrastructure.md).

## Requirements

- PHP 8.2+ and Composer
- Node.js 22.13+ (or 24.3+) and npm: Expo requires it for the mobile app

## 1. Backend

```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate
php artisan serve
```

The database is Supabase (PostgreSQL). Before migrating, set `DB_CONNECTION=pgsql` and `DB_URL` in `.env` to the connection string of the Supabase project.

To work without Supabase, `php artisan db:local` builds a SQLite database with demo data (see [`development.md`](development.md#local-demo-database)).

## 2. Web frontend

```bash
cd frontend/web
npm install
npm run dev
```

## 3. Mobile app

```bash
cd frontend/mobile
npm install
cp .env.example .env
```

The phone cannot reach the PC's `localhost`: in `.env`, set `EXPO_PUBLIC_API_URL` to the PC's IP on the local network (for example `http://192.168.0.10:8000`) and start the backend with `php artisan serve --host=0.0.0.0`. Then:

```bash
npx expo start
```

Open the app with Expo Go by scanning the QR code. The phone and the PC must be on the same Wi-Fi network.

The app uses Sanctum tokens (`/api/mobile/*`), not the web session cookie, and only accepts buyers. The link in the password recovery email opens the web reset screen.

Google sign-in from the phone needs an HTTPS tunnel: see [`development.md`](development.md#google-sign-in-from-a-phone-development-only).

## Commands

| Part | Tests | Lint / format | Build |
|------|-------|---------------|-------|
| Backend | `php artisan test` | `./vendor/bin/pint` | — |
| Web frontend | `npm run test` (with coverage: `npm run test:coverage`) | `npm run lint` | `npm run build` |
| Mobile app | `npm run test` (with coverage: `npm run test:coverage`) | `npm run lint` and `npm run typecheck` | `npx expo export --platform android` |

Before opening a PR, from the repo root: `node scripts/check-duplication.mjs` measures duplication of new code against `origin/develop`, like the SonarQube Cloud quality gate (fails above 3%).
