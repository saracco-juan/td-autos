#!/bin/sh
# Container entrypoint: cache configuration from the runtime environment (no secret is baked
# into the image), apply pending migrations, then hand the process over to Apache.
# A failed migration stops the container on purpose: Render keeps the previous deploy serving
# instead of running new code against an old schema. DB_URL must be the session pooler (5432).
set -e

export PORT="${PORT:-8080}"

php artisan config:cache
php artisan route:cache
php artisan view:cache
php artisan migrate --force
# One-time load of the bundled fixed ACARA catalog; a no-op once any catalog exists. A failure only leaves the
# catalog empty (inventory entry answers 503), so it must not stop the API from starting.
php artisan catalog:load-bundled || echo "catalog:load-bundled failed; the catalog stays empty."

# The artisan commands ran as root; Apache serves as www-data.
chown -R www-data:www-data storage bootstrap/cache

exec apache2-foreground
