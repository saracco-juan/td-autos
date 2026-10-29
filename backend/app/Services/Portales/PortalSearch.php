<?php

namespace App\Services\Portales;

/**
 * What a buyer wants to find on the portals: a model and the filters that come out of the diagnosis.
 * Every filter is optional; each portal uses the ones it supports.
 */
final readonly class PortalSearch
{
    /**
     * @param  array<string, string>  $routes  Portal key => "brand/model" path of the model in that portal.
     * @param  string|null  $transmission  `automatica` or `manual`.
     * @param  string|null  $fuel  Fuel slug, for example `nafta`.
     * @param  string|null  $zone  Zone slug of the portal, for example `bsas-gba-sur`.
     * @param  string|null  $body  Body type key, for example `sedan` or `hatchback`.
     */
    public function __construct(
        public array $routes,
        public ?string $transmission = null,
        public ?string $fuel = null,
        public ?int $yearFrom = null,
        public ?int $yearTo = null,
        public ?string $zone = null,
        public ?int $maxKm = null,
        public ?int $maxPriceArs = null,
        public ?string $body = null,
        public ?int $doors = null,
    ) {}
}
