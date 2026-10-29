<?php

namespace Tests\Feature\VehicleDetail;

use App\Models\Concesionaria;
use App\Models\Suscripcion;
use App\Models\User;
use App\Models\Vehiculo;
use App\Models\VehiculoConcesionaria;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class BuyerVehicleContactTest extends TestCase
{
    use RefreshDatabase;

    private function listing(): Vehiculo
    {
        config(['whatsapp.confirmed_numbers' => ['5491155550101']]);
        $dealer = Concesionaria::factory()->active()->create(['telefono_publico' => '+54 9 11 5555-0101']);
        Suscripcion::factory()->create(['concesionaria_id' => $dealer->id, 'estado' => 'activa',
            'vigente_hasta' => now()->addMonth()->toDateString()]);
        $vehicle = Vehiculo::factory()->create(['marca' => 'Citroën', 'modelo' => 'C4',
            'version' => 'Feel & Pack', 'anio' => 2021, 'kilometraje' => 62000]);
        VehiculoConcesionaria::factory()->create(['vehiculo_id' => $vehicle->id,
            'concesionaria_id' => $dealer->id, 'patente_normalizada' => 'AB123CD']);

        return $vehicle;
    }

    public function test_tc65_and_tc66_contact_uses_current_facts_and_persists_before_any_message_is_sent(): void
    {
        Http::preventStrayRequests();
        $vehicle = $this->listing();
        $buyer = User::factory()->state(['rol' => User::ROL_COMPRADOR])->create(['name' => 'María José', 'apellido' => 'Pérez Díaz']);
        $this->actingAs($buyer);
        $this->getJson("/api/vehiculos/{$vehicle->id}")->assertOk()->assertJsonPath('whatsapp_available', true)
            ->assertJsonMissingPath('vehicle.patente')->assertJsonMissingPath('dealer.telefono_publico');
        $this->assertDatabaseCount('lead', 0);
        $response = $this->postJson("/api/vehiculos/{$vehicle->id}/contacto", [
            'comprador_usuario_id' => 99999, 'telefono' => '5491155550999', 'patente' => 'FALSE',
        ])->assertCreated()->assertHeader('Cache-Control', 'no-store, private');
        $url = $response->json('url');
        $this->assertSame('https', parse_url($url, PHP_URL_SCHEME));
        $this->assertSame('wa.me', parse_url($url, PHP_URL_HOST));
        $this->assertSame('/5491155550101', parse_url($url, PHP_URL_PATH));
        parse_str(parse_url($url, PHP_URL_QUERY), $query);
        $this->assertSame('¿Qué tal? Mi nombre es María José Pérez Díaz. Me interesa el Citroën C4 Feel & Pack 2021, con 62.000 km y patente AB123CD. Quisiera recibir más información.', $query['text']);
        $this->assertDatabaseCount('lead', 1);
        $this->assertDatabaseHas('lead', ['comprador_usuario_id' => $buyer->id, 'vehiculo_concesionaria_id' => $vehicle->id]);
        $this->assertNotNull(DB::table('lead')->value('generado_en'));
        Http::assertNothingSent();
    }

    public function test_unconfirmed_or_invalid_numbers_cannot_record_leads(): void
    {
        $vehicle = $this->listing();
        $this->actingAs(User::factory()->state(['rol' => User::ROL_COMPRADOR])->create());
        foreach ([null, '123', 'javascript:alert(1)', '5491155550999'] as $phone) {
            $vehicle->propiedad->concesionaria->update(['telefono_publico' => $phone]);
            $this->getJson("/api/vehiculos/{$vehicle->id}")->assertOk()->assertJsonPath('whatsapp_available', false);
            $this->postJson("/api/vehiculos/{$vehicle->id}/contacto")->assertConflict();
            $this->assertDatabaseCount('lead', 0);
        }
    }

    public function test_only_buyers_can_contact_available_dealership_listings(): void
    {
        $vehicle = $this->listing();
        $url = "/api/vehiculos/{$vehicle->id}/contacto";
        $this->postJson($url)->assertUnauthorized();
        foreach ([User::ROL_CONCESIONARIA, User::ROL_ADMINISTRADOR] as $role) {
            $this->actingAs(User::factory()->state(['rol' => User::ROL_COMPRADOR])->create(['rol' => $role]))->postJson($url)->assertForbidden();
        }
        $this->actingAs(User::factory()->state(['rol' => User::ROL_COMPRADOR])->create());
        $vehicle->propiedad->update(['visible' => false]);
        $this->postJson($url)->assertNotFound();
        $vehicle->propiedad->update(['visible' => true]);
        $subscription = $vehicle->propiedad->concesionaria->suscripcion;
        $subscription->update(['vigente_hasta' => now()->subDays(4)->toDateString()]);
        $this->postJson($url)->assertNotFound();
        $subscription->update(['vigente_hasta' => now()->addMonth()->toDateString()]);
        $vehicle->propiedad->concesionaria->forceFill(['estado_alta' => 'pendiente'])->save();
        $this->postJson($url)->assertNotFound();
        $vehicle->propiedad->concesionaria->forceFill(['estado_alta' => 'activa'])->save();
        $vehicle->update(['origen' => 'externo']);
        $this->postJson($url)->assertNotFound();
        $this->postJson('/api/vehiculos/999999/contacto')->assertNotFound();
        $this->assertDatabaseCount('lead', 0);
    }

    public function test_removing_confirmation_disables_contact_without_modifying_public_phone(): void
    {
        $vehicle = $this->listing();
        config(['whatsapp.confirmed_numbers' => []]);
        $this->actingAs(User::factory()->create(['rol' => User::ROL_COMPRADOR]));
        $this->getJson("/api/vehiculos/{$vehicle->id}")->assertOk()->assertJsonPath('whatsapp_available', false);
        $this->postJson("/api/vehiculos/{$vehicle->id}/contacto")->assertConflict();
        $this->assertDatabaseCount('lead', 0);
        $this->assertSame('+54 9 11 5555-0101', $vehicle->propiedad->concesionaria->telefono_publico);
    }

    public function test_unknown_mileage_and_plate_are_omitted_instead_of_invented(): void
    {
        $vehicle = $this->listing();
        $vehicle->update(['kilometraje' => null, 'version' => null]);
        $vehicle->propiedad->update(['patente_normalizada' => null]);
        $url = $this->actingAs(User::factory()->state(['rol' => User::ROL_COMPRADOR])->create(['name' => 'Ana', 'apellido' => null]))
            ->postJson("/api/vehiculos/{$vehicle->id}/contacto")->assertCreated()->json('url');
        parse_str(parse_url($url, PHP_URL_QUERY), $query);
        $this->assertSame('¿Qué tal? Mi nombre es Ana. Me interesa el Citroën C4 2021. Quisiera recibir más información.', $query['text']);
        $this->assertDatabaseCount('lead', 1);
    }

    public function test_retry_after_a_lost_response_records_one_lead_but_new_attempts_remain_independent(): void
    {
        $vehicle = $this->listing();
        $buyer = User::factory()->create(['rol' => User::ROL_COMPRADOR]);
        $this->actingAs($buyer);
        $endpoint = "/api/vehiculos/{$vehicle->id}/contacto";
        $attempt = ['attempt_id' => 'e632c7df-1411-448f-82b1-e65ad9a760ac'];
        $url = $this->postJson($endpoint, $attempt)->assertCreated()->json('url');
        // The first response is lost in transit; the retry carries the same attempt.
        $this->postJson($endpoint, $attempt)->assertCreated()->assertJsonPath('url', $url);
        $this->assertDatabaseCount('lead', 1);
        $this->postJson($endpoint, ['attempt_id' => '55ae1dbf-75ec-4c49-a2a5-7e5668d66b07'])->assertCreated();
        $this->assertDatabaseCount('lead', 2);
        $this->actingAs(User::factory()->create(['rol' => User::ROL_COMPRADOR]))
            ->postJson($endpoint, $attempt)->assertCreated();
        $this->assertDatabaseCount('lead', 3);
        $vehicle->propiedad->update(['visible' => false]);
        $this->actingAs($buyer)->postJson($endpoint, $attempt)->assertNotFound();
        $this->assertDatabaseCount('lead', 3);
    }

    public function test_failed_lead_write_rolls_back_the_attempt_so_a_retry_can_succeed(): void
    {
        $vehicle = $this->listing();
        $this->actingAs(User::factory()->create(['rol' => User::ROL_COMPRADOR]));
        $endpoint = "/api/vehiculos/{$vehicle->id}/contacto";
        $attempt = ['attempt_id' => 'e632c7df-1411-448f-82b1-e65ad9a760ac'];
        DB::statement("CREATE TRIGGER reject_contact BEFORE INSERT ON lead BEGIN SELECT RAISE(ABORT, 'write failed'); END");
        $this->postJson($endpoint, $attempt)->assertStatus(500);
        $this->assertDatabaseCount('lead', 0);
        $this->assertSame(0, DB::table('cache')->where('key', 'like', 'whatsapp-contact:%')->count());
        DB::statement('DROP TRIGGER reject_contact');
        $this->postJson($endpoint, $attempt)->assertCreated();
        $this->assertDatabaseCount('lead', 1);
        $this->postJson($endpoint, ['attempt_id' => 'invalid'])->assertUnprocessable();
        $this->assertDatabaseCount('lead', 1);
    }
}
