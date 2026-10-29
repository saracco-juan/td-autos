<?php

namespace App\Repositories;

use App\Models\FotoVehiculo;
use App\Support\VehiculoFotos;
use App\Support\VehiculoOptions;
use Illuminate\Support\Facades\DB;

/**
 * Photos of the curated models (HU06), taken from the vehicles the dealers already loaded, so no photo is stored
 * or credited for the models themselves.
 */
final class ModelPhotoRepository
{
    /** Normalised (brand, model) pair the results are indexed by. */
    public static function key(string $marca, string $modelo): string
    {
        return mb_strtolower($marca).'|'.mb_strtolower($modelo);
    }

    /**
     * Cover photo URL per model: the lowest-`orden` photo of the newest (highest id) visible vehicle of an operative
     * dealer that has a photo and the same brand and the same model or one of its `nombres_inventario` (the other
     * names the inventory uses for that car), ignoring case. Models without such a vehicle have no entry. Two
     * queries for all the models, whatever their number.
     *
     * @param  iterable<array{marca: string, modelo: string, nombres_inventario?: list<string>|null}>  $models
     * @param  list<int>  $operativeDealerIds
     * @return array<string, string> By {@see self::key()}.
     */
    public function coverUrls(iterable $models, array $operativeDealerIds): array
    {
        $wanted = []; // inventory (brand, name) key => keys of the curated models it stands for
        foreach ($models as $model) {
            foreach ([$model['modelo'], ...($model['nombres_inventario'] ?? [])] as $name) {
                $wanted[self::key($model['marca'], $name)][] = self::key($model['marca'], $model['modelo']);
            }
        }
        if ($wanted === [] || $operativeDealerIds === []) {
            return [];
        }

        $rows = DB::table('vehiculo')
            ->where('origen', VehiculoOptions::ORIGEN_CONCESIONARIA)
            ->whereIn('id', DB::table('vehiculo_concesionaria')->select('vehiculo_id')
                ->where('visible', true)->whereIn('concesionaria_id', $operativeDealerIds))
            ->whereExists(fn ($photos) => $photos->select(DB::raw(1))->from('foto_vehiculo')->whereColumn('foto_vehiculo.vehiculo_id', 'vehiculo.id'))
            ->groupBy(DB::raw('lower(marca)'), DB::raw('lower(modelo)'))
            ->selectRaw('lower(marca) as marca, lower(modelo) as modelo, max(id) as vehiculo_id')
            ->get()
            ->filter(fn (object $row) => isset($wanted[self::key($row->marca, $row->modelo)]));

        $newest = []; // curated model key => id of its newest vehicle, under any of its names
        foreach ($rows as $row) {
            foreach ($wanted[self::key($row->marca, $row->modelo)] as $curated) {
                $newest[$curated] = max($newest[$curated] ?? 0, $row->vehiculo_id);
            }
        }
        if ($newest === []) {
            return [];
        }

        $covers = FotoVehiculo::query()->whereIn('vehiculo_id', array_values($newest))
            ->orderBy('orden')->get(['vehiculo_id', 'ubicacion_archivo'])->unique('vehiculo_id')->keyBy('vehiculo_id');

        return array_map(fn (int $vehicleId) => VehiculoFotos::url($covers[$vehicleId]->ubicacion_archivo), $newest);
    }
}
