<?php

namespace App\Services\Inventario;

use App\Models\Vehiculo;
use App\Support\VehiculoFotos;
use Illuminate\Support\Facades\DB;

/**
 * Permanently deletes a vehicle with the buyer data that points to it, children first so no
 * foreign key is violated. Used by the dealer's manual delete (RF22) and by the removal of
 * retained inventory (RF27).
 */
class VehiculoDestroyer
{
    /**
     * Checklists of a vehicle: table => [table of its completed marks, column that points back].
     *
     * @var array<string, array{string, string}>
     */
    private const CHECKLISTS = [
        'checklist_inspeccion' => ['item_inspeccion_completado', 'checklist_id'],
        'checklist_transferencia' => ['etapa_transferencia_completada', 'seguimiento_id'],
    ];

    /**
     * Other tables with a `vehiculo_id` foreign key, emptied for a deleted vehicle.
     *
     * @var list<string>
     */
    private const VEHICLE_DEPENDENTS = ['favorito', 'recomendacion', 'publicacion_externa', 'foto_vehiculo'];

    /**
     * Delete the vehicle in its own transaction; the stored files go only after the rows are gone.
     */
    public function destroy(Vehiculo $vehiculo): void
    {
        $paths = DB::transaction(fn (): array => $this->deleteRows($vehiculo));

        VehiculoFotos::forget($paths);
    }

    /**
     * Delete the vehicle's rows inside the caller's transaction and return its photo paths. The
     * caller forgets the files with VehiculoFotos::forget() once the outer transaction commits.
     *
     * @return list<string>
     */
    public function deleteRows(Vehiculo $vehiculo): array
    {
        $paths = $vehiculo->fotos()->pluck('ubicacion_archivo')->all();

        foreach (self::CHECKLISTS as $table => [$marks, $foreignKey]) {
            $checklists = DB::table($table)->where('vehiculo_id', $vehiculo->id);
            DB::table($marks)->whereIn($foreignKey, (clone $checklists)->select('id'))->delete();
            $checklists->delete();
        }

        foreach (self::VEHICLE_DEPENDENTS as $table) {
            DB::table($table)->where('vehiculo_id', $vehiculo->id)->delete();
        }

        DB::table('lead')->where('vehiculo_concesionaria_id', $vehiculo->id)->delete();
        $vehiculo->propiedad()->delete();
        $vehiculo->delete();

        return $paths;
    }
}
