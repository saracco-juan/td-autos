<?php

namespace Tests\Feature\Inventario;

use App\Models\Concesionaria;
use App\Models\FotoVehiculo;
use App\Models\TipoCarroceria;
use App\Models\User;
use App\Models\Vehiculo;
use App\Models\VehiculoConcesionaria;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;

/**
 * Fixtures shared by the dealer inventory tests: a faked photo disk, real (GD-free) image
 * uploads, a valid form payload, and vehicles that belong to a dealer.
 */
trait InteractsWithVehiculos
{
    /** 1x1 transparent PNG; real image bytes so the `image` rule passes without GD. */
    private const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

    /** UH-5: explicit synthetic declarations, not equipment inferred from a real model. */
    private const EQUIPMENT_FIELDS = [
        'control_estabilidad', 'frenos_abs', 'airbags_frontales', 'airbags_laterales',
        'airbags_cortina', 'isofix', 'frenado_autonomo', 'asistencia_carril',
        'punto_ciego', 'recordatorio_cinturon', 'asistencia_velocidad', 'monitoreo_conductor',
        'volante_regulable', 'climatizador_bizona', 'butacas_calefaccionadas',
        'android_auto_apple_carplay', 'sensores_estacionamiento', 'velocidad_crucero',
        'camara_retroceso', 'aire_acondicionado',
    ];

    private string $disk;

    private ?string $catalogVersionId = null;

    /** Opt-in only: outage and legacy tests must not receive an implicit catalog. */
    private function seedVehicleCatalog(): void
    {
        $rows = [];
        foreach ([['Toyota', 'Corolla', 'XEI 2.0 CVT'], ['Ford', 'Focus', 'Trend 1.6']] as [$make, $model, $version]) {
            $rows[] = ['make' => $make, 'model' => $model, 'version' => $version,
                'version_id' => $this->catalogId($make, $model, $version), 'currency' => 'ARS', 'values' => []];
        }
        Cache::forever('resale.acara.last-valid.v1', ['snapshot_id' => 'acara:test',
            'source_date' => now()->toDateString(), 'fetched_at' => now()->toIso8601String(), 'rows' => $rows]);
        $this->catalogVersionId = $rows[0]['version_id'];
    }

    private function catalogId(string $make, string $model, string $version): string
    {
        return 'acara:'.hash('sha256', json_encode([$make, $model, $version], JSON_THROW_ON_ERROR));
    }

    protected function setUpInteractsWithVehiculos(): void
    {
        $this->disk = config('filesystems.vehicle_photos_disk');
        Storage::fake($this->disk);
    }

    /**
     * @return list<UploadedFile>
     */
    private function photos(int $count): array
    {
        return array_map(
            fn (int $n) => UploadedFile::fake()->createWithContent("foto{$n}.png", base64_decode(self::PNG)),
            range(1, $count),
        );
    }

    /**
     * @param  array<string, mixed>  $overrides
     * @return array<string, mixed>
     */
    private function payload(array $overrides = []): array
    {
        return [
            'patente' => 'AB123CD',
            'marca' => 'Toyota',
            'modelo' => 'Corolla',
            'version' => 'XEI 2.0 CVT',
            ...($this->catalogVersionId === null ? [] : ['acara_version_id' => $this->catalogVersionId]),
            'anio' => 2021,
            'kilometraje' => 45000,
            'precio' => 25000000,
            'moneda' => 'ARS',
            'plazas' => 5,
            'motor' => '2.0',
            'turbo' => false,
            'potencia' => 170,
            'potencia_unidad' => 'CV',
            'consumo_urbano' => 8.5,
            'consumo_ruta' => 6.2,
            'transmision' => 'automatica',
            'combustible' => 'nafta',
            'carroceria_id' => TipoCarroceria::query()->value('id'),
            'ubicacion' => 'Córdoba',
            'descripcion' => 'Único dueño.',
            'fotos' => $this->photos(7),
            ...array_fill_keys(self::EQUIPMENT_FIELDS, false),
            ...$overrides,
        ];
    }

    private function dealer(): User
    {
        return Concesionaria::factory()->active()->create()->usuario;
    }

    /**
     * A vehicle owned by the dealer with $photos stored photos numbered 1..n.
     */
    private function vehicleOf(Concesionaria $dealer, int $photos = 7, string $plate = 'XY987ZW'): Vehiculo
    {
        $vehiculo = Vehiculo::factory()->create([
            'combustible' => 'nafta',
            'transmision' => 'manual',
        ]);
        VehiculoConcesionaria::factory()->create([
            'vehiculo_id' => $vehiculo->id,
            'concesionaria_id' => $dealer->id,
            'patente_normalizada' => $plate,
        ]);

        for ($n = 1; $n <= $photos; $n++) {
            $path = "vehiculos/{$vehiculo->id}/old{$n}.png";
            Storage::disk($this->disk)->put($path, base64_decode(self::PNG));
            FotoVehiculo::factory()->create([
                'vehiculo_id' => $vehiculo->id,
                'ubicacion_archivo' => $path,
                'orden' => $n,
            ]);
        }

        return $vehiculo;
    }
}
