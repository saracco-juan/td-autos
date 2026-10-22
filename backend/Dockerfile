# Production image for the API (Render free web service).
# php:8.2-apache: one process, mod_php behind Apache, no extra supervisor; Laravel's
# public/.htaccess already handles routing and the Authorization header.
FROM composer:2 AS vendor

WORKDIR /app
COPY composer.json composer.lock ./
# Installs exactly the lock file. Platform requirements are checked against the runtime stage
# (vendor/composer/platform_check.php), not this builder's PHP and extensions.
RUN composer install --no-dev --no-scripts --no-autoloader --no-interaction --prefer-dist \
        --ignore-platform-reqs

COPY . .
RUN composer dump-autoload --no-dev --optimize --no-scripts --no-interaction

FROM php:8.2-apache

# pdo_pgsql/pgsql for Supabase; every other extension the lock file needs ships with the image.
RUN apt-get update \
    && apt-get install -y --no-install-recommends libpq-dev \
    && docker-php-ext-install pdo_pgsql pgsql opcache \
    && apt-get purge -y --auto-remove \
    && rm -rf /var/lib/apt/lists/*

COPY docker/php.ini /usr/local/etc/php/conf.d/zz-app.ini
COPY docker/apache.conf /etc/apache2/sites-available/000-default.conf
RUN a2enmod rewrite headers \
    && echo 'Listen ${PORT}' > /etc/apache2/ports.conf

WORKDIR /var/www/html
COPY --from=vendor /app /var/www/html

# Runtime directories (the local storage/ is not copied; the disk is ephemeral anyway).
RUN mkdir -p storage/app/private storage/app/public storage/framework/cache/data \
        storage/framework/sessions storage/framework/views storage/logs bootstrap/cache \
    && php artisan package:discover --ansi \
    && chown -R www-data:www-data storage bootstrap/cache \
    && chmod +x docker/start.sh

ENV PORT=8080
EXPOSE 8080

CMD ["docker/start.sh"]
