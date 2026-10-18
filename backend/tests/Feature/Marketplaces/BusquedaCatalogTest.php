<?php

namespace Tests\Feature\Marketplaces;

use App\Models\Concesionaria;
use App\Models\FotoVehiculo;
use App\Models\Suscripcion;
use App\Models\User;
use App\Models\Vehiculo;
use App\Models\VehiculoConcesionaria;
use App\Services\Marketplaces\ExternalListing;
use App\Services\Marketplaces\ListingQuery;
use App\Services\Marketplaces\ListingSource;
use App\Services\Marketplaces\MarketplaceSearch;
use App\Services\Marketplaces\SourceUnavailableException;
use ArrayObject;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * UH-06 (D8-D10): dealer vehicles and cached external listings in one paginated, database-backed list.
 */
class BusquedaCatalogTest extends TestCase
{
    use RefreshDatabase;

    private const URL = '/api/busqueda';

    private function user(): User
    {
        return User::factory()->create();
    }

    /**
     * A dealer with an approved subscription ending in $days days (negative: already ended).
     */
    private function dealer(int $days = 30, string $name = 'Autos del Sur', string $estadoAlta = Concesionaria::ESTADO_ACTIVA): Concesionaria
    {
        $dealer = Concesionaria::factory()->create(['nombre' => $name, 'estado_alta' => $estadoAlta, 'provincia' => 'Córdoba']);
        Suscripcion::factory()->create([
            'concesionaria_id' => $dealer->id,
            'estado' => Suscripcion::ESTADO_ACTIVA,
            'vigente_desde' => now()->subDays(60)->toDateString(),
            'vigente_hasta' => now()->addDays($days)->toDateString(),
        ]);

        return $dealer;
    }

    /**
     * @param  array<string, mixed>  $attributes
     */
    private function dealerVehicle(Concesionaria $dealer, array $attributes = [], bool $visible = true): Vehiculo
    {
        $vehiculo = Vehiculo::factory()->create($attributes);
        VehiculoConcesionaria::factory()->create([
            'vehiculo_id' => $vehiculo->id,
            'concesionaria_id' => $dealer->id,
            'visible' => $visible,
        ]);

        return $vehiculo;
    }

