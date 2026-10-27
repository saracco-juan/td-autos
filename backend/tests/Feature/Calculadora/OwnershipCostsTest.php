<?php

namespace Tests\Feature\Calculadora;

use App\Models\Concesionaria;
use App\Models\Diagnostico;
use App\Models\Suscripcion;
use App\Models\TipoCarroceria;
use App\Models\User;
use App\Models\Vehiculo;
use App\Models\VehiculoConcesionaria;
use App\Services\Catalog\FixedAcaraCatalog;
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
        config(['cache.default' => 'array', 'cache.stores.catalog' => ['driver' => 'array']]);
        Cache::flush();
        Http::preventStrayRequests();
        $this->travelTo(Carbon::parse('2026-10-20T12:00:00Z'));
        $this->fakeRate();
        config(['calculadora' => [
            'updated_at' => '2026-10-01',
            'rounding' => 1000,
            'km_per_month' => ['menos_500' => 500, '500_1500' => 1500, '1500_3000' => 3000, 'mas_3000' => 4500, 'no_sabe' => 1500],
            'fuel_prices' => ['nafta' => 1000, 'diesel' => 900, 'gnc' => 500],
            'insurance' => [
                'tc_base' => ['hatchback' => 103000, 'sedan' => 114000, 'rural' => 114000, 'suv' => 108000, 'pickup' => 152000, 'furgon' => 152000],
                'value_rate_tc' => 0.023,
                'zone_factor' => ['caba' => 1.0, 'buenos_aires' => 1.0, 'cordoba' => 0.8, 'santa_fe' => 0.78, 'mendoza' => 0.73, 'default' => 0.8],
                'tr_ratio' => ['hatchback' => 1.8, 'sedan' => 2.1, 'rural' => 2.1, 'suv' => 2.0, 'pickup' => 2.35, 'furgon' => 2.35],
                'value_rate_tr' => 0.06,
                'cpi_base_month' => '2026-10',
            ],
            'transfer' => ['dnrpa_rate' => 0.01, 'fixed_costs' => 100000, 'stamp_rate' => ['cordoba' => 0.02, 'caba' => 0.01]],
            'patente' => [
                'cpi_base_month' => '2026-02',
                'scale' => ['buenos_aires' => [
                    ['up_to' => 14100000, 'fixed' => 0, 'rate' => 0.01], ['up_to' => 18700000, 'fixed' => 141000, 'rate' => 0.02],
                    ['up_to' => 26100000, 'fixed' => 233000, 'rate' => 0.03], ['up_to' => null, 'fixed' => 455000, 'rate' => 0.04],
                ]],
                'bracket_rate' => ['cordoba' => [['up_to' => 20000000, 'rate' => 0.025], ['up_to' => null, 'rate' => 0.03]]],
                'flat_rate' => ['caba' => 0.01, 'mendoza' => 0.03],
            ],
            'service' => [
                'fuel_factor' => ['nafta' => 1.0, 'diesel' => 1.0, 'hibrido' => 1.0, 'gnc' => 1.15, 'electrico' => 0.5],
                'brands' => [
                    'toyota' => [
                        'label' => 'Toyota', 'aliases' => [], 'interval_km' => 10000, 'interval_months' => 12, 'cpi_base_month' => '2026-08',
                        'models' => ['yaris' => 361000],
                        'body' => ['hatchback' => 361000, 'sedan' => 486000],
                    ],
                ],
                'fallback' => [
                    'interval_km' => 10000, 'interval_months' => 12, 'cpi_base_month' => '2025-09',
                    'body' => ['hatchback' => 200000, 'sedan' => 380000],
                ],
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

    /** @param array<int, ?string> $values price by model year */
    private function catalog(string $currency, array $values): void
    {
        app(FixedAcaraCatalog::class)->import(['source_date' => '2026-10-19', 'sha256' => hash('sha256', 'costs'), 'snapshot_id' => 'costs-1',
            'rows' => [['make' => 'Renault', 'model' => 'Logan', 'version' => 'Life', 'version_id' => 'acara:costs', 'currency' => $currency,
                'page' => 1, 'zero_km_price' => null, 'values' => $values]]]);
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
            'tipo_carroceria_id' => TipoCarroceria::where('nombre', 'Sedán')->value('id'), 'anio' => 2022, 'kilometraje' => 40000,
            'precio' => 20000000, 'moneda' => 'ARS', 'combustible' => 'nafta', 'transmision' => 'manual',
            'plazas' => 5, 'motor' => '1.6', 'turbo' => false, 'potencia' => 110, 'potencia_unidad' => 'CV',
            'consumo_urbano' => 8, 'consumo_ruta' => 6, 'marca' => 'Renault', 'modelo' => 'Logan',
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
                    'year' => 2022, 'fuel' => 'nafta', 'province' => 'Córdoba', 'published_price' => 20000000.0, 'published_currency' => 'ARS'],
                'inputs' => ['km_per_month' => 1500, 'km_source' => 'diagnostico', 'coverage' => 'terceros_completo'],
                'purchase' => ['price' => 20000000, 'transfer' => 700000, 'total' => 20700000,
                    'budget' => ['max' => 25000000.0, 'fits' => true, 'difference' => 4300000.0]],
                'monthly' => ['fuel' => 120000, 'insurance' => 92000, 'patente' => 42000, 'total' => 254000, 'not_estimated' => []],
                'yearly' => ['service' => 760000, 'total' => 3808000],
                'breakdown' => [
                    'fuel' => ['km_per_month' => 1500, 'consumption_l_100km' => 8.0, 'fuel_type' => 'nafta', 'price_fuel_type' => 'nafta',
                        'unit' => 'litro', 'unit_price' => 1000],
                    'insurance' => ['coverage' => 'terceros_completo', 'base' => 20000000.0, 'body_type' => 'sedan', 'body_label' => 'Sedán',
                        'base_monthly' => 114000.0, 'value_rate' => 0.023, 'by_value' => false, 'zone_factor' => 0.8, 'province' => 'Córdoba',
                        'province_known' => true, 'tr_ratio' => null, 'terceros_completo' => 92000],
                    'patente' => ['base' => 20000000.0, 'base_source' => 'listing', 'province' => 'Córdoba', 'province_known' => true, 'method' => 'bracket_rate', 'rate' => 0.025,
                        'bracket_fixed' => null, 'bracket_from' => null, 'age' => 4, 'age_band' => null, 'body_kind' => null, 'subtotal' => 500000.0,
                        'surcharge' => 0.0, 'cap_rate' => null, 'cap_applied' => false, 'minimum' => null, 'minimum_applied' => false,
                        'exempt' => false, 'exempt_from_age' => null, 'annual' => 500000.0],
                    'service' => ['brand' => null, 'brand_known' => false, 'model_matched' => false, 'body_type' => 'sedan', 'body_label' => 'Sedán',
                        'km_per_year' => 18000, 'interval_km' => 10000, 'interval_months' => 12, 'services_per_year' => 2,
                        'price_per_service' => 380000.0, 'fuel_factor' => 1.0, 'source_label' => 'valor de referencia'],
                    'transfer' => ['base' => 20000000.0, 'dnrpa_rate' => 0.01, 'stamp_rate' => 0.02, 'province' => 'Córdoba',
                        'province_known' => true, 'fixed_costs' => 100000],
                    'rounding' => 1000,
                ],
                'rates_updated_at' => '2026-10-01',
                'exchange_rate' => null,
            ]);
    }

    public function test_a_linked_vehicle_pays_the_patente_on_the_acara_price_of_its_year(): void
    {
        $this->catalog('ARS', [2022 => '30000000']);
        $this->buyer();
        $car = $this->car(['acara_version_id' => 'acara:costs']);

        // Patente: 30.000.000 x 3% / 12 = 75.000. Insurance and transfer keep the listing price (20.000.000).
        $this->getJson("/api/vehiculos/{$car->id}/costos")->assertOk()
            ->assertJsonPath('monthly.patente', 75000)
            ->assertJsonPath('monthly.insurance', 92000)
            ->assertJsonPath('purchase.transfer', 700000)
            ->assertJsonPath('breakdown.insurance.base', 20000000)
            ->assertJsonPath('breakdown.transfer.base', 20000000)
            ->assertJsonPath('breakdown.patente.base', 30000000)
            ->assertJsonPath('breakdown.patente.base_source', 'acara')
            ->assertJsonPath('breakdown.patente.reference_year', 2022)
            ->assertJsonPath('breakdown.patente.reference_currency', 'ARS');
    }

    public function test_an_acara_price_in_usd_is_converted_with_the_sell_rate(): void
    {
        $this->fakeRate(1200);
        $this->catalog('USD', [2022 => '25000']);
        $this->buyer();
        $car = $this->car(['acara_version_id' => 'acara:costs']);

        // 25.000 x 1.200 = 30.000.000 -> 75.000 a month. The listing stays in ARS, so no exchange rate is shown.
        $this->getJson("/api/vehiculos/{$car->id}/costos")->assertOk()
            ->assertJsonPath('monthly.patente', 75000)
            ->assertJsonPath('breakdown.patente.base', 30000000)
            ->assertJsonPath('breakdown.patente.base_source', 'acara')
            ->assertJsonPath('breakdown.patente.reference_currency', 'USD')
            ->assertJsonPath('breakdown.insurance.base', 20000000)
            ->assertJsonPath('exchange_rate', null);
    }

    public function test_a_linked_vehicle_without_a_price_for_its_year_uses_the_listing_price(): void
    {
        $this->catalog('ARS', [2021 => '30000000', 2022 => null]);
        $this->buyer();
        $car = $this->car(['acara_version_id' => 'acara:costs']);

        $this->getJson("/api/vehiculos/{$car->id}/costos")->assertOk()
            ->assertJsonPath('monthly.patente', 42000)
            ->assertJsonPath('breakdown.patente.base', 20000000)
            ->assertJsonPath('breakdown.patente.base_source', 'listing')
            ->assertJsonMissingPath('breakdown.patente.reference_year');
    }

    public function test_an_unlinked_vehicle_uses_the_listing_price(): void
    {
        $this->catalog('ARS', [2022 => '30000000']);
        $this->buyer();
        $car = $this->car();

        $this->getJson("/api/vehiculos/{$car->id}/costos")->assertOk()
            ->assertJsonPath('monthly.patente', 42000)
            ->assertJsonPath('breakdown.patente.base_source', 'listing');
    }

    public function test_an_acara_price_in_usd_without_a_rate_falls_back_to_the_listing_price(): void
    {
        $this->fakeRate(null);
        $this->catalog('USD', [2022 => '25000']);
        $this->buyer();
        $car = $this->car(['acara_version_id' => 'acara:costs']);

        $this->getJson("/api/vehiculos/{$car->id}/costos")->assertOk()
            ->assertJsonPath('monthly.patente', 42000)
            ->assertJsonPath('breakdown.patente.base', 20000000)
            ->assertJsonPath('breakdown.patente.base_source', 'listing');
    }

    public function test_an_empty_catalog_uses_the_listing_price(): void
    {
        $this->buyer();
        $car = $this->car(['acara_version_id' => 'acara:costs']);

        $this->getJson("/api/vehiculos/{$car->id}/costos")->assertOk()
            ->assertJsonPath('breakdown.patente.base_source', 'listing');
    }

    public function test_the_yearly_service_uses_the_brand_and_model_of_the_vehicle(): void
    {
        $this->buyer();
        $car = $this->car(['marca' => 'Toyota', 'modelo' => 'Yaris', 'tipo_carroceria_id' => TipoCarroceria::where('nombre', 'Hatchback')->value('id')]);

        // 18.000 km / 10.000 -> 2 services x 361.000 = 722.000; the monthly total keeps only fuel, insurance and patente.
        $this->getJson("/api/vehiculos/{$car->id}/costos")->assertOk()
            ->assertJsonPath('yearly.service', 722000)
            ->assertJsonPath('yearly.total', 722000 + 12 * 245000)
            ->assertJsonPath('breakdown.service.brand', 'Toyota')
            ->assertJsonPath('breakdown.service.model_matched', true)
            ->assertJsonPath('breakdown.service.source_label', 'service oficial Toyota Yaris')
            ->assertJsonMissingPath('monthly.maintenance')
            ->assertJsonMissingPath('monthly.yearly_total')
            ->assertJsonMissingPath('breakdown.maintenance');
    }

    public function test_the_vehicle_fuel_type_is_exposed(): void
    {
        $this->buyer();
        $electric = $this->car(['combustible' => 'electrico', 'consumo_urbano' => null, 'consumo_ruta' => null]);

        $this->getJson("/api/vehiculos/{$electric->id}/costos")->assertOk()
            ->assertJsonPath('vehicle.fuel', 'electrico')->assertJsonPath('monthly.fuel', null);
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
            ->assertJsonPath('monthly.insurance', 194000);
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
