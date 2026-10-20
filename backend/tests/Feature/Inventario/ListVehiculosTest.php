<?php

namespace Tests\Feature\Inventario;

use App\Http\Middleware\EnsureDealerIsActive;
use App\Models\Concesionaria;
use App\Models\FotoVehiculo;
use App\Models\TipoCarroceria;
use App\Models\User;
use App\Models\Vehiculo;
use App\Models\VehiculoConcesionaria;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * UH21 (RF22): a dealer lists its own inventory and nobody else's.
 */
class ListVehiculosTest extends TestCase
{
    use RefreshDatabase;

    private const URL = '/api/concesionaria/vehiculos';

    private function vehicleOf(Concesionaria $dealer, array $attributes = []): Vehiculo
    {
        $vehiculo = Vehiculo::factory()->create([
            'combustible' => 'nafta',
            'transmision' => 'manual',
            ...$attributes,
        ]);
        VehiculoConcesionaria::factory()->create([
            'vehiculo_id' => $vehiculo->id,
            'concesionaria_id' => $dealer->id,
        ]);

        return $vehiculo;
    }

    public function test_list_is_empty_for_a_dealer_without_vehicles(): void
    {
        $dealer = Concesionaria::factory()->active()->create();

        $this->actingAs($dealer->usuario)
            ->getJson(self::URL)
            ->assertOk()
            ->assertExactJson(['vehiculos' => []]);
    }

    public function test_list_returns_only_the_signed_in_dealers_vehicles_newest_first(): void
    {
        $dealer = Concesionaria::factory()->active()->create();
        $other = Concesionaria::factory()->active()->create();

        $first = $this->vehicleOf($dealer);
        $this->vehicleOf($other);
        Vehiculo::factory()->create(['origen' => 'seed']);
        $third = $this->vehicleOf($dealer);

        $this->actingAs($dealer->usuario)
            ->getJson(self::URL)
            ->assertOk()
            ->assertJsonCount(2, 'vehiculos')
            ->assertJsonPath('vehiculos.0.id', $third->id)
            ->assertJsonPath('vehiculos.1.id', $first->id);
    }

    public function test_an_external_marketplace_vehicle_is_not_listed(): void
    {
        $dealer = Concesionaria::factory()->active()->create();
        Vehiculo::factory()->create(['origen' => 'externo', 'combustible' => 'nafta', 'transmision' => 'manual']);

        $this->actingAs($dealer->usuario)->getJson(self::URL)->assertOk()->assertJsonCount(0, 'vehiculos');
    }

    public function test_a_vehicle_with_the_dealer_origin_but_no_ownership_row_is_not_listed(): void
    {
        $dealer = Concesionaria::factory()->active()->create();
        Vehiculo::factory()->create(['origen' => 'concesionaria']);

        $this->actingAs($dealer->usuario)
            ->getJson(self::URL)
            ->assertOk()
            ->assertExactJson(['vehiculos' => []]);
    }

    public function test_each_vehicle_has_the_documented_shape(): void
    {
        Storage::fake(config('filesystems.vehicle_photos_disk'));
        $dealer = Concesionaria::factory()->active()->create();
        $body = TipoCarroceria::query()->firstOrFail();
        $vehiculo = $this->vehicleOf($dealer, [
            'tipo_carroceria_id' => $body->id,
            'precio' => 18500000,
            'descripcion' => 'Impecable.',
        ]);
        $vehiculo->propiedad->update(['patente_normalizada' => 'AB123CD']);
        $second = FotoVehiculo::factory()->create(['vehiculo_id' => $vehiculo->id, 'orden' => 2, 'ubicacion_archivo' => "vehiculos/{$vehiculo->id}/b.png"]);
        $first = FotoVehiculo::factory()->create(['vehiculo_id' => $vehiculo->id, 'orden' => 1, 'ubicacion_archivo' => "vehiculos/{$vehiculo->id}/a.png"]);
        $disk = Storage::disk(config('filesystems.vehicle_photos_disk'));

        $this->actingAs($dealer->usuario)
            ->getJson(self::URL)
            ->assertOk()
            ->assertExactJson(['vehiculos' => [[
                'id' => $vehiculo->id,
                'patente' => 'AB123CD',
                'marca' => $vehiculo->marca,
                'modelo' => $vehiculo->modelo,
                'version' => $vehiculo->version,
                'anio' => $vehiculo->anio,
                'kilometraje' => $vehiculo->kilometraje,
                'precio' => 18500000,
                'moneda' => 'ARS',
                'transmision' => 'manual',
                'combustible' => 'nafta',
                'plazas' => null,
                'motor' => $vehiculo->motor,
                'turbo' => null,
                'potencia' => $vehiculo->potencia,
                'potencia_unidad' => null,
                'consumo_urbano' => null,
                'consumo_ruta' => null,
                'control_estabilidad' => null,
                'frenos_abs' => null,
                'airbags_frontales' => null,
                'airbags_laterales' => null,
                'airbags_cortina' => null,
                'isofix' => null,
                'frenado_autonomo' => null,
                'asistencia_carril' => null,
                'punto_ciego' => null,
                'recordatorio_cinturon' => null,
                'asistencia_velocidad' => null,
                'monitoreo_conductor' => null,
                'volante_regulable' => null,
                'climatizador_bizona' => null,
                'butacas_calefaccionadas' => null,
                'android_auto_apple_carplay' => null,
                'sensores_estacionamiento' => null,
                'velocidad_crucero' => null,
                'camara_retroceso' => null,
                'aire_acondicionado' => null,
                'carroceria' => ['id' => $body->id, 'nombre' => $body->nombre],
                'ubicacion' => $vehiculo->ubicacion,
                'descripcion' => 'Impecable.',
                'fotos' => [
                    ['id' => $first->id, 'url' => $disk->url($first->ubicacion_archivo), 'orden' => 1],
                    ['id' => $second->id, 'url' => $disk->url($second->ubicacion_archivo), 'orden' => 2],
                ],
            ]]]);
    }

    /**
     * TC-45: a pending dealer cannot list the inventory.
     */
    public function test_tc45_pending_dealer_is_forbidden_with_the_pending_message(): void
    {
        $this->actingAs(Concesionaria::factory()->create()->usuario)
            ->getJson(self::URL)
            ->assertForbidden()
            ->assertExactJson(['message' => EnsureDealerIsActive::MESSAGE_PENDING]);
    }

    public function test_buyer_is_forbidden(): void
    {
        $this->actingAs(User::factory()->create()->fresh())
            ->getJson(self::URL)
            ->assertForbidden();
    }

    public function test_guest_is_unauthenticated(): void
    {
        $this->getJson(self::URL)->assertUnauthorized();
    }
}
