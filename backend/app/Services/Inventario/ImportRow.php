<?php

namespace App\Services\Inventario;

/**
 * One data row of the XLSX after validation: the vehicle columns ready to be written, its photo
 * URLs, and the messages of everything that is wrong with it.
 */
final class ImportRow
{
    /**
     * @param  int  $fila  Physical line of the file; the header is row 1.
     * @param  string  $patente  Normalized plate; empty when the cell was empty.
     * @param  array<string, mixed>  $attributes  Columns of the `vehiculo` row.
     * @param  list<string>  $fotos  External photo URLs, in order.
     * @param  list<string>  $errores
     * @param  int|null  $vehiculoId  Id of the dealer's own vehicle when the plate already exists.
     */
    public function __construct(
        public readonly int $fila,
        public readonly string $patente,
        public readonly array $attributes,
        public readonly array $fotos,
        public array $errores = [],
        public ?int $vehiculoId = null,
    ) {}

    public function isValid(): bool
    {
        return $this->errores === [];
    }
}
