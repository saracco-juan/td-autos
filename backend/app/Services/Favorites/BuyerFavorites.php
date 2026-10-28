<?php

namespace App\Services\Favorites;

use App\Models\Vehiculo;
use App\Services\Subscription\SubscriptionLifecycle;
use App\Support\VehiculoFotos;
use App\Support\VehiculoOptions;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

final class BuyerFavorites
{
    private const FIELDS = ['id', 'marca', 'modelo', 'version', 'anio', 'precio', 'moneda',
        'kilometraje', 'transmision', 'combustible', 'ubicacion'];

    public function __construct(private readonly SubscriptionLifecycle $lifecycle) {}

    public function forUser(int $userId, array $input): array
    {
        $query = $this->available()->join('favorito', 'favorito.vehiculo_id', '=', 'vehiculo.id')
            ->where('favorito.usuario_id', $userId)
            ->select(array_map(fn ($field) => "vehiculo.$field", self::FIELDS))
            ->with('portada')->orderByDesc('favorito.fecha_guardado')->orderByDesc('vehiculo.id');
        if (isset($input['ids'])) {
            $query->whereIn('vehiculo.id', $input['ids']);
        }
        $page = $query->paginate($input['per_page'] ?? 6, ['*'], 'page', $input['page'] ?? 1);

        return [
            'data' => $page->getCollection()->map(fn (Vehiculo $vehicle) => [
                ...$vehicle->only(self::FIELDS),
                'precio' => $vehicle->precio === null ? null : (float) $vehicle->precio,
                'image_url' => $vehicle->portada === null ? null : VehiculoFotos::url($vehicle->portada->ubicacion_archivo),
            ])->all(),
            'meta' => ['current_page' => $page->currentPage(), 'per_page' => $page->perPage(),
                'last_page' => $page->lastPage(), 'total' => $page->total()],
        ];
    }

    public function save(int $userId, int $vehicleId): bool
    {
        if (! $this->available()->whereKey($vehicleId)->exists()) {
            return false;
        }
        // The existing composite primary key makes repeated saves idempotent.
        DB::table('favorito')->insertOrIgnore([
            'usuario_id' => $userId, 'vehiculo_id' => $vehicleId, 'fecha_guardado' => now(),
        ]);

        // Confirm persistence even if a concurrent listing deletion removed the favorite.
        return DB::table('favorito')->where('usuario_id', $userId)->where('vehiculo_id', $vehicleId)->exists();
    }

    public function remove(int $userId, int $vehicleId): void
    {
        // A withdrawn vehicle can still be removed from the owner's saved list.
        DB::table('favorito')->where('usuario_id', $userId)->where('vehiculo_id', $vehicleId)->delete();
    }

    public function savedVehicleIds(int $userId, array $vehicleIds): array
    {
        if ($vehicleIds === []) {
            return [];
        }

        return DB::table('favorito')->where('usuario_id', $userId)->whereIn('vehiculo_id', $vehicleIds)
            ->pluck('vehiculo_id')->map(fn ($id) => (int) $id)->all();
    }

    public function isSaved(int $userId, int $vehicleId): bool
    {
        return DB::table('favorito')->where('usuario_id', $userId)->where('vehiculo_id', $vehicleId)->exists();
    }

    private function available(): Builder
    {
        return Vehiculo::query()->where('origen', VehiculoOptions::ORIGEN_CONCESIONARIA)
            ->whereHas('propiedad', fn ($query) => $query->where('visible', true)
                ->whereIn('concesionaria_id', $this->lifecycle->operativeDealerIds(now())));
    }
}
