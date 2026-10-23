<?php

namespace Tests\Feature\Calculadora;

use App\Models\Concesionaria;
use App\Models\Diagnostico;
use App\Models\Suscripcion;
use App\Models\User;
use App\Models\Vehiculo;
use App\Models\VehiculoConcesionaria;
use App\Support\VehiculoFields;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Factory;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class OwnershipCostsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['cache.default' => 'array']);
        Cache::flush();
        Http::preventStrayRequests();
        $this->travelTo(Carbon::parse('2026-10-20T12:00:00Z'));
        $this->fakeRate();
        config(['calculadora' => [
            'updated_at' => '2026-10-01',
            'rounding' => 1000,
            'km_per_month' => ['menos_500' => 500, '500_1500' => 1500, '1500_3000' => 3000, 'mas_3000' => 4500, 'no_sabe' => 1500],
            'fuel_prices' => ['nafta' => 1000, 'diesel' => 900, 'gnc' => 500],
            'insurance_annual_rate' => ['terceros_completo' => 0.06, 'todo_riesgo' => 0.12],
            'transfer' => ['dnrpa_rate' => 0.01, 'fixed_costs' => 100000, 'stamp_rate' => ['cordoba' => 0.02, 'caba' => 0.01]],
            'patente_annual_rate' => ['cordoba' => 0.012, 'caba' => 0.01],
            'maintenance' => [
                'annual_base' => ['nafta' => 600000, 'diesel' => 720000, 'gnc' => 660000, 'hibrido' => 480000, 'electrico' => 360000],
                'age_factors' => [['max' => 3, 'factor' => 1.0], ['max' => 7, 'factor' => 1.2], ['max' => null, 'factor' => 1.5]],
                'km_factors' => [['max' => 30000, 'factor' => 1.0], ['max' => 80000, 'factor' => 1.1], ['max' => null, 'factor' => 1.3]],
                'turbo_factor' => 1.1,
                'automatic_factor' => 1.2,
            ],
        ]]);
    }

    private function fakeRate(?int $sell = 1000): void
    {
        // A fresh factory: stubs registered earlier would win over the new ones.
        Http::swap(new Factory);
        Http::preventStrayRequests();
        Http::fake(['https://dolarapi.com/v1/dolares/oficial' => $sell === null
            ? Http::response([], 500)
            : Http::response(['moneda' => 'USD', 'casa' => 'oficial', 'venta' => $sell, 'fechaActualizacion' => '2026-10-20T12:00:00Z'])]);
    }

    private function buyer(array $changes = [], bool $withDiagnosis = true): User
    {
        $user = User::factory()->create();
        $this->actingAs($user);
        if ($withDiagnosis) {
            $this->putJson('/api/diagnostico', array_replace(['presupuesto' => '15m_25m', 'uso_principal' => 'ciudad',
                'pasajeros' => '3_4', 'kilometros_mensuales' => '500_1500', 'transmision' => 'manual',
                'prioridad' => 'consumo', 'carrocerias' => [1]], $changes))->assertOk();
        }

        return $user;
    }

    private function car(array $changes = [], bool $visible = true, string $province = 'Córdoba'): Vehiculo
    {
        $dealer = Concesionaria::factory()->active()->create(['provincia' => $province]);
        Suscripcion::factory()->create(['concesionaria_id' => $dealer->id, 'estado' => 'activa',
            'vigente_hasta' => now()->addMonth()->toDateString()]);
        $vehicle = Vehiculo::factory()->create(array_replace(array_fill_keys(array_keys(VehiculoFields::EQUIPMENT_FIELDS), true), [
            'tipo_carroceria_id' => 1, 'anio' => 2022, 'kilometraje' => 40000,
            'precio' => 20000000, 'moneda' => 'ARS', 'combustible' => 'nafta', 'transmision' => 'manual',
            'plazas' => 5, 'motor' => '1.6', 'turbo' => false, 'potencia' => 110, 'potencia_unidad' => 'CV',
            'consumo_urbano' => 8, 'consumo_ruta' => 6,
        ], $changes));
        VehiculoConcesionaria::factory()->create(['vehiculo_id' => $vehicle->id, 'concesionaria_id' => $dealer->id, 'visible' => $visible]);

        return $vehicle;
    }

    public function test_requires_authentication(): void
    {
        $this->getJson('/api/vehiculos/1/costos')->assertUnauthorized();
    }

    public function test_estimates_with_the_diagnosis_km_and_budget(): void
    {
        $this->buyer();
        $car = $this->car();

        $this->getJson("/api/vehiculos/{$car->id}/costos")->assertOk()
            ->assertHeader('Cache-Control', 'no-store, private')
            ->assertExactJson([
                'vehicle' => ['id' => $car->id, 'make' => $car->marca, 'model' => $car->modelo, 'version' => $car->version,
                    'year' => 2022, 'province' => 'Córdoba', 'published_price' => 20000000.0, 'published_currency' => 'ARS'],
                'inputs' => ['km_per_month' => 1500, 'km_source' => 'diagnostico', 'coverage' => 'terceros_completo'],
                'purchase' => ['price' => 20000000, 'transfer' => 700000, 'total' => 20700000,
                    'budget' => ['max' => 25000000.0, 'fits' => true, 'difference' => 4300000.0]],
                'monthly' => ['fuel' => 120000, 'insurance' => 100000, 'patente' => 20000, 'maintenance' => 66000,
                    'total' => 306000, 'yearly_total' => 3672000, 'not_estimated' => []],
                'breakdown' => [
                    'fuel' => ['km_per_month' => 1500, 'consumption_l_100km' => 8.0, 'fuel_type' => 'nafta', 'price_fuel_type' => 'nafta',
                        'unit' => 'litro', 'unit_price' => 1000],
                    'insurance' => ['base' => 20000000.0, 'coverage' => 'terceros_completo', 'annual_rate' => 0.06],
                    'patente' => ['base' => 20000000.0, 'province' => 'Córdoba', 'province_known' => true, 'annual_rate' => 0.012],
                    'maintenance' => ['fuel_type' => 'nafta', 'annual_base' => 600000, 'age_years' => 4, 'age_factor' => 1.2,
                        'km' => 40000, 'km_factor' => 1.1, 'turbo_factor' => null, 'automatic_factor' => null],
                    'transfer' => ['base' => 20000000.0, 'dnrpa_rate' => 0.01, 'stamp_rate' => 0.02, 'province' => 'Córdoba',
                        'province_known' => true, 'fixed_costs' => 100000],
                    'rounding' => 1000,
                ],
                'rates_updated_at' => '2026-10-01',
                'exchange_rate' => null,
            ]);
    }

    public function test_budget_exceeded_reports_a_negative_difference(): void
    {
        $this->buyer(['presupuesto' => 'hasta_15m']);
        $car = $this->car();

        $this->getJson("/api/vehiculos/{$car->id}/costos")->assertOk()
            ->assertJsonPath('purchase.budget', ['max' => 15000000, 'fits' => false, 'difference' => -5700000]);
    }

    public function test_no_budget_cap_returns_null_budget(): void
    {
        $this->buyer(['presupuesto' => 'mas_40m']);
        $car = $this->car();

        $this->getJson("/api/vehiculos/{$car->id}/costos")->assertOk()->assertJsonPath('purchase.budget', null);
    }

    public function test_without_diagnosis_uses_default_km_and_no_budget(): void
    {
        $this->buyer(withDiagnosis: false);
        $car = $this->car();

        $this->getJson("/api/vehiculos/{$car->id}/costos")->assertOk()
            ->assertJsonPath('inputs', ['km_per_month' => 1500, 'km_source' => 'default', 'coverage' => 'terceros_completo'])
            ->assertJsonPath('purchase.budget', null);
    }

    public function test_diagnosis_km_band_is_mapped_through_the_config(): void
    {
        $user = $this->buyer();
        Diagnostico::where('usuario_id', $user->id)->update(['kilometros_mensuales' => 'mas_3000']);
        $car = $this->car();

        $this->getJson("/api/vehiculos/{$car->id}/costos")->assertOk()
            ->assertJsonPath('inputs.km_per_month', 4500)->assertJsonPath('inputs.km_source', 'diagnostico');
    }

    public function test_user_km_and_coverage_override_the_defaults(): void
    {
        $this->buyer();
        $car = $this->car();

        $this->getJson("/api/vehiculos/{$car->id}/costos?km=3000&cobertura=todo_riesgo")->assertOk()
            ->assertJsonPath('inputs', ['km_per_month' => 3000, 'km_source' => 'usuario', 'coverage' => 'todo_riesgo'])
            ->assertJsonPath('monthly.fuel', 240000)
            ->assertJsonPath('monthly.insurance', 200000);
    }

    public function test_zero_km_is_valid(): void
    {
        $this->buyer();
        $car = $this->car();

        $this->getJson("/api/vehiculos/{$car->id}/costos?km=0")->assertOk()->assertJsonPath('monthly.fuel', 0);
    }

    public function test_invalid_km_is_rejected_with_a_spanish_message(): void
    {
        $this->buyer();
        $car = $this->car();

        foreach (['-5', 'abc', '1.5'] as $km) {
            $this->getJson("/api/vehiculos/{$car->id}/costos?km={$km}")->assertUnprocessable()
                ->assertJsonPath('errors.km.0', 'Revisá los kilómetros: tienen que ser un número entero mayor o igual a 0.');
        }
        $this->getJson("/api/vehiculos/{$car->id}/costos?km=20001")->assertUnprocessable()
            ->assertJsonPath('errors.km.0', 'Revisá los kilómetros: el máximo es 20.000 por mes.');
    }

    public function test_invalid_coverage_is_rejected_with_a_spanish_message(): void
    {
        $this->buyer();
        $car = $this->car();

        $this->getJson("/api/vehiculos/{$car->id}/costos?cobertura=nada")->assertUnprocessable()
            ->assertJsonPath('errors.cobertura.0', 'Elegí una cobertura de la lista.');
    }

    public function test_usd_price_is_converted_with_the_sell_rate(): void
    {
        $this->fakeRate(1200);
        $this->buyer();
        $car = $this->car(['precio' => 20000, 'moneda' => 'USD']);

        // 20.000 x 1.200 = 24.000.000; transfer = 24.000.000 x 0,03 + 100.000 = 820.000
        $this->getJson("/api/vehiculos/{$car->id}/costos")->assertOk()
            ->assertJsonPath('vehicle.published_price', 20000)
            ->assertJsonPath('vehicle.published_currency', 'USD')
            ->assertJsonPath('purchase.price', 24000000)
            ->assertJsonPath('purchase.transfer', 820000)
            ->assertJsonPath('exchange_rate.sell', 1200);
    }

    public function test_usd_price_without_rate_answers_503(): void
    {
        $this->fakeRate(null);
        $this->buyer();
        $car = $this->car(['precio' => 20000, 'moneda' => 'USD']);

        $this->getJson("/api/vehiculos/{$car->id}/costos")->assertStatus(503)
            ->assertExactJson(['message' => 'No pudimos obtener la cotización del dólar. Probá de nuevo en unos minutos.']);
    }

    public function test_ars_vehicle_does_not_fetch_the_rate(): void
    {
        $this->buyer();
        $car = $this->car();

        $this->getJson("/api/vehiculos/{$car->id}/costos")->assertOk();
        Http::assertNothingSent();
    }

    public function test_electric_vehicle_reports_fuel_as_not_estimated(): void
    {
        $this->buyer();
        $car = $this->car(['combustible' => 'electrico', 'consumo_urbano' => null, 'consumo_ruta' => null]);

        $this->getJson("/api/vehiculos/{$car->id}/costos")->assertOk()
            ->assertJsonPath('monthly.fuel', null)
            ->assertJsonPath('monthly.not_estimated', ['fuel'])
            ->assertJsonPath('breakdown.fuel', null);
    }

    public function test_unknown_hidden_and_non_dealer_vehicles_answer_404(): void
    {
        $this->buyer();
        $hidden = $this->car(visible: false);
        $external = Vehiculo::factory()->create(['origen' => 'externo']);

        foreach ([999999, $hidden->id, $external->id] as $id) {
            $this->getJson("/api/vehiculos/{$id}/costos")->assertNotFound()
                ->assertJsonPath('message', 'No encontramos ese vehículo.');
        }
    }

    public function test_vehicle_of_an_inoperative_dealer_answers_404(): void
    {
        $this->buyer();
        $car = $this->car();
        Suscripcion::query()->update(['estado' => 'vencida']);

        $this->getJson("/api/vehiculos/{$car->id}/costos")->assertNotFound();
    }
}
