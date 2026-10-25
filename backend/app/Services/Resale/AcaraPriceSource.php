<?php

namespace App\Services\Resale;

use App\Services\Catalog\FixedAcaraCatalog;
use Carbon\CarbonImmutable;

/** Compatible source envelope over permanent catalog data; never acquires or refreshes. */
final class AcaraPriceSource
{
    public function __construct(private readonly FixedAcaraCatalog $catalog) {}

    public function current(): array
    {
        $snapshot = $this->catalog->current();
        $stale = $snapshot !== null && CarbonImmutable::parse($snapshot['fetched_at'])->addDays(14)->lessThanOrEqualTo(now());

        return ['snapshot' => $snapshot, 'stale' => $stale,
            'warning' => $snapshot === null ? 'acara_unavailable' : ($stale ? 'acara_stale' : null)];
    }
}
