<?php

namespace Tests\Feature\Inventario;

use App\Http\Middleware\EnsureDealerIsActive;
use App\Models\Concesionaria;
use App\Models\User;
use App\Models\Vehiculo;
use App\Models\VehiculoConcesionaria;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * UH21 (RF22, CU-19): a dealer edits the data of its own vehicle.
 */
class UpdateVehiculoTest extends TestCase
{
    use InteractsWithVehiculos;
    use RefreshDatabase;

    private const URL = '/api/concesionaria/vehiculos';

    /**
     * The edit form sends every field again; photos are only sent when they change.
     *
     * @param  array<string, mixed>  $overrides
     * @return array<string, mixed>
     */
    private function fields(array $overrides = []): array
    {
        $payload = $this->payload([
            'marca' => 'Ford',
            'modelo' => 'Focus',
            'version' => null,
            'anio' => 2019,
            'kilometraje' => 80000,
            'precio' => 18000000,
            'transmision' => 'manual',
            'combustible' => 'diesel',
            'ubicacion' => 'Rosario',
            'descripcion' => 'Service al día.',
            ...$overrides,
        ]);
        unset($payload['fotos']);

        return $payload;
    }

    public function test_dealer_updates_its_vehicle_and_the_plate_is_normalized(): void
    {
        $dealer = Concesionaria::factory()->active()->create();
        $vehiculo = $this->vehicleOf($dealer);

        $this->actingAs($dealer->usuario)
            ->post(self::URL.'/'.$vehiculo->id, $this->fields(['patente' => 'cd-456 ef']), ['Accept' => 'application/json'])
            ->assertOk()
            ->assertJsonPath('vehiculo.id', $vehiculo->id)
            ->assertJsonPath('vehiculo.patente', 'CD456EF')
            ->assertJsonPath('vehiculo.marca', 'Ford')
            ->assertJsonPath('vehiculo.modelo', 'Focus')
            ->assertJsonPath('vehiculo.version', null)
            ->assertJsonPath('vehiculo.anio', 2019)
            ->assertJsonPath('vehiculo.kilometraje', 80000)
            ->assertJsonPath('vehiculo.precio', 18000000)
            ->assertJsonPath('vehiculo.transmision', 'manual')
            ->assertJsonPath('vehiculo.combustible', 'diesel')
            ->assertJsonPath('vehiculo.ubicacion', 'Rosario')
            ->assertJsonPath('vehiculo.descripcion', 'Service al día.')
            ->assertJsonCount(7, 'vehiculo.fotos');

        $this->assertSame('Ford', Vehiculo::query()->findOrFail($vehiculo->id)->marca);
        $this->assertSame('CD456EF', VehiculoConcesionaria::query()->findOrFail($vehiculo->id)->patente_normalizada);
    }

    public function test_keeping_the_same_plate_passes(): void
    {
        $dealer = Concesionaria::factory()->active()->create();
        $vehiculo = $this->vehicleOf($dealer, 7, 'AB123CD');

        $this->actingAs($dealer->usuario)
            ->post(self::URL.'/'.$vehiculo->id, $this->fields(['patente' => 'ab 123 cd']), ['Accept' => 'application/json'])
            ->assertOk()
            ->assertJsonPath('vehiculo.patente', 'AB123CD');
    }

    public function test_plate_of_another_vehicle_is_rejected(): void
    {
        $dealer = Concesionaria::factory()->active()->create();
        $vehiculo = $this->vehicleOf($dealer, 7, 'AB123CD');
        $this->vehicleOf(Concesionaria::factory()->active()->create(), 7, 'ZZ999ZZ');

        $this->actingAs($dealer->usuario)
            ->post(self::URL.'/'.$vehiculo->id, $this->fields(['patente' => 'ZZ999ZZ']), ['Accept' => 'application/json'])
            ->assertUnprocessable()
            ->assertJsonPath('errors.patente.0', 'Esa patente ya está cargada en la plataforma.');

        $this->assertSame('AB123CD', VehiculoConcesionaria::query()->findOrFail($vehiculo->id)->patente_normalizada);
    }

    public function test_invalid_values_are_rejected_with_the_shared_messages(): void
    {
        $dealer = Concesionaria::factory()->active()->create();
        $vehiculo = $this->vehicleOf($dealer);

        $this->actingAs($dealer->usuario)
            ->post(self::URL.'/'.$vehiculo->id, $this->fields(['marca' => '', 'anio' => 1900]), ['Accept' => 'application/json'])
            ->assertUnprocessable()
            ->assertJsonPath('errors.marca.0', 'Indicá la marca.')
            ->assertJsonValidationErrors(['anio']);
    }

    /**
     * TC-57: editing a vehicle of another dealer is denied and changes nothing.
     */
    public function test_tc57_vehicle_of_another_dealer_is_not_found_and_stays_untouched(): void
    {
        $other = Concesionaria::factory()->active()->create();
        $vehiculo = $this->vehicleOf($other, 7, 'AB123CD');
        $before = Vehiculo::query()->findOrFail($vehiculo->id)->toArray();

        $this->actingAs($this->dealer())
            ->post(self::URL.'/'.$vehiculo->id, $this->fields(['patente' => 'CD456EF']), ['Accept' => 'application/json'])
            ->assertNotFound();

        $this->assertSame($before, Vehiculo::query()->findOrFail($vehiculo->id)->toArray());
        $this->assertSame('AB123CD', VehiculoConcesionaria::query()->findOrFail($vehiculo->id)->patente_normalizada);
    }

    public function test_unknown_vehicle_is_not_found(): void
    {
        $this->actingAs($this->dealer())
            ->post(self::URL.'/999999', $this->fields(), ['Accept' => 'application/json'])
            ->assertNotFound();
    }

    /**
     * TC-45: only approved dealers manage inventory.
     */
    public function test_tc45_pending_dealer_is_forbidden_with_the_pending_message(): void
    {
        $this->actingAs(Concesionaria::factory()->create()->usuario)
            ->post(self::URL.'/1', $this->fields(), ['Accept' => 'application/json'])
            ->assertForbidden()
            ->assertExactJson(['message' => EnsureDealerIsActive::MESSAGE_PENDING]);
    }

    public function test_buyer_is_forbidden(): void
    {
        $this->actingAs(User::factory()->create()->fresh())
            ->post(self::URL.'/1', $this->fields(), ['Accept' => 'application/json'])
            ->assertForbidden();
    }

    public function test_guest_is_unauthenticated(): void
    {
        $this->postJson(self::URL.'/1', [])->assertUnauthorized();
    }
}
