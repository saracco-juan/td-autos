<?php

namespace App\Services\Portales;

/**
 * A recommended model as the API shows it, plus whether a USD price was converted to build it.
 */
final readonly class ModelRecommendation
{
    /**
     * @param  array<string, mixed>  $payload
     */
    public function __construct(
        public array $payload,
        public bool $usedUsd,
    ) {}
}
