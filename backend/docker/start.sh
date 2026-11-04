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

# The artisan commands ran as root; Apache serves as www-data.
chown -R www-data:www-data storage bootstrap/cache

# Curated models of the recommendations (HU06): a fast upsert from a bundled file, independent of the catalog.
# A failure is logged and does not stop the start; the next start retries it.
su -s /bin/sh www-data -c "php artisan portales:load-models || echo 'portales:load-models failed; the curated models stay as they were.'"

# One-time load of the bundled fixed ACARA catalog; a no-op once any catalog exists. It runs in the background,
# as www-data (it may write logs and cache files), so Apache binds the port at once: a first load against a remote
# database must not hold the start past Render's port scan. It commits in one transaction, so readers see no
# partial catalog (the endpoint answers 503 until it ends), and a start cut short simply retries on the next one.
su -s /bin/sh www-data -c "php artisan catalog:load-bundled || echo 'catalog:load-bundled failed; the catalog stays empty.'" &

exec apache2-foreground
