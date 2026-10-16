<?php

namespace App\Services\Marketplaces;

use InvalidArgumentException;

/**
 * Picks the Mercado Libre implementation from `services.mercadolibre.driver`: `recorded` (demo
 * file) or `api` (live search). A blank driver (`MELI_DRIVER=` in .env) means `recorded`.
 */
class MercadoLibreSourceFactory
{
    public function make(): ListingSource
    {
        $driver = config('services.mercadolibre.driver');
        $driver = blank($driver) ? 'recorded' : $driver;

        return match ($driver) {
            'recorded' => new RecordedMercadoLibreSource(config('marketplaces.recorded_path.mercadolibre')),
            'api' => new MercadoLibreApiSource(
                config('services.mercadolibre.client_id'),
                config('services.mercadolibre.client_secret'),
                config('services.mercadolibre.base_url'),
                config('services.mercadolibre.site'),
                config('services.mercadolibre.category'),
                (int) config('marketplaces.timeout'),
                (int) config('marketplaces.limit'),
                new MercadoLibreListingMapper,
            ),
            default => throw new InvalidArgumentException('Unknown Mercado Libre driver ['.(is_string($driver) ? $driver : '').'].'),
        };
    }
}
