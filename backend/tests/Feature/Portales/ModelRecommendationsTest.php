<?php

namespace Tests\Feature\Portales;

use App\Models\Concesionaria;
use App\Models\Diagnostico;
use App\Models\Suscripcion;
use App\Models\TipoCarroceria;
use App\Models\User;
use App\Models\Vehiculo;
use App\Models\VehiculoConcesionaria;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Tests\Feature\Portales\Concerns\SeedsModelPrices;
use Tests\TestCase;

class ModelRecommendationsTest extends TestCase
{
    use RefreshDatabase;
    use SeedsModelPrices;

    protected function setUp(): void
    {
        parent::setUp();
        config(['cache.default' => 'array']);
        Cache::flush();
        Http::preventStrayRequests();
        $this->travelTo('2026-10-20 12:00:00');
    }

    /** The official sell rate, 1.000 ARS per USD. */
    private function fakeRate(): void
    {
        Http::fake(['https://dolarapi.com/v1/dolares/oficial' => Http::response([
            'moneda' => 'USD', 'casa' => 'oficial', 'venta' => 1000,
            'fechaActualizacion' => '2026-10-20T12:00:00Z',
        ])]);
    }

    private function bodyId(string $name): int
    {
        return TipoCarroceria::query()->where('nombre', $name)->value('id');
    }

    /** A buyer with a saved diagnosis: 25M budget, city, four seats, any transmission, consumption, hatchbacks. */
    private function buyer(array $changes = [], array $bodies = ['Hatchback']): User
    {
        $user = User::factory()->create();
        $this->actingAs($user)->putJson('/api/diagnostico', array_replace([
            'presupuesto' => '15m_25m', 'uso_principal' => 'ciudad', 'pasajeros' => '3_4', 'kilometros_mensuales' => 'menos_500',
            'transmision' => 'indiferente', 'prioridad' => 'consumo',
        ], $changes, ['carrocerias' => array_map($this->bodyId(...), $bodies)]))->assertOk();

        return $user;
    }

    private function seedCatalog(): void
    {
        $this->fakeRate();
        DB::table('catalog_import')->insert(['id' => 1, 'source_date' => '2026-10-19', 'sha256' => str_repeat('a', 64),
            'snapshot_id' => 'acara:test', 'imported_at' => now()]);
        $this->makeModel('TOYOTA', 'Etios', ['consumo' => 'bajo', 'usos' => ['ciudad', 'ruta'], 'tiene_automatica' => false]);
        $this->makeModel('VOLKSWAGEN', 'Polo', ['consumo' => 'medio', 'usos' => ['ciudad']]);
        $this->makeModel('RENAULT', 'Sandero', ['consumo' => 'alto']);
        $this->makeModel('TOYOTA', 'Corolla', ['tipo' => 'Sedán', 'consumo' => 'medio']);

        $this->addVersion('TOYOTA', 'Etios', 'X', [2016 => 5000000, 2019 => 14000000, 2020 => 24000000, 2021 => 26000000, 2022 => 40000000, '0km' => 10000000]);
        $this->addVersion('TOYOTA', 'Etios', 'XLS', [2019 => 16000000, 2020 => 26000000, 2021 => 28000000]);
        $this->addVersion('VOLKSWAGEN', 'Polo', 'Track', [2023 => 20000, 2024 => 31000], 'USD');
        $this->addVersion('VOLKSWAGEN', 'Polo', 'Highline', [2023 => 30000], 'USD');
        $this->addVersion('VOLKSWAGEN', 'Polo', 'Track ARS', [2024 => 27000000]);
        $this->addVersion('RENAULT', 'Sandero', 'Life', [2019 => 30000000, 2025 => 30000000]);
        $this->addVersion('TOYOTA', 'Corolla', 'XEi', [2018 => 20000000]);
    }

    /** @return list<string> */
    private function names(array $json): array
    {
        return array_map(fn (array $m) => $m['marca'].' '.$m['modelo'], $json['modelos']);
    }

    public function test_it_requires_authentication_and_sends_no_request(): void
    {
        $this->getJson('/api/recomendaciones/modelos')->assertUnauthorized();

        Http::assertNothingSent();
    }

    public function test_a_missing_diagnosis_answers_like_the_listing_endpoint_without_any_request(): void
    {
        $this->seedCatalog();

        $this->actingAs(User::factory()->create())->getJson('/api/recomendaciones/modelos')
            ->assertOk()->assertExactJson(['status' => 'diagnosis_incomplete', 'modelos' => [], 'fuente_precios' => null, 'exchange_rate' => null]);

        Http::assertNothingSent();
    }

