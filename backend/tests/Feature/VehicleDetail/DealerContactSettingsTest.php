<?php

namespace Tests\Feature\VehicleDetail;

use App\Models\Concesionaria;
use App\Models\Suscripcion;
use App\Models\User;
use App\Models\Vehiculo;
use App\Models\VehiculoConcesionaria;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DealerContactSettingsTest extends TestCase
{
    use RefreshDatabase;

    private const ENDPOINT = '/api/concesionaria/contacto';

    public function test_dealer_can_read_edit_and_clear_only_its_existing_public_phone(): void
    {
        $dealer = Concesionaria::factory()->create();
        $other = Concesionaria::factory()->create(['telefono_publico' => '5491155550202']);
        $original = $dealer->fresh()->getAttributes();
        $this->actingAs($dealer->usuario);
        $this->getJson(self::ENDPOINT)->assertOk()->assertExactJson(['telefono_publico' => $dealer->telefono_publico]);
        $this->putJson(self::ENDPOINT, ['telefono_publico' => '+54 (9) 11 5555-0101', 'concesionaria_id' => $other->id,
            'nombre' => 'Changed', 'usuario_id' => $other->usuario_id])->assertOk()
            ->assertExactJson(['telefono_publico' => '5491155550101']);
        $this->assertSame(array_replace($original, ['telefono_publico' => '5491155550101']), $dealer->fresh()->getAttributes());
        $this->assertSame('5491155550202', $other->fresh()->telefono_publico);
        $this->putJson(self::ENDPOINT, ['telefono_publico' => ''])->assertOk()->assertJsonPath('telefono_publico', null);
        $this->assertNull($dealer->fresh()->telefono_publico);
    }

    public function test_contact_settings_require_an_authenticated_dealer_with_its_own_dealer_record(): void
    {
        $this->getJson(self::ENDPOINT)->assertUnauthorized();
        $this->putJson(self::ENDPOINT, ['telefono_publico' => '5491155550101'])->assertUnauthorized();
        $dealer = Concesionaria::factory()->create();
        foreach (['comprador', 'administrador', 'concesionaria'] as $role) {
            $this->actingAs(User::factory()->create(['rol' => $role]));
            $this->getJson(self::ENDPOINT)->assertForbidden();
            $this->putJson(self::ENDPOINT, ['telefono_publico' => '5491155550101', 'concesionaria_id' => $dealer->id])->assertForbidden();
        }
        $this->assertSame($dealer->telefono_publico, $dealer->fresh()->telefono_publico);
    }

    public function test_invalid_phone_updates_leave_the_saved_public_phone_unchanged(): void
    {
        $dealer = Concesionaria::factory()->create();
        $this->actingAs($dealer->usuario);
        foreach ([[], ['telefono_publico' => '123'], ['telefono_publico' => 'javascript:alert(1)'],
            ['telefono_publico' => 5491155550101], ['telefono_publico' => str_repeat('1', 31)]] as $payload) {
            $this->putJson(self::ENDPOINT, $payload)->assertUnprocessable()->assertJsonValidationErrors('telefono_publico');
            $this->assertSame($dealer->telefono_publico, $dealer->fresh()->telefono_publico);
        }
    }

    public function test_tc65_tc66_contact_uses_the_current_public_phone_without_environment_confirmation(): void
    {
        config(['whatsapp.confirmed_numbers' => []]);
        $dealer = Concesionaria::factory()->active()->create(['telefono_publico' => '5491155550101']);
        Suscripcion::factory()->create(['concesionaria_id' => $dealer->id, 'estado' => 'activa', 'vigente_hasta' => now()->addMonth()]);
        $vehicle = Vehiculo::factory()->create();
        VehiculoConcesionaria::factory()->create(['vehiculo_id' => $vehicle->id, 'concesionaria_id' => $dealer->id]);
        $buyer = User::factory()->create(['rol' => 'comprador']);
        $endpoint = "/api/vehiculos/{$vehicle->id}/contacto";
        $this->actingAs($buyer)->getJson("/api/vehiculos/{$vehicle->id}")->assertOk()->assertJsonPath('whatsapp_available', true);
        $this->postJson($endpoint)->assertCreated()->assertJsonPath('url', fn ($url) => str_starts_with($url, 'https://wa.me/5491155550101?'));
        $this->actingAs($dealer->usuario)->putJson(self::ENDPOINT, ['telefono_publico' => '+54 9 11 5555-0202'])->assertOk();
        $this->actingAs($buyer)->postJson($endpoint)->assertCreated()->assertJsonPath('url', fn ($url) => str_starts_with($url, 'https://wa.me/5491155550202?'));
        $this->assertDatabaseCount('lead', 2);
        $this->actingAs($dealer->usuario)->putJson(self::ENDPOINT, ['telefono_publico' => null])->assertOk();
        $this->actingAs($buyer)->postJson($endpoint)->assertConflict();
        $this->getJson("/api/vehiculos/{$vehicle->id}")->assertOk()->assertJsonPath('whatsapp_available', false);
        $this->assertDatabaseCount('lead', 2);
    }
}
