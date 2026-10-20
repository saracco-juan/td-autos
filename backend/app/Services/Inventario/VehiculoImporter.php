<?php

namespace App\Services\Inventario;

use App\Models\Concesionaria;
use App\Models\Vehiculo;
use App\Support\VehiculoOptions;
use Illuminate\Database\UniqueConstraintViolationException;

/**
 * Writes a valid import plan for a dealer: creates the new vehicles and overwrites the matching
 * ones, replacing all their photos with the CSV URLs. It never opens its own transaction: the
 * caller wraps it, so a failure anywhere rolls the whole batch back (RNF12).
 */
class VehiculoImporter
{
    /**
     * @return list<string> Locations of the replaced photos; delete the stored ones only after commit.
     *
     * @throws ImportConflictException When a plate was taken since the plan was made.
     */
    public function apply(Concesionaria $dealer, ImportPlan $plan): array
    {
        $replaced = [];

        foreach ($plan->actualizaciones() as $row) {
            $vehiculo = Vehiculo::query()->findOrFail($row->vehiculoId);
            $vehiculo->update($this->attributes($row));
            $replaced = [...$replaced, ...$vehiculo->fotos()->pluck('ubicacion_archivo')->all()];
            $vehiculo->fotos()->delete();
            $this->storePhotos($vehiculo, $row);
        }

        foreach ($plan->nuevos() as $row) {
            $vehiculo = Vehiculo::create([
                ...$this->attributes($row),
                'origen' => VehiculoOptions::ORIGEN_CONCESIONARIA,
            ]);

            try {
                $vehiculo->propiedad()->create([
                    'concesionaria_id' => $dealer->id,
                    'patente_normalizada' => $row->patente,
                    'visible' => true,
                ]);
            } catch (UniqueConstraintViolationException $e) {
                throw new ImportConflictException($row, $e);
            }

            $this->storePhotos($vehiculo, $row);
        }

        return $replaced;
    }

    /**
     * Optional columns the CSV left blank are cleared on an overwrite.
     *
     * @return array<string, mixed>
     */
    private function attributes(ImportRow $row): array
    {
        return ['version' => null, 'descripcion' => null, ...$row->attributes];
    }

    private function storePhotos(Vehiculo $vehiculo, ImportRow $row): void
    {
        $vehiculo->fotos()->createMany(array_map(
            fn (string $url, int $index) => ['ubicacion_archivo' => $url, 'orden' => $index + 1],
            $row->fotos,
            array_keys($row->fotos),
        ));
    }
}