    public function test_an_incomplete_diagnosis_answers_diagnosis_incomplete(): void
    {
        $this->seedCatalog();
        $user = $this->buyer();
        Diagnostico::where('usuario_id', $user->id)->update(['estado' => 'requiere_confirmacion', 'pasajeros' => null]);

        $this->getJson('/api/recomendaciones/modelos')->assertOk()
            ->assertJsonPath('status', 'diagnosis_incomplete')->assertJsonPath('modelos', []);

        Http::assertNothingSent();
    }

    public function test_the_current_user_diagnosis_is_used_and_a_supplied_identity_is_ignored(): void
    {
        $this->seedCatalog();
        $owner = $this->buyer();

        $this->actingAs(User::factory()->create())->getJson('/api/recomendaciones/modelos?usuario_id='.$owner->id)
            ->assertOk()->assertJsonPath('status', 'diagnosis_incomplete')->assertJsonPath('modelos', []);
    }

    public function test_it_returns_the_models_that_fit_with_prices_reasons_chips_links_and_the_source(): void
    {
        $this->seedCatalog();
        $this->buyer();

        $response = $this->getJson('/api/recomendaciones/modelos')->assertOk()
            ->assertHeader('Cache-Control', 'no-store, private')
            ->assertJsonPath('status', 'ready')
            ->assertJsonPath('fuente_precios', ['nombre' => 'Guía de precios ACARA', 'fecha' => '2026-10-19'])
            ->assertJsonPath('exchange_rate.quote.sell', 1000);

        $this->assertSame(['TOYOTA Etios', 'VOLKSWAGEN Polo'], $this->names($response->json()));
        $etios = $response->json('modelos.0');
        $this->assertSame([
            'marca' => 'TOYOTA', 'modelo' => 'Etios', 'carroceria' => 'Hatchback',
            'anios' => ['desde' => 2019, 'hasta' => 2020],
            'precio' => ['desde_ars' => 24000000, 'hasta_ars' => 26000000, 'anio_referencia' => 2020],
            'motivos' => ['Consumo bajo', 'Apto para ciudad', '5 plazas'],
            'filtros' => ['Hatchback', '2019–2020', 'Hasta $ 25.000.000'],
            'links' => [
                ['portal' => 'mercadolibre', 'nombre' => 'Mercado Libre',
                    'url' => 'https://autos.mercadolibre.com.ar/toyota/etios/2019-2020/_PriceRange_0ARS-25000000ARS_VEHICLE*BODY*TYPE_479344'],
                ['portal' => 'kavak', 'nombre' => 'Kavak', 'url' => 'https://www.kavak.com/ar/usados/toyota/etios'],
            ],
            'imagen_url' => null,
        ], array_diff_key($etios, ['id' => 0]));
        $this->assertIsInt($etios['id']);
        // USD prices are converted with the official sell rate: 20.000 and 30.000 USD at 1.000.
        $this->assertSame(['desde_ars' => 20000000, 'hasta_ars' => 30000000, 'anio_referencia' => 2023], $response->json('modelos.1.precio'));
        $this->assertSame(['desde' => 2023, 'hasta' => 2023], $response->json('modelos.1.anios'));
    }

    public function test_a_model_enters_when_its_cheapest_version_fits_and_not_when_none_does(): void
    {
        $this->seedCatalog();
        $this->buyer(['presupuesto' => 'hasta_15m'], ['Hatchback', 'Sedán']);

        // With 15M only the Etios 2019 (14M) is affordable: Corolla 2018 costs 20M and the Sandero 30M.
        $json = $this->getJson('/api/recomendaciones/modelos')->assertOk()->json();

        $this->assertSame(['TOYOTA Etios'], $this->names($json));
        $this->assertSame(['desde' => 2019, 'hasta' => 2019], $json['modelos'][0]['anios']);
        $this->assertSame(2019, $json['modelos'][0]['precio']['anio_referencia']);
        $this->assertArrayNotHasKey('exchange_rate', $json);
    }

    public function test_nothing_that_fits_is_a_ready_answer_with_no_models(): void
    {
        $this->seedCatalog();
        $this->buyer(['pasajeros' => 'mas_5']);

        $this->getJson('/api/recomendaciones/modelos')->assertOk()
            ->assertJsonPath('status', 'ready')->assertJsonPath('modelos', []);
    }

