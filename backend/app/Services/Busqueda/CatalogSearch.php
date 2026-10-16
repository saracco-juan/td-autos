<?php

namespace App\Services\Busqueda;

use App\Models\PublicacionExterna;
use App\Models\Vehiculo;
use App\Models\VehiculoConcesionaria;
use App\Services\Subscription\SubscriptionLifecycle;
use App\Support\VehiculoFotos;
use App\Support\VehiculoOptions;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Str;

/**
 * The buyer's list, read from the database (D8, D9): visible vehicles of dealers with an operative
 * subscription, plus the vehicles persisted from the external marketplaces whose latest refresh
 * succeeded. No dealer is favoured (RF28): newest vehicle first, which is deterministic because
 * `vehiculo.id` is unique; HU05 replaces this order with the recommendation score.
 */
class CatalogSearch
{
    public const DEALER_SOURCE = 'concesionaria';

    /** Columns the free text is matched against. */
    private const SEARCHABLE = ['marca', 'modelo', 'version', 'descripcion'];

    public function __construct(private readonly SubscriptionLifecycle $lifecycle) {}

    /**
     * @param  list<string>  $healthySources  Keys of the external sources whose listings may be shown.
     * @param  array<string, string>  $sourceNames  Label by source key.
     * @return LengthAwarePaginator<int, array<string, mixed>>
     */
    public function search(?string $text, array $healthySources, array $sourceNames, int $page, int $perPage): LengthAwarePaginator
    {
        $dealerIds = $this->lifecycle->operativeDealerIds();

        $query = Vehiculo::query()
            ->where(function (Builder $visible) use ($dealerIds, $healthySources): void {
                $visible
                    ->whereIn('vehiculo.id', VehiculoConcesionaria::query()
                        ->select('vehiculo_id')->where('visible', true)->whereIn('concesionaria_id', $dealerIds))
                    ->orWhereIn('vehiculo.id', PublicacionExterna::query()
                        ->select('vehiculo_id')->whereIn('marketplace', $healthySources));
            })
            ->orderByDesc('vehiculo.id')
            ->with(['propiedad.concesionaria:id,nombre,provincia', 'publicacionExterna', 'portada']);

        foreach ($this->words($text) as $patterns) {
            $query->where(function (Builder $word) use ($patterns): void {
                foreach (self::SEARCHABLE as $column) {
                    foreach ($patterns as $pattern) {
                        $word->orWhereRaw("LOWER({$column}) LIKE ? ESCAPE '!'", [$pattern]);
                    }
                }
            });
        }

        return $query->paginate($perPage, ['*'], 'page', $page)
            ->through(fn (Vehiculo $vehiculo): array => $this->present($vehiculo, $sourceNames));
    }

    /**
     * Every word of the text as the LIKE patterns that satisfy it: folded to ASCII (the usual way
     * a buyer types) and lowercased with its accents (matches a stored accent). `LOWER()` only
     * folds ASCII on SQLite, so an accented capital in a column is matched on Postgres only.
     *
     * @return list<list<string>>
     */
    private function words(?string $text): array
    {
        $words = preg_split('/\s+/', trim($text ?? ''), -1, PREG_SPLIT_NO_EMPTY) ?: [];

        return array_map(function (string $word): array {
            $patterns = [Str::lower(Str::ascii($word)), mb_strtolower($word)];

            return array_values(array_unique(array_map(
                fn (string $p): string => '%'.addcslashes($p, '!%_').'%',
                $patterns,
            )));
        }, $words);
    }

    /**
     * @param  array<string, string>  $sourceNames
     * @return array<string, mixed>
     */
    private function present(Vehiculo $vehiculo, array $sourceNames): array
    {
        $external = $vehiculo->publicacionExterna;
        $dealer = $vehiculo->propiedad?->concesionaria;
        $isExternal = $vehiculo->origen === VehiculoOptions::ORIGEN_EXTERNO && $external !== null;

        $title = $isExternal && $vehiculo->descripcion
            ? $vehiculo->descripcion
            : trim(implode(' ', array_filter([$vehiculo->marca, $vehiculo->modelo, $vehiculo->version, $vehiculo->anio])));

        return [
            'id' => $vehiculo->id,
            'titulo' => $title,
            'marca' => $vehiculo->marca,
            'modelo' => $vehiculo->modelo,
            'version' => $vehiculo->version,
            'anio' => $vehiculo->anio,
            'kilometraje' => $vehiculo->kilometraje,
            'precio' => $vehiculo->precio === null ? null : $vehiculo->precio + 0,
            'moneda' => $vehiculo->moneda,
            'ubicacion' => $vehiculo->ubicacion ?? $dealer?->provincia,
            'imagen_url' => $vehiculo->portada ? VehiculoFotos::url($vehiculo->portada->ubicacion_archivo) : null,
            'url_original' => $isExternal ? $external->url_original : null,
            'fuente' => $isExternal
                ? ['clave' => $external->marketplace, 'nombre' => $sourceNames[$external->marketplace] ?? $external->marketplace]
                : ['clave' => self::DEALER_SOURCE, 'nombre' => $dealer?->nombre ?? ''],
        ];
    }
}
