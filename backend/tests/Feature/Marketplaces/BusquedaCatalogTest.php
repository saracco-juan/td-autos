<?php

namespace Tests\Feature\Marketplaces;

use App\Models\Concesionaria;
use App\Models\FotoVehiculo;
use App\Models\Suscripcion;
use App\Models\User;
use App\Models\Vehiculo;
use App\Models\VehiculoConcesionaria;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class BusquedaCatalogTest extends TestCase
{
    use RefreshDatabase;

    private const URL = '/api/busqueda';

    private function dealer(int $days = 30, string $name = 'Autos del Sur', string $status = Concesionaria::ESTADO_ACTIVA): Concesionaria
    {
        $dealer = Concesionaria::factory()->create(['nombre' => $name, 'estado_alta' => $status, 'provincia' => 'Córdoba']);
        Suscripcion::factory()->create([
            'concesionaria_id' => $dealer->id,
            'estado' => Suscripcion::ESTADO_ACTIVA,
            'vigente_desde' => now()->subDays(60)->toDateString(),
            'vigente_hasta' => now()->addDays($days)->toDateString(),
        ]);

        return $dealer;
    }

    private function dealerVehicle(Concesionaria $dealer, array $attributes = [], bool $visible = true): Vehiculo
    {
        $vehicle = Vehiculo::factory()->create($attributes);
        VehiculoConcesionaria::factory()->create([
            'vehiculo_id' => $vehicle->id,
            'concesionaria_id' => $dealer->id,
            'visible' => $visible,
        ]);

        return $vehicle;
    }

    private function search(string $query = ''): array
    {
        return $this->actingAs(User::factory()->create())->getJson(self::URL.$query)->assertOk()->json('publicaciones');
    }

    public function test_only_visible_vehicles_of_eligible_dealers_are_returned(): void
    {
        $active = $this->dealer();
        $this->dealerVehicle($active, ['modelo' => 'Visible']);
        $this->dealerVehicle($active, ['modelo' => 'Hidden'], visible: false);
        $this->dealerVehicle($this->dealer(days: -10, name: 'Expired'), ['modelo' => 'Expired']);
        $this->dealerVehicle($this->dealer(status: Concesionaria::ESTADO_PENDIENTE, name: 'Pending'), ['modelo' => 'Pending']);
        $this->dealerVehicle(Concesionaria::factory()->active()->create(), ['modelo' => 'NoSubscription']);

        $this->assertSame(['Visible'], array_column($this->search(), 'modelo'));
    }

    public function test_a_dealer_in_its_grace_period_still_appears(): void
    {
        $this->dealerVehicle($this->dealer(days: -2), ['modelo' => 'InGrace']);

        $this->assertSame(['InGrace'], array_column($this->search(), 'modelo'));
    }

    public function test_q_matches_every_word_case_and_accents_and_treats_wildcards_literally(): void
    {
        $dealer = $this->dealer();
        $this->dealerVehicle($dealer, ['marca' => 'Toyota', 'modelo' => 'Corolla', 'version' => 'XEI']);
        $this->dealerVehicle($dealer, ['marca' => 'Ford', 'modelo' => 'Focus', 'version' => 'SE']);
        $this->dealerVehicle($dealer, ['marca' => 'Citroën', 'modelo' => 'C4', 'version' => 'Feel']);

        $this->assertSame(['Corolla'], array_column($this->search('?q=TOYOTA+corolla'), 'modelo'));
        $this->assertSame([], $this->search('?q=toyota+focus'));
        $this->assertSame(['C4'], array_column($this->search('?q='.urlencode('citroën')), 'modelo'));
        $this->assertSame([], $this->search('?q=%25'));
    }

    public function test_pagination_meta_order_and_page_validation_are_preserved(): void
    {
        $dealer = $this->dealer();
        foreach (range(1, 5) as $i) {
            $this->dealerVehicle($dealer, ['modelo' => "M$i"]);
        }
        $user = User::factory()->create();

        $first = $this->actingAs($user)->getJson(self::URL.'?per_page=2')->assertOk();
        $first->assertJsonPath('meta', ['page' => 1, 'per_page' => 2, 'total' => 5, 'last_page' => 3]);
        $this->assertSame(['M5', 'M4'], array_column($first->json('publicaciones'), 'modelo'));
        $this->actingAs($user)->getJson(self::URL.'?per_page=2&page=3')->assertOk()->assertJsonPath('meta.page', 3);
        $this->actingAs($user)->getJson(self::URL)->assertOk()->assertJsonPath('meta.per_page', 24);

        foreach (['page=0', 'page=abc', 'per_page=0', 'per_page=61', 'per_page=x'] as $query) {
            $this->actingAs($user)->getJson(self::URL.'?'.$query)->assertUnprocessable();
        }
        $this->actingAs($user)->getJson(self::URL.'?per_page=60')->assertOk();
    }

    public function test_a_page_costs_a_handful_of_queries_regardless_of_catalog_size(): void
    {
        $dealer = $this->dealer();
        Vehiculo::factory()->count(200)->create()->each(function (Vehiculo $vehicle) use ($dealer): void {
            VehiculoConcesionaria::factory()->create(['vehiculo_id' => $vehicle->id, 'concesionaria_id' => $dealer->id]);
            FotoVehiculo::factory()->create(['vehiculo_id' => $vehicle->id, 'orden' => 1]);
        });
        $user = User::factory()->create();

        DB::enableQueryLog();
        $this->actingAs($user)->getJson(self::URL.'?q=a&per_page=24&page=2')->assertOk();
        $queries = count(DB::getQueryLog());
        DB::disableQueryLog();

        $this->assertLessThanOrEqual(10, $queries);
    }
}
