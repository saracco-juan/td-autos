#!/bin/sh
# Container entrypoint: cache configuration from the runtime environment (no secret is baked
# into the image), apply pending migrations, then hand the process over to Apache.
set -e

export PORT="${PORT:-8080}"

php artisan config:cache
php artisan route:cache
php artisan view:cache
php artisan migrate --force

# The artisan commands ran as root; Apache serves as www-data.
chown -R www-data:www-data storage bootstrap/cache

exec apache2-foreground
