<?php

namespace App\Services\Marketplaces;

use RuntimeException;
use Throwable;

/**
 * A marketplace could not give a usable answer: timeout, rejection or malformed data (RNF06).
 */
class SourceUnavailableException extends RuntimeException
{
    public function __construct(public readonly string $sourceKey, string $reason, ?Throwable $previous = null)
    {
        parent::__construct("Source [{$sourceKey}] unavailable: {$reason}", 0, $previous);
    }
}
