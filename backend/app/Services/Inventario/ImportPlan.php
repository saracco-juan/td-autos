<?php

namespace App\Services\Inventario;

/**
 * Outcome of validating a whole XLSX: the rows to create, the rows that overwrite one of the
 * dealer's own vehicles, and every error found. Nothing is written until a plan has no errors.
 */
final class ImportPlan
{
    /**
     * @param  list<ImportRow>  $rows  Every data row, in file order.
     */
    public function __construct(private readonly array $rows) {}

    /**
     * @return list<ImportRow>
     */
    public function nuevos(): array
    {
        return array_values(array_filter($this->rows, fn (ImportRow $row) => $row->isValid() && $row->vehiculoId === null));
    }

    /**
     * @return list<ImportRow>
     */
    public function actualizaciones(): array
    {
        return array_values(array_filter($this->rows, fn (ImportRow $row) => $row->isValid() && $row->vehiculoId !== null));
    }

    /**
     * @return list<array{fila: int, patente: ?string, mensajes: list<string>}>
     */
    public function errores(): array
    {
        $errors = [];

        foreach ($this->rows as $row) {
            if (! $row->isValid()) {
                $errors[] = ['fila' => $row->fila, 'patente' => $row->patente ?: null, 'mensajes' => $row->errores];
            }
        }

        return $errors;
    }

    public function hasErrors(): bool
    {
        return $this->errores() !== [];
    }
}