    /**
     * Replace the marketplaces with fakes that count their calls.
     *
     * @param  array<string, list<string>|null>  $ids  Listing ids by source key; null makes the source fail.
     * @return ArrayObject<string, int> Call counter by source key.
     */
    private function fakeSources(array $ids): ArrayObject
    {
        $calls = new ArrayObject;
        $sources = [];
        foreach ($ids as $key => $listingIds) {
            $calls[$key] = 0;
            $sources[] = new class($key, $listingIds, $calls) implements ListingSource
            {
                /** @param list<string>|null $ids */
                public function __construct(private string $key, private ?array $ids, private ArrayObject $calls) {}

                public function key(): string
                {
                    return $this->key;
                }

                public function label(): string
                {
                    return strtoupper($this->key);
                }

                public function search(ListingQuery $query): array
                {
                    $this->calls[$this->key]++;
                    if ($this->ids === null) {
                        throw new SourceUnavailableException($this->key, 'down');
                    }

                    return array_map(fn (string $id) => new ExternalListing(
                        $this->key, $id, "Peugeot 208 $id", 'Peugeot', '208', 'Allure', 2021, 40000, 15000000, 'ARS',
                        null, null, null, 'Rosario', "https://example.test/$id", "https://img.test/$id.jpg",
                    ), $this->ids);
                }
            };
        }
        config(['marketplaces.sources' => array_keys($ids)]);
        $this->app->bind(MarketplaceSearch::class, fn () => new MarketplaceSearch($sources));

        return $calls;
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function listing(string $query = ''): array
    {
        return $this->actingAs($this->user())->getJson(self::URL.$query)->assertOk()->json('publicaciones');
    }

    public function test_visible_vehicles_of_an_active_dealer_appear_with_the_dealer_as_source(): void
    {
        $this->fakeSources([]);
        $dealer = $this->dealer(name: 'Autos del Sur');
        $vehiculo = $this->dealerVehicle($dealer, ['marca' => 'Toyota', 'modelo' => 'Corolla', 'version' => 'XEI', 'anio' => 2020, 'ubicacion' => 'CABA']);
        FotoVehiculo::factory()->create(['vehiculo_id' => $vehiculo->id, 'ubicacion_archivo' => 'https://img.test/second.jpg', 'orden' => 2]);
        FotoVehiculo::factory()->create(['vehiculo_id' => $vehiculo->id, 'ubicacion_archivo' => 'https://img.test/cover.jpg', 'orden' => 1]);

        $item = $this->listing()[0];

        $this->assertSame($vehiculo->id, $item['id']);
        $this->assertSame('Toyota Corolla XEI 2020', $item['titulo']);
        $this->assertSame('CABA', $item['ubicacion']);
        $this->assertSame('https://img.test/cover.jpg', $item['imagen_url']);
        $this->assertNull($item['url_original']);
        $this->assertSame(['clave' => 'concesionaria', 'nombre' => 'Autos del Sur'], $item['fuente']);
    }

    public function test_hidden_vehicles_and_vehicles_of_dealers_without_an_operative_subscription_do_not_appear(): void
    {
        $this->fakeSources([]);
        $active = $this->dealer();
        $this->dealerVehicle($active, ['modelo' => 'Visible']);
        $this->dealerVehicle($active, ['modelo' => 'Hidden'], visible: false);
        $this->dealerVehicle($this->dealer(days: -10, name: 'Expired'), ['modelo' => 'OfExpired']);
        $this->dealerVehicle($this->dealer(estadoAlta: Concesionaria::ESTADO_PENDIENTE, name: 'Pending'), ['modelo' => 'OfPendingDealer']);
        $this->dealerVehicle(Concesionaria::factory()->active()->create(), ['modelo' => 'NoSubscription']);

        $this->assertSame(['Visible'], array_column($this->listing(), 'modelo'));
    }

    public function test_a_dealer_in_its_grace_period_still_appears(): void
    {
        $this->fakeSources([]);
        $this->dealerVehicle($this->dealer(days: -2), ['modelo' => 'InGrace']);

        $this->assertSame(['InGrace'], array_column($this->listing(), 'modelo'));
    }

    public function test_external_listings_appear_after_the_refresh_next_to_the_dealer_vehicles(): void
    {
        $this->fakeSources(['a' => ['a1', 'a2']]);
        $this->dealerVehicle($this->dealer(), ['modelo' => 'Corolla']);

        $response = $this->actingAs($this->user())->getJson(self::URL)->assertOk();

        $this->assertCount(3, $response->json('publicaciones'));
        $response->assertJsonPath('fuentes', [['clave' => 'a', 'nombre' => 'A', 'estado' => 'ok']]);
        $external = collect($response->json('publicaciones'))->firstWhere('fuente.clave', 'a');
        $this->assertSame('A', $external['fuente']['nombre']);
        $this->assertStringStartsWith('https://example.test/', $external['url_original']);
        $this->assertStringStartsWith('https://img.test/', $external['imagen_url']);
    }

    public function test_a_second_request_inside_the_window_does_not_call_the_sources(): void
    {
        $calls = $this->fakeSources(['a' => ['a1']]);
        $user = $this->user();

        $this->actingAs($user)->getJson(self::URL)->assertOk();
        $this->actingAs($user)->getJson(self::URL.'?q=peugeot&page=1')->assertOk()->assertJsonCount(1, 'publicaciones');

        $this->assertSame(1, $calls['a']);
    }

    public function test_a_request_after_the_window_refreshes_the_sources_again(): void
    {
        config(['marketplaces.refresh_minutes' => 15]);
        $calls = $this->fakeSources(['a' => ['a1']]);
        $user = $this->user();

        $this->actingAs($user)->getJson(self::URL)->assertOk();
        $this->travel(16)->minutes();
        $this->actingAs($user)->getJson(self::URL)->assertOk();

        $this->assertSame(2, $calls['a']);
    }

    public function test_a_failed_source_is_reported_and_its_listings_are_hidden_while_dealers_stay(): void
    {
        $calls = $this->fakeSources(['up' => ['u1'], 'down' => null]);
        $this->dealerVehicle($this->dealer(), ['modelo' => 'Corolla']);
        $user = $this->user();

        $response = $this->actingAs($user)->getJson(self::URL)->assertOk();

        $response->assertJsonPath('fuentes.0.estado', 'ok')->assertJsonPath('fuentes.1.estado', 'sin_respuesta');
        $this->assertEqualsCanonicalizing(['up', 'concesionaria'], array_column(array_column($response->json('publicaciones'), 'fuente'), 'clave'));

        // The failure is remembered for the window: no new call, same status.
        $this->actingAs($user)->getJson(self::URL)->assertOk()->assertJsonPath('fuentes.1.estado', 'sin_respuesta');
        $this->assertSame(1, $calls['down']);
    }

    public function test_listings_persisted_by_a_source_that_later_fails_are_hidden(): void
    {
        $this->fakeSources(['a' => ['a1']]);
        $user = $this->user();
        $this->actingAs($user)->getJson(self::URL)->assertOk()->assertJsonCount(1, 'publicaciones');

        $this->travel(16)->minutes();
        $this->fakeSources(['a' => null]);
        $this->actingAs($user)->getJson(self::URL)->assertOk()
            ->assertJsonPath('fuentes.0.estado', 'sin_respuesta')
            ->assertJsonCount(0, 'publicaciones');
        $this->assertDatabaseCount('publicacion_externa', 1);
    }

    public function test_q_matches_every_word_across_both_kinds_ignoring_case_and_accents(): void
    {
        $this->fakeSources(['a' => ['a1']]);
        $dealer = $this->dealer();
        $this->dealerVehicle($dealer, ['marca' => 'Toyota', 'modelo' => 'Corolla', 'version' => 'XEI']);
        $this->dealerVehicle($dealer, ['marca' => 'Ford', 'modelo' => 'Focus', 'version' => 'SE']);
        $this->dealerVehicle($dealer, ['marca' => 'Citroën', 'modelo' => 'C4', 'version' => 'Feel']);

        $this->assertSame(['Corolla'], array_column($this->listing('?q=TOYOTA+corolla'), 'modelo'));
        $this->assertSame([], $this->listing('?q=toyota+focus'));
        $this->assertSame(['208'], array_column($this->listing('?q=peugeot'), 'modelo'));
        $this->assertSame(['C4'], array_column($this->listing('?q='.urlencode('citroën')), 'modelo'));
        $this->assertSame([], $this->listing('?q=%25'), 'a % typed by the buyer is literal, not a wildcard');
    }

    public function test_pagination_meta_and_per_page(): void
    {
        $this->fakeSources([]);
        $dealer = $this->dealer();
        foreach (range(1, 5) as $i) {
            $this->dealerVehicle($dealer, ['modelo' => "M$i"]);
        }
        $user = $this->user();

        $first = $this->actingAs($user)->getJson(self::URL.'?per_page=2')->assertOk();
        $first->assertJsonPath('meta', ['page' => 1, 'per_page' => 2, 'total' => 5, 'last_page' => 3]);
        $this->assertSame(['M5', 'M4'], array_column($first->json('publicaciones'), 'modelo'));

        $last = $this->actingAs($user)->getJson(self::URL.'?per_page=2&page=3')->assertOk();
        $this->assertSame(['M1'], array_column($last->json('publicaciones'), 'modelo'));
        $last->assertJsonPath('meta.page', 3);

        $this->actingAs($user)->getJson(self::URL)->assertOk()->assertJsonPath('meta.per_page', 24);
    }

    public function test_page_and_per_page_are_validated(): void
    {
        $this->fakeSources([]);
        $user = $this->user();

        foreach (['page=0', 'page=abc', 'per_page=0', 'per_page=61', 'per_page=x'] as $query) {
            $this->actingAs($user)->getJson(self::URL.'?'.$query)->assertUnprocessable();
        }
        $this->actingAs($user)->getJson(self::URL.'?per_page=60')->assertOk();
    }

    public function test_a_page_costs_a_handful_of_queries_whatever_the_catalog_size(): void
    {
        $this->fakeSources(['a' => ['a1', 'a2']]);
        $dealer = $this->dealer();
        Vehiculo::factory()->count(200)->create()->each(function (Vehiculo $v) use ($dealer): void {
            VehiculoConcesionaria::factory()->create(['vehiculo_id' => $v->id, 'concesionaria_id' => $dealer->id]);
            FotoVehiculo::factory()->create(['vehiculo_id' => $v->id, 'orden' => 1]);
        });
        $user = $this->user();
        $this->actingAs($user)->getJson(self::URL)->assertOk(); // warms the sources

        DB::enableQueryLog();
        $this->actingAs($user)->getJson(self::URL.'?q=a&per_page=24&page=2')->assertOk();
        $queries = count(DB::getQueryLog());
        DB::disableQueryLog();

        $this->assertLessThanOrEqual(10, $queries);
    }
}
