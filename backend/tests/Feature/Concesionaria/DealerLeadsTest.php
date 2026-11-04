<?php

namespace Tests\Feature\Concesionaria;

use App\Models\Concesionaria;
use App\Models\User;
use App\Models\VehiculoConcesionaria;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class DealerLeadsTest extends TestCase
{
    use RefreshDatabase;

    private const ENDPOINT = '/api/concesionaria/leads';

    private function lead(int $vehicle, string $date): void
    {
        DB::table('lead')->insert(['vehiculo_concesionaria_id' => $vehicle, 'generado_en' => $date]);
    }

    public function test_tc67_counts_only_the_owners_contacts_in_the_selected_period_and_ranks_vehicles(): void
    {
        $this->travelTo(now()->setDate(2026, 10, 29)->setTime(12, 0));
        $dealer = Concesionaria::factory()->create();
        $first = VehiculoConcesionaria::factory()->create(['concesionaria_id' => $dealer->id, 'visible' => false]);
        $second = VehiculoConcesionaria::factory()->create(['concesionaria_id' => $dealer->id]);
        $zero = VehiculoConcesionaria::factory()->create(['concesionaria_id' => $dealer->id]);
        $other = VehiculoConcesionaria::factory()->create();
        foreach (['2026-09-30 23:59:59', '2026-10-01 00:00:00', '2026-10-26 00:00:00', '2026-10-29 12:00:00'] as $date) {
            $this->lead($first->vehiculo_id, $date);
        }
        $this->lead($second->vehiculo_id, '2026-10-25 23:59:59');
        $this->lead($other->vehiculo_id, '2026-10-28 12:00:00');
        $this->lead($second->vehiculo_id, '2026-11-01 00:00:00');
        $this->actingAs($dealer->usuario);

        foreach (['week' => [2, 2, 0], 'month' => [4, 3, 1], 'all' => [5, 4, 1]] as $period => [$total, $top, $next]) {
            $response = $this->getJson(self::ENDPOINT."?period={$period}&concesionaria_id={$other->concesionaria_id}")
                ->assertOk()->assertHeader('Cache-Control', 'no-store, private')
                ->assertJsonPath('period', $period)->assertJsonPath('total', $total)->assertJsonCount(3, 'vehicles')
                ->assertJsonPath('vehicles.0.id', $first->vehiculo_id)->assertJsonPath('vehicles.0.leads', $top);
            $this->assertSame($next, collect($response->json('vehicles'))->firstWhere('id', $second->vehiculo_id)['leads']);
            $this->assertSame(0, collect($response->json('vehicles'))->firstWhere('id', $zero->vehiculo_id)['leads']);
        }
        $this->getJson(self::ENDPOINT)->assertOk()->assertJsonPath('period', 'month');
        $this->assertDatabaseCount('lead', 7);
    }

    public function test_tc68_empty_period_and_empty_inventory_return_zero_without_errors(): void
    {
        $dealer = Concesionaria::factory()->create();
        $this->actingAs($dealer->usuario)->getJson(self::ENDPOINT)->assertOk()
            ->assertExactJson(['period' => 'month', 'total' => 0, 'vehicles' => []]);
        $vehicle = VehiculoConcesionaria::factory()->create(['concesionaria_id' => $dealer->id]);
        $this->lead($vehicle->vehiculo_id, now()->subYears(2)->toDateTimeString());
        $this->getJson(self::ENDPOINT)->assertOk()->assertJsonPath('total', 0)->assertJsonPath('vehicles.0.leads', 0);
    }

    public function test_leads_require_the_authenticated_dealer_and_reject_invalid_periods(): void
    {
        $this->getJson(self::ENDPOINT)->assertUnauthorized();
        foreach (['comprador', 'administrador', 'concesionaria'] as $role) {
            $this->actingAs(User::factory()->create(['rol' => $role]))->getJson(self::ENDPOINT)->assertForbidden();
        }
        $dealer = Concesionaria::factory()->create();
        $this->actingAs($dealer->usuario);
        foreach (['invalid', 'week&period[]=month'] as $period) {
            $this->getJson(self::ENDPOINT."?period={$period}")->assertUnprocessable()->assertJsonValidationErrors('period');
        }
    }
}
