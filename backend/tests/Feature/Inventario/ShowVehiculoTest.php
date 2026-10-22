<?php

namespace Tests\Feature\Inventario;

use App\Http\Middleware\EnsureDealerIsActive;
use App\Models\Concesionaria;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * UH21 (RF22, CU-19): a dealer reads one of its own vehicles and nobody else's.
 */
class ShowVehiculoTest extends TestCase
{
    use InteractsWithVehiculos;
    use RefreshDatabase;

    private const URL = '/api/concesionaria/vehiculos';

    public function test_dealer_reads_its_own_vehicle_with_the_documented_shape(): void
    {
        $dealer = Concesionaria::factory()->active()->create();
        $vehiculo = $this->vehicleOf($dealer, 7, 'AB123CD');

        $this->actingAs($dealer->usuario)
            ->getJson(self::URL.'/'.$vehiculo->id)
            ->assertOk()
            ->assertJsonStructure(['vehiculo' => [
                'id', 'patente', 'marca', 'modelo', 'version', 'anio', 'kilometraje', 'precio', 'moneda',
                'transmision', 'combustible', 'carroceria', 'ubicacion', 'descripcion',
                'fotos' => [['id', 'url', 'orden']],
            ]])
            ->assertJsonPath('vehiculo.id', $vehiculo->id)
            ->assertJsonPath('vehiculo.patente', 'AB123CD')
            ->assertJsonCount(7, 'vehiculo.fotos');
    }

    /**
     * TC-57: asking for a vehicle of another dealer is denied without revealing that it exists.
     */
    public function test_tc57_vehicle_of_another_dealer_is_not_found(): void
    {
        $other = Concesionaria::factory()->active()->create();
        $vehiculo = $this->vehicleOf($other);

        $this->actingAs($this->dealer())
            ->getJson(self::URL.'/'.$vehiculo->id)
            ->assertNotFound();
    }

    public function test_unknown_vehicle_is_not_found(): void
    {
        $this->actingAs($this->dealer())
            ->getJson(self::URL.'/999999')
            ->assertNotFound();
    }

    /**
     * TC-45: only approved dealers manage inventory.
     */
    public function test_tc45_pending_dealer_is_forbidden_with_the_pending_message(): void
    {
        $this->actingAs(Concesionaria::factory()->create()->usuario)
            ->getJson(self::URL.'/1')
            ->assertForbidden()
            ->assertExactJson(['message' => EnsureDealerIsActive::MESSAGE_PENDING]);
    }

    public function test_buyer_is_forbidden(): void
    {
        $this->actingAs(User::factory()->create()->fresh())
            ->getJson(self::URL.'/1')
            ->assertForbidden();
    }

    public function test_guest_is_unauthenticated(): void
    {
        $this->getJson(self::URL.'/1')->assertUnauthorized();
    }
}
