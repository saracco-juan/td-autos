<?php

namespace App\Services\Inventario;

use App\Models\Concesionaria;
use App\Models\Vehiculo;
use App\Models\VehiculoConcesionaria;
use App\Support\Patente;
use App\Support\VehiculoFields;
use Illuminate\Validation\ValidationException;

/**
 * Validates a whole XLSX for a dealer without writing anything (CU-20): file shape, every row,
 * and the rules that need the whole batch (repeated plates, plates of other dealers). The
 * import endpoint runs the same plan again before it applies it.
 */
class VehiculoImportPlanner
{
    public function __construct(
        private readonly VehiculoXlsxReader $reader,
        private readonly VehiculoRowValidator $validator,
        private readonly VehicleCatalog $catalog,
        private readonly VehicleCatalogIdentity $identity,
    ) {}

    /**
     * @throws ValidationException When the file cannot be read as a whole (error under `archivo`).
     */
    public function plan(Concesionaria $dealer, string $contents): ImportPlan
    {
        try {
            $parsed = $this->reader->read($contents);
        } catch (ImportFileException $e) {
            throw ValidationException::withMessages(['archivo' => [$e->getMessage()]]);
        }

        $rows = array_map(fn (array $row) => $this->validator->validate($row['fila'], $row['data']), $parsed);

        $this->applyBatchRules($dealer, $rows);
        $rows = $this->resolveIdentities($rows);

        return new ImportPlan($rows);
    }

    /** Add catalog links only after row and ownership validation; never write in preview. */
    private function resolveIdentities(array $rows): array
    {
        $valid = array_filter($rows, fn (ImportRow $row) => $row->isValid());
        if ($valid === []) {
            return $rows;
        }
        $catalog = $this->catalog->current();
        $existing = Vehiculo::query()->whereIn('id', array_filter(array_column($valid, 'vehiculoId')))->get()->keyBy('id');
        foreach ($rows as $index => $row) {
            if (! $row->isValid()) {
                continue;
            }
            try {
                $labels = $this->identity->resolveWorkbook($row->attributes, $existing->get($row->vehiculoId), $catalog);
                $rows[$index] = new ImportRow($row->fila, $row->patente, [...$row->attributes, ...$labels], $row->fotos, [], $row->vehiculoId);
            } catch (ValidationException $error) {
                $row->errores = array_merge(...array_values($error->errors()));
            }
        }

        return $rows;
    }

    /**
     * @param  list<ImportRow>  $rows
     */
    private function applyBatchRules(Concesionaria $dealer, array $rows): void
    {
        $rows = array_filter($rows, fn (ImportRow $row) => Patente::isValid($row->patente));
        $occurrences = array_count_values(array_map(fn (ImportRow $row) => $row->patente, $rows));
        $owners = VehiculoConcesionaria::query()
            ->whereIn('patente_normalizada', array_keys($occurrences))
            ->get(['vehiculo_id', 'concesionaria_id', 'patente_normalizada'])
            ->keyBy('patente_normalizada');

        foreach ($rows as $row) {
            if ($occurrences[$row->patente] > 1) {
                $row->errores[] = "La patente {$row->patente} está repetida en el archivo.";
            }

            $owner = $owners->get($row->patente);

            if ($owner === null) {
                continue;
            }

            if ($owner->concesionaria_id === $dealer->id) {
                $row->vehiculoId = $owner->vehiculo_id;
            } else {
                $row->errores[] = VehiculoFields::PATENTE_TAKEN_MESSAGE;
            }
        }
    }
}