    public function test_without_a_budget_cap_only_the_five_newest_years_are_considered_and_the_link_has_no_price(): void
    {
        $this->seedCatalog();
        $this->buyer(['presupuesto' => 'mas_40m', 'prioridad' => 'mantenimiento'], ['Hatchback', 'Sedán']);

        $json = $this->getJson('/api/recomendaciones/modelos')->assertOk()->json();

        // Corolla only has 2018 and Etios 2019-2021 are outside 2022-2026.
        $this->assertSame(['VOLKSWAGEN Polo', 'RENAULT Sandero', 'TOYOTA Etios'], $this->names($json));
        $etios = $json['modelos'][2];
        $this->assertSame(['desde' => 2022, 'hasta' => 2022], $etios['anios']);
        $this->assertSame(['Hatchback', '2022'], $etios['filtros']);
        $this->assertStringNotContainsString('PriceRange', $etios['links'][0]['url']);
        $this->assertSame(['desde' => 2023, 'hasta' => 2024], $json['modelos'][0]['anios']);
    }

    public function test_seats_body_and_transmission_are_hard_filters(): void
    {
        $this->seedCatalog();
        $this->buyer(['transmision' => 'automatica']);

        $this->assertSame(['VOLKSWAGEN Polo'], $this->names($this->getJson('/api/recomendaciones/modelos')->assertOk()->json()));

        $this->buyer(['transmision' => 'manual'], ['Sedán']);
        $this->assertSame(['TOYOTA Corolla'], $this->names($this->getJson('/api/recomendaciones/modelos')->assertOk()->json()));
    }

    public function test_the_links_filter_the_transmission_but_never_the_zone_mileage_fuel_or_doors(): void
    {
        $this->seedCatalog();
        $this->buyer(['transmision' => 'manual']);

        $json = $this->getJson('/api/recomendaciones/modelos')->assertOk()->json();

        $this->assertSame(['Manual', 'Hatchback', '2019–2020', 'Hasta $ 25.000.000'], $json['modelos'][0]['filtros']);
        foreach ($json['modelos'] as $model) {
            foreach ($model['links'] as $link) {
                $this->assertStringNotContainsString('KILOMETERS', $link['url']);
                $this->assertStringNotContainsString('DOORS', $link['url']);
                $this->assertStringNotContainsString('nafta', $link['url']);
            }
        }
        $this->assertStringContainsString('/toyota/etios/manual/2019-2020/', $json['modelos'][0]['links'][0]['url']);
    }

    public function test_the_rate_is_only_requested_when_the_prices_have_usd_and_nothing_goes_to_the_portals(): void
    {
        $this->seedCatalog();
        $this->buyer();

        $this->getJson('/api/recomendaciones/modelos')->assertOk();

        Http::assertSentCount(1);
        Http::assertSent(fn (Request $request) => $request->url() === 'https://dolarapi.com/v1/dolares/oficial');
    }

    public function test_ars_only_prices_need_no_request_at_all(): void
    {
        $this->makeModel('TOYOTA', 'Etios');
        $this->addVersion('TOYOTA', 'Etios', 'X', [2020 => 10000000]);
        $this->buyer();

        $this->getJson('/api/recomendaciones/modelos')->assertOk()->assertJsonPath('modelos.0.modelo', 'Etios')
            ->assertJsonPath('fuente_precios.fecha', null);

        Http::assertNothingSent();
    }

    public function test_usd_prices_are_left_out_when_there_is_no_exchange_rate(): void
    {
        Http::fake(['https://dolarapi.com/v1/dolares/oficial' => Http::response([], 500)]);
        $this->seedCatalog();
        $this->buyer();

        $json = $this->getJson('/api/recomendaciones/modelos')->assertOk()->json();

        $this->assertSame(['TOYOTA Etios'], $this->names($json));
        $this->assertArrayNotHasKey('exchange_rate', $json);
    }

    public function test_each_model_takes_its_photo_from_the_dealers_inventory_or_is_null(): void
    {
        $this->seedCatalog();
        $this->buyer();
        $dealer = Concesionaria::factory()->active()->create();
        Suscripcion::factory()->create(['concesionaria_id' => $dealer->id, 'estado' => 'activa',
            'vigente_hasta' => now()->addMonth()->toDateString()]);
        $car = Vehiculo::factory()->create(['marca' => 'Volkswagen', 'modelo' => 'POLO']);
        VehiculoConcesionaria::factory()->create(['vehiculo_id' => $car->id, 'concesionaria_id' => $dealer->id]);
        $car->fotos()->create(['ubicacion_archivo' => 'https://example.test/polo.jpg', 'orden' => 1]);

        $response = $this->getJson('/api/recomendaciones/modelos')->assertOk();

        $photos = collect($response->json('modelos'))->mapWithKeys(fn (array $m) => [$m['modelo'] => $m['imagen_url']])->all();
        $this->assertSame(['Etios' => null, 'Polo' => 'https://example.test/polo.jpg'], $photos);
        $response->assertJsonMissingPath('modelos.0.imagen');
    }
}
