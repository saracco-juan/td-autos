<?php

namespace App\Services\Marketplaces;

use App\Models\PublicacionExterna;
use App\Models\TipoCarroceria;
use App\Models\Vehiculo;
use App\Support\VehiculoOptions;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Keeps one `vehiculo` (origen `externo`) and one `publicacion_externa` per external listing, so
 * recommendations, favorites and the vehicle sheet can point to a vehicle id (RF05). A listing
 * already stored (same marketplace and external id) is updated, never duplicated.
 */
class ExternalListingStore
{
    /** Mercado Libre wording, folded, to the values of VehiculoOptions. */
    private const TRANSMISION = ['manual' => 'manual', 'automatica' => 'automatica', 'automatizada' => 'automatica'];

    private const COMBUSTIBLE = [
        'nafta' => 'nafta', 'diesel' => 'diesel', 'gnc' => 'gnc', 'hibrido' => 'hibrido', 'electrico' => 'electrico',
    ];

    /** Marketplace body type, folded, to the name in the `tipo_carroceria` catalog. */
    private const CARROCERIA = [
        'sedan' => 'Sedán', 'hatchback' => 'Hatchback', 'suv' => 'SUV', 'pickup' => 'Pickup',
        'utilitario' => 'Furgón', 'furgon' => 'Furgón', 'rural' => 'Rural / familiar', 'familiar' => 'Rural / familiar',
    ];

    /**
     * Upsert the listings in one transaction.
     *
     * @param  list<ExternalListing>  $listings
     * @return list<int> Vehicle id of each listing, in the same order.
     */
    public function sync(array $listings): array
    {
        $bodyTypes = TipoCarroceria::query()->pluck('id', 'nombre');

        return DB::transaction(function () use ($listings, $bodyTypes): array {
            $ids = [];
            foreach ($listings as $listing) {
                $ids[] = $this->upsert($listing, $bodyTypes->all());
            }

            return $ids;
        });
    }

    /**
     * @param  array<string, int>  $bodyTypes  Catalog ids by name.
     */
    private function upsert(ExternalListing $listing, array $bodyTypes): int
    {
        $attributes = [
            'origen' => VehiculoOptions::ORIGEN_EXTERNO,
            'tipo_carroceria_id' => $this->bodyTypeId($listing->carroceria, $bodyTypes),
            'marca' => $listing->marca,
            'modelo' => $listing->modelo,
            'version' => $listing->version,
            'anio' => $listing->anio,
            'kilometraje' => $listing->kilometraje,
            'precio' => $listing->precio,
            'moneda' => $listing->moneda,
            'combustible' => $this->map($listing->combustible, self::COMBUSTIBLE),
            'transmision' => $this->map($listing->transmision, self::TRANSMISION),
            'ubicacion' => $listing->ubicacion,
            'descripcion' => $listing->title,
        ];

        $publicacion = PublicacionExterna::query()
            ->where('marketplace', $listing->marketplace)
            ->where('external_id', $listing->externalId)
            ->first();

        if ($publicacion) {
            $vehiculo = Vehiculo::findOrFail($publicacion->vehiculo_id);
            $vehiculo->update($attributes);
            $publicacion->update(['url_original' => $listing->urlOriginal]);
        } else {
            $vehiculo = Vehiculo::create($attributes);
            PublicacionExterna::create([
                'vehiculo_id' => $vehiculo->id,
                'marketplace' => $listing->marketplace,
                'external_id' => $listing->externalId,
                'url_original' => $listing->urlOriginal,
            ]);
        }

        // The thumbnail is the cover; foto_vehiculo already serves external URLs as they are.
        $vehiculo->fotos()->delete();
        if ($listing->imagenUrl !== null) {
            $vehiculo->fotos()->create(['ubicacion_archivo' => $listing->imagenUrl, 'orden' => 1]);
        }

        return $vehiculo->id;
    }

    /**
     * @param  array<string, string>  $map
     */
    private function map(?string $value, array $map): ?string
    {
        return $value === null ? null : ($map[$this->fold($value)] ?? null);
    }

    /**
     * @param  array<string, int>  $bodyTypes
     */
    private function bodyTypeId(?string $value, array $bodyTypes): ?int
    {
        $name = $this->map($value, self::CARROCERIA);

        return $name === null ? null : ($bodyTypes[$name] ?? null);
    }

    /** Lowercase, no accents, letters and digits only: "Pick-Up" becomes "pickup". */
    private function fold(string $value): string
    {
        return preg_replace('/[^a-z0-9]/', '', mb_strtolower(Str::ascii($value)));
    }
}
