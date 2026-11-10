<?php

namespace App\Services\Portales;

/**
 * A link to a filtered search in one portal.
 */
final readonly class PortalLink
{
    public function __construct(
        public string $portal,
        public string $name,
        public string $url,
    ) {}
}
