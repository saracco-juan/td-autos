<?php

namespace App\Services\Inventario;

/**
 * A plate was taken by another vehicle between the validation and the write (the platform-wide
 * unique index decides). Carries the row so the dealer sees which one to fix.
 */
final class ImportConflictException extends \RuntimeException
{
    public function __construct(public readonly ImportRow $row, ?\Throwable $previous = null)
    {
        parent::__construct("Plate {$row->patente} is already taken.", 0, $previous);
    }
}
