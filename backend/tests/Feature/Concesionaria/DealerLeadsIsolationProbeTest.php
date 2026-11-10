<?php

namespace Tests\Feature\Concesionaria;

use App\Models\Concesionaria;
use App\Models\Suscripcion;
use App\Models\User;
use App\Models\VehiculoConcesionaria;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class DealerLeadsIsolationProbeTest extends TestCase
{
    use RefreshDatabase;

    public function test_real_contact_is_counted_by_the_inventory_primary_key_and_a_vehicle_cannot_have_two_owners(): void
    {
        $dealer = Concesionaria::factory()->active()->create(['telefono_publico' => '5491155550101']);
        $other = Concesionaria::factory()->create();
        Suscripcion::factory()->create(['concesionaria_id' => $dealer->id, 'estado' => 'activa',
            'vigente_hasta' => now()->addMonth()]);
        $listing = VehiculoConcesionaria::factory()->create(['concesionaria_id' => $dealer->id]);
        $buyer = User::factory()->create(['rol' => User::ROL_COMPRADOR]);

        $this->actingAs($buyer)->postJson('/api/vehiculos/'.$listing->vehiculo_id.'/contacto')->assertCreated();
        $this->assertDatabaseHas('lead', ['vehiculo_concesionaria_id' => $listing->getKey()]);
        $this->actingAs($dealer->usuario)->getJson('/api/concesionaria/leads?period=all')
            ->assertOk()->assertJsonPath('total', 1)->assertJsonPath('vehicles.0.id', $listing->getKey())
            ->assertJsonPath('vehicles.0.leads', 1);
        $this->actingAs($other->usuario)->getJson('/api/concesionaria/leads?period=all')
            ->assertOk()->assertJsonPath('total', 0)->assertJsonCount(0, 'vehicles');

        try {
            DB::transaction(fn () => DB::table('vehiculo_concesionaria')->insert([
                'vehiculo_id' => $listing->vehiculo_id, 'concesionaria_id' => $other->id,
                'visible' => true,
            ]));
            $this->fail('The inventory primary key must reject a vehicle shared across dealers.');
        } catch (QueryException) {
            $this->assertDatabaseCount('vehiculo_concesionaria', 1);
            $this->assertDatabaseHas('vehiculo_concesionaria', [
                'vehiculo_id' => $listing->vehiculo_id, 'concesionaria_id' => $dealer->id,
            ]);
        }
        $this->assertDatabaseCount('lead', 1);
    }

    public function test_spoofed_dealer_and_rejected_period_never_cross_tenants_or_mutate_leads(): void
    {
        $this->travelTo(now()->setDate(2026, 10, 29)->setTime(12, 0));
        $mine = Concesionaria::factory()->create();
        $theirs = Concesionaria::factory()->create();
        $myCar = VehiculoConcesionaria::factory()->create(['concesionaria_id' => $mine->id]);
        $theirCar = VehiculoConcesionaria::factory()->create(['concesionaria_id' => $theirs->id]);
        DB::table('lead')->insert([
            ['vehiculo_concesionaria_id' => $myCar->vehiculo_id, 'generado_en' => '2026-10-29 10:00:00'],
            ['vehiculo_concesionaria_id' => $theirCar->vehiculo_id, 'generado_en' => '2026-10-29 11:00:00'],
            ['vehiculo_concesionaria_id' => $theirCar->vehiculo_id, 'generado_en' => '2026-10-29 11:30:00'],
        ]);
        $hash = fn () => hash('sha256', DB::table('lead')->orderBy('id')->get()->toJson());
        $before = $hash();

        $this->actingAs($mine->usuario);
        $response = $this->getJson('/api/concesionaria/leads?period=week&concesionaria_id='.$theirs->id)
            ->assertOk()->assertJsonPath('total', 1)->assertJsonCount(1, 'vehicles')
            ->assertJsonPath('vehicles.0.id', $myCar->vehiculo_id);
        $this->assertNotContains($theirCar->vehiculo_id, array_column($response->json('vehicles'), 'id'));
        $this->assertSame($before, $hash());

        $this->getJson('/api/concesionaria/leads?period[]=week&concesionaria_id='.$theirs->id)
            ->assertUnprocessable()->assertJsonValidationErrors('period');
        $this->assertSame($before, $hash());

        $this->actingAs($theirs->usuario)->getJson('/api/concesionaria/leads?period=week&concesionaria_id='.$mine->id)
            ->assertOk()->assertJsonPath('total', 2)->assertJsonCount(1, 'vehicles')
            ->assertJsonPath('vehicles.0.id', $theirCar->vehiculo_id);
        $this->assertSame($before, $hash());
    }
}
