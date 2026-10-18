<?php

namespace App\Services\Marketplaces;

/**
 * One vehicle published in an external marketplace, in the portal vocabulary (RF05). Text
 * attributes keep the marketplace wording; the persistence step normalizes them.
 */
final class ExternalListing
{
    public function __construct(
        public readonly string $marketplace,
        public readonly string $externalId,
        public readonly string $title,
        public readonly ?string $marca,
        public readonly ?string $modelo,
        public readonly ?string $version,
        public readonly ?int $anio,
        public readonly ?int $kilometraje,
        public readonly int|float|null $precio,
        public readonly ?string $moneda,
        public readonly ?string $transmision,
        public readonly ?string $combustible,
        public readonly ?string $carroceria,
        public readonly ?string $ubicacion,
        public readonly string $urlOriginal,
        public readonly ?string $imagenUrl,
    ) {}
}
