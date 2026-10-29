<?php

namespace App\Services\Portales;

/**
 * Mercado Libre Autos. Every part below was checked by hand on the real site (2026-10-28):
 * filters go in the path (transmission, fuel, years, zone) or as `_KEY_value` suffixes, and
 * the body type key really contains asterisks. Any other spelling is silently ignored by the portal.
 */
final class MercadoLibreLinks implements PortalLinkStrategy
{
    private const BASE = 'https://autos.mercadolibre.com.ar/';

    /** Body type key => id of the portal's `VEHICLE*BODY*TYPE` filter. Only the ids verified so far. */
    private const BODY_TYPES = ['sedan' => 452758, 'hatchback' => 479344];

    public function portal(): string
    {
        return 'mercadolibre';
    }

    public function name(): string
    {
        return 'Mercado Libre';
    }

    public function url(PortalSearch $search): ?string
    {
        $route = $search->routes[$this->portal()] ?? null;
        if ($route === null) {
            return null;
        }

        $path = array_filter([$route, $search->transmission, $search->fuel, $this->years($search), $search->zone]);

        return self::BASE.implode('/', $path).'/'.$this->suffixes($search);
    }

    /** A range needs both ends; with only one the portal gets no year. */
    private function years(PortalSearch $search): ?string
    {
        if ($search->yearFrom === null || $search->yearTo === null) {
            return null;
        }

        return $search->yearFrom === $search->yearTo ? (string) $search->yearFrom : "{$search->yearFrom}-{$search->yearTo}";
    }

    private function suffixes(PortalSearch $search): string
    {
        $bodyId = self::BODY_TYPES[$search->body ?? ''] ?? null;

        return implode('', [
            $search->maxKm === null ? '' : "_KILOMETERS_0km-{$search->maxKm}km",
            $search->maxPriceArs === null ? '' : "_PriceRange_0ARS-{$search->maxPriceArs}ARS",
            $bodyId === null ? '' : "_VEHICLE*BODY*TYPE_{$bodyId}",
            $search->doors === null ? '' : "_DOORS_{$search->doors}-{$search->doors}",
        ]);
    }
}
