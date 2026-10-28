<?php

namespace Tests\Feature\Matching;

use App\Models\ComprobantePago;
use App\Models\Concesionaria;
use App\Models\Diagnostico;
use App\Models\Suscripcion;
use App\Models\User;
use App\Models\Vehiculo;
use App\Models\VehiculoConcesionaria;
use App\Services\Catalog\FixedAcaraCatalog;
use App\Support\VehiculoFields;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Factory;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class RecommendationsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['cache.default' => 'array']);
        Cache::flush();
        Http::preventStrayRequests();
        $this->travelTo(Carbon::parse('2026-10-20T12:00:00Z'));
        Http::fake(['https://dolarapi.com/v1/dolares/oficial' => Http::response([
            'moneda' => 'USD', 'casa' => 'oficial', 'venta' => 1000,
            'fechaActualizacion' => '2026-10-20T12:00:00Z',
        ])]);
    }

    private function answers(array $changes = []): array
    {
        return array_replace(['presupuesto' => '15m_25m', 'uso_principal' => 'ciudad',
            'pasajeros' => '3_4', 'kilometros_mensuales' => 'menos_500', 'transmision' => 'manual',
            'prioridad' => 'consumo', 'carrocerias' => [1]], $changes);
    }

    private function buyer(array $changes = []): User
    {
        $user = User::factory()->create();
        $this->actingAs($user)->putJson('/api/diagnostico', $this->answers($changes))->assertOk();

        return $user;
    }

    private function car(array $changes = [], ?Concesionaria $dealer = null): Vehiculo
    {
        if ($dealer === null) {
            $dealer = Concesionaria::factory()->active()->create();
            Suscripcion::factory()->create(['concesionaria_id' => $dealer->id, 'estado' => 'activa',
                'vigente_hasta' => now()->addMonth()->toDateString()]);
        }
        $vehicle = Vehiculo::factory()->create(array_replace(array_fill_keys(array_keys(VehiculoFields::EQUIPMENT_FIELDS), true), [
            'tipo_carroceria_id' => 1, 'anio' => 2025, 'kilometraje' => 20000,
            'precio' => 20000000, 'moneda' => 'ARS', 'combustible' => 'nafta', 'transmision' => 'manual',
            'plazas' => 5, 'motor' => '1.6', 'turbo' => false, 'potencia' => 110, 'potencia_unidad' => 'CV',
            'consumo_urbano' => 6, 'consumo_ruta' => 5,
        ], $changes));
        VehiculoConcesionaria::factory()->create(['vehiculo_id' => $vehicle->id, 'concesionaria_id' => $dealer->id]);
        $vehicle->fotos()->create(['ubicacion_archivo' => 'https://example.test/car.jpg', 'orden' => 1]);

        return $vehicle;
    }

    public function test_authentication_and_current_user_isolation_ignore_supplied_identity(): void
    {
        $this->getJson('/api/recomendaciones')->assertUnauthorized();
        Http::assertNothingSent();
        $owner = $this->buyer();
        $other = User::factory()->create();
        $this->actingAs($other)->getJson('/api/recomendaciones?usuario_id='.$owner->id)
            ->assertOk()->assertJsonPath('status', 'diagnosis_incomplete')->assertJsonPath('results', [])
            ->assertJsonPath('exchange_rate', null);
        Http::assertNothingSent();
    }

    public function test_pending_diagnosis_does_not_fetch_exchange_rates(): void
    {
        $user = $this->buyer(['prioridad' => 'reventa']);
        Diagnostico::where('usuario_id', $user->id)->update(['estado' => 'requiere_confirmacion', 'pasajeros' => null]);
        $this->getJson('/api/recomendaciones')->assertOk()->assertJsonPath('status', 'diagnosis_incomplete');
        Http::assertNothingSent();
    }

    public function test_hu05_local_resale_sources_combine_without_refresh_or_writes(): void
    {
        $this->buyer(['prioridad' => 'reventa', 'transmision' => 'indiferente']);
        $car = $this->car(['marca' => 'Test', 'modelo' => 'Example', 'version' => 'Base', 'acara_version_id' => 'base']);
        $catalog = ['snapshot_id' => 'acara:test', 'source_date' => '2026-10-19', 'fetched_at' => now()->toISOString(),
            'rows' => [['make' => 'Test', 'model' => 'Example', 'version' => 'Base', 'version_id' => 'base',
                'currency' => 'ARS', 'values' => [2025 => '100', 2022 => '80']]]];
        Cache::store('catalog')->forever(FixedAcaraCatalog::cacheKey(), $catalog);
        $activity = ['window_start' => '2026-04', 'window_end' => '2026-09', 'catalog_snapshot_id' => 'acara:test',
            'models' => [['make' => 'test', 'model' => 'example', 'special' => [], 'transfers' => 6, 'score' => 100]]];
        DB::table('dnrpa_refresh_state')->insert(['id' => 1, 'checked_at' => now()]);
        DB::table('dnrpa_activity_history')->insert(['month' => '2026-09', 'payload' => json_encode(['activity' => $activity])]);
        $before = $this->snapshot();
        $this->getJson('/api/recomendaciones')->assertOk()->assertJsonPath('results.0.listing_id', $car->id)
            ->assertJsonPath('results.0.score', 97.5)->assertJsonPath('results.0.components.priority', 90)
            ->assertJsonPath('results.0.resale.activity_score', 100)->assertJsonPath('results.0.resale.retention_score', 80)
            ->assertJsonPath('results.0.resale.source_date', '2026-10-19')->assertJsonPath('results.0.resale.window_end', '2026-09');
        $car->update(['version' => 'Feel Pack 1.6 AT', 'motor' => '1.6', 'potencia' => 115,
            'potencia_unidad' => 'CV', 'transmision' => 'automatica']);
        $natural = $catalog;
        $natural['rows'][0]['version'] = '1.6 Feel Pack AT (115cv) (L18)';
        Cache::store('catalog')->forever(FixedAcaraCatalog::cacheKey(), $natural);
        $inventoryBefore = $car->fresh()->getAttributes();
        $this->getJson('/api/recomendaciones')->assertOk()
            ->assertJsonPath('results.0.resale.retention_score', 80)
            ->assertJsonPath('results.0.resale.reference.version', '1.6 Feel Pack AT (115cv) (L18)');
        $this->assertSame($inventoryBefore, $car->fresh()->getAttributes());
        $natural['rows'][0]['values'] = [2025 => '100', 2023 => '81'];
        Cache::store('catalog')->forever(FixedAcaraCatalog::cacheKey(), $natural);
        $this->getJson('/api/recomendaciones')->assertOk()
            ->assertJsonPath('results.0.resale.retention_score', 72.9)
            ->assertJsonPath('results.0.resale.estimate.method', 'annualized')
            ->assertJsonPath('results.0.resale.estimate.years_used', [2023, 2025])
            ->assertJsonPath('results.0.resale.estimate.horizon_years', 3)
            ->assertJsonPath('results.0.resale.comparison', null);
        $this->assertSame($inventoryBefore, $car->fresh()->getAttributes());
        $car->update(['version' => 'Base', 'potencia' => 110, 'transmision' => 'manual']);
        $car->update(['version' => 'Feel Pack 1.6 AT', 'potencia' => 115, 'transmision' => 'automatica']);
        $approximate = $natural;
        $approximate['rows'][0] = array_replace($natural['rows'][0], ['model' => 'Example Extended', 'version' => '1.6 Feel Pack AT (115cv) 4Ptas.']);
        $car->update(['acara_version_id' => null]);
        Cache::store('catalog')->forever(FixedAcaraCatalog::cacheKey(), $approximate);
        $this->getJson('/api/recomendaciones')->assertOk()->assertJsonPath('results.0.resale.model_match', null)
            ->assertJsonPath('results.0.resale.retention_score', null)->assertJsonPath('results.0.resale.activity_score', 100)
            ->assertJsonPath('results.0.resale.estimate', null)->assertJsonPath('results.0.resale.comparison', null);
        $car->update(['version' => 'Base', 'potencia' => 110, 'transmision' => 'manual']);
        $car->update(['acara_version_id' => 'base']);
        foreach (['missing link', 'missing year', 'ambiguous identity', 'missing activity', 'missing catalog'] as $case) {
            DB::table('dnrpa_activity_history')->updateOrInsert(['month' => '2026-09'], ['payload' => json_encode(['activity' => $activity])]);
            $changed = $catalog;
            if ($case === 'missing link') {
                $car->update(['acara_version_id' => null]);
            }
            if ($case === 'missing year') {
                unset($changed['rows'][0]['values'][2022]);
            }
            if ($case === 'ambiguous identity') {
                $changed['rows'][] = $changed['rows'][0];
            }
            if ($case === 'missing activity') {
                DB::table('dnrpa_activity_history')->delete();
            }
            Cache::store('catalog')->forever(FixedAcaraCatalog::cacheKey(), $case === 'missing catalog' ? null : $changed);
            $this->getJson('/api/recomendaciones')->assertOk()->assertJsonPath('results.0.score', 90)
                ->assertJsonPath('results.0.components.priority', null)->assertJsonPath('results.0.warnings.0', 'resale_unavailable');
            $car->update(['version' => 'Base', 'acara_version_id' => 'base']);
        }
        Cache::store('catalog')->forever(FixedAcaraCatalog::cacheKey(), $catalog);
        DB::table('dnrpa_refresh_state')->update(['checked_at' => now()->subDays(14)]);
        $this->getJson('/api/recomendaciones')->assertOk()->assertJsonPath('results.0.score', 97.5)
            ->assertJsonPath('results.0.warnings.0', 'resale_stale')->assertJsonPath('results.0.resale.stale', true);
        $this->assertSame($before, $this->snapshot());
        Http::assertSentCount(1); // Only the existing shared quote; no ACARA/DNRPA HTTP.
    }

    public function test_nullable_legacy_inventory_identity_has_no_inferred_resale_estimate(): void
    {
        $this->buyer(['prioridad' => 'reventa']);
        $valid = $this->car(['marca' => 'Test', 'modelo' => 'Example', 'version' => 'Base']);
        $this->car(['marca' => null]);
        $this->car(['modelo' => null]);
        Cache::store('catalog')->forever(FixedAcaraCatalog::cacheKey(), ['snapshot_id' => 'acara:test', 'source_date' => '2026-10-19',
            'fetched_at' => now()->toISOString(),
            'rows' => [['make' => 'Test', 'model' => 'Example', 'version' => 'Base', 'version_id' => 'base',
                'currency' => 'ARS', 'values' => [2025 => '100', 2022 => '80']]]]);
        DB::table('dnrpa_refresh_state')->insert(['id' => 1, 'checked_at' => now()]);
        DB::table('dnrpa_activity_history')->insert(['month' => '2026-09', 'payload' => json_encode(['activity' => [
            'window_start' => '2026-04', 'window_end' => '2026-09', 'catalog_snapshot_id' => 'acara:test',
            'models' => [['make' => 'test', 'model' => 'example', 'special' => [], 'transfers' => 6, 'score' => 100]],
        ]])]);
        $before = $this->snapshot();

        $this->getJson('/api/recomendaciones')->assertOk()->assertJsonCount(1, 'results')
            ->assertJsonPath('results.0.listing_id', $valid->id)
            ->assertJsonPath('results.0.resale.reference', null)->assertJsonPath('results.0.resale.estimate', null);

        $this->assertSame($before, $this->snapshot());
        Http::assertSentCount(1);
    }

    public function test_real_listing_payload_uses_one_quote_and_exposes_only_public_facts(): void
    {
        $this->buyer();
        $ars = $this->car();
        $usd = $this->car(['moneda' => 'USD', 'precio' => 20000]);
        $response = $this->getJson('/api/recomendaciones')->assertOk()->assertJsonPath('status', 'ready')
            ->assertJsonCount(2, 'results')->assertJsonPath('results.0.listing_id', $ars->id)
            ->assertJsonPath('results.1.listing_id', $usd->id)->assertJsonPath('results.1.price_ars', 20000000)
            ->assertJsonPath('results.0.price_usd', 20000)->assertJsonPath('results.0.score', 100)
            ->assertJsonPath('results.0.vehicle.plazas', 5)->assertJsonPath('results.0.vehicle.potencia_unidad', 'CV')
            ->assertJsonPath('results.0.vehicle.android_auto_apple_carplay', true)
            ->assertJsonPath('results.0.vehicle.image_url', 'https://example.test/car.jpg')
            ->assertJsonPath('exchange_rate.quote.sell', 1000)->assertJsonPath('exchange_rate.quote.source', 'DolarAPI')
            ->assertJsonPath('exchange_rate.stale', false)->assertJsonPath('exchange_rate.warning', null);
        $this->assertStringContainsString('no-store', $response->headers->get('Cache-Control'));
        $this->assertSame(['id', 'nombre', 'provincia'], array_keys($response->json('results.0.dealer')));
        foreach (['patente', 'patente_normalizada', 'usuario_id', 'propiedad'] as $private) {
            $response->assertJsonMissingPath('results.0.vehicle.'.$private);
        }
        Http::assertSentCount(1);
    }

    public function test_live_visibility_approval_and_subscription_grace_are_respected_without_writes(): void
    {
        $this->buyer();
        $eligible = $this->car();
        Suscripcion::where('concesionaria_id', $eligible->propiedad->concesionaria_id)
            ->update(['vigente_hasta' => now()->subDays(2)->toDateString()]);
        $hidden = $this->car();
        $hidden->propiedad->update(['visible' => false]);
        $expired = $this->car();
        Suscripcion::where('concesionaria_id', $expired->propiedad->concesionaria_id)
            ->update(['vigente_hasta' => now()->subDays(4)->toDateString()]);
        $this->car([], Concesionaria::factory()->active()->create()); // No approved subscription.
        $pending = Concesionaria::factory()->create();
        Suscripcion::factory()->create(['concesionaria_id' => $pending->id, 'estado' => 'activa',
            'vigente_hasta' => now()->addMonth()->toDateString()]);
        $this->car([], $pending); // Dealer approval is independent of subscription approval.
        $this->car(['origen' => 'externo']);
        $this->car(['motor' => null]);
        $this->car(['combustible' => 'hibrido']);
        $before = $this->snapshot();
        $this->getJson('/api/recomendaciones')->assertOk()->assertJsonCount(1, 'results')
            ->assertJsonPath('results.0.listing_id', $eligible->id);
        $this->assertSame($before, $this->snapshot());
    }

    private function snapshot(): array
    {
        return array_map(fn ($table) => DB::table($table)->orderBy($table === 'vehiculo_concesionaria' ? 'vehiculo_id' : 'id')->get()->toJson(),
            ['diagnostico', 'vehiculo', 'vehiculo_concesionaria', 'foto_vehiculo', 'concesionaria', 'suscripcion']);
    }

    public function test_changed_diagnosis_and_inventory_are_recalculated_on_every_request(): void
    {
        $this->buyer();
        $car = $this->car();
        $this->getJson('/api/recomendaciones')->assertOk()->assertJsonCount(1, 'results');
        $this->putJson('/api/diagnostico', $this->answers(['pasajeros' => 'mas_5']))->assertOk();
        $this->getJson('/api/recomendaciones')->assertOk()->assertJsonPath('results', []);
        $car->update(['plazas' => 6, 'transmision' => 'automatica']);
        $this->getJson('/api/recomendaciones')->assertOk()->assertJsonPath('results', []);
        $this->putJson('/api/diagnostico', $this->answers(['pasajeros' => 'mas_5', 'transmision' => 'indiferente']))->assertOk();
        $this->getJson('/api/recomendaciones')->assertOk()->assertJsonPath('results.0.listing_id', $car->id);
        Http::assertSentCount(1); // Recompute ranking, reuse the global quote window.
    }

    public function test_budget_exception_explanations_and_concrete_top_ten_do_not_fill_with_ineligible_cars(): void
    {
        $this->buyer();
        $extra = $this->car(['precio' => 26250000]);
        $this->car(['precio' => 26250001]);
        $this->getJson('/api/recomendaciones')->assertOk()->assertJsonCount(1, 'results')
            ->assertJsonPath('results.0.score', 90)->assertJsonPath('results.0.warnings.0', 'budget_exceeded')
            ->assertJsonPath('results.0.budget_penalty', 10);
        $dealer = $extra->propiedad->concesionaria;
        for ($i = 0; $i < 12; $i++) {
            $this->car([], $dealer);
        }
        $this->getJson('/api/recomendaciones')->assertOk()->assertJsonCount(10, 'results')
            ->assertJsonPath('results.0.score', 100);
    }

    public function test_never_obtained_quote_excludes_usd_only_and_stale_quote_remains_usable(): void
    {
        $this->buyer();
        $this->car();
        $this->car(['moneda' => 'USD', 'precio' => 20000]);
        // Replace the HTTP factory to discard the default success fake.
        Http::swap(new Factory);
        Http::fakeSequence()->pushStatus(503)->push(['moneda' => 'USD', 'casa' => 'oficial', 'venta' => 1000,
            'fechaActualizacion' => '2026-10-20T12:00:00Z'])->pushStatus(503);
        $this->getJson('/api/recomendaciones')->assertOk()->assertJsonCount(1, 'results')
            ->assertJsonPath('exchange_rate.warning', 'exchange_rate_unavailable')
            ->assertJsonPath('results.0.price_usd', null);
        $this->travel(3)->hours();
        $this->getJson('/api/recomendaciones')->assertOk()->assertJsonCount(2, 'results');
        $this->travel(3)->hours();
        $this->getJson('/api/recomendaciones')->assertOk()->assertJsonCount(2, 'results')
            ->assertJsonPath('exchange_rate.stale', true)->assertJsonPath('exchange_rate.warning', 'exchange_rate_stale');
        Http::assertSentCount(3);
    }

    /**
     * HU23-MOBILE: a car of a dealer whose subscription ended on 2026-10-15, so its grace ended on 2026-10-18
     * and its retention runs until 2026-11-18. Returns the car and the bearer token of a mobile buyer.
     *
     * @return array{Vehiculo, string}
     */
    private function retainedCarForMobileBuyer(): array
    {
        $dealer = Concesionaria::factory()->active()->create();
        Suscripcion::factory()->create(['concesionaria_id' => $dealer->id, 'estado' => 'activa',
            'vigente_desde' => '2026-09-15', 'vigente_hasta' => '2026-10-15']);
        // Loaded now so the dealer stays known after the purge deletes the car.
        $car = $this->car([], $dealer)->load('propiedad');
        $token = User::factory()->create()->createToken('mobile')->plainTextToken;
        $this->withToken($token)->putJson('/api/diagnostico', $this->answers())->assertOk();
        $this->artisan('suscripciones:procesar')->assertSuccessful();

        return [$car, $token];
    }

    private function approveRenewal(Vehiculo $car): void
    {
        $receipt = ComprobantePago::factory()->create([
            'suscripcion_id' => Suscripcion::where('concesionaria_id', $car->propiedad->concesionaria_id)->value('id'),
            'periodo_desde' => now()->toDateString(),
            'periodo_hasta' => now()->addMonth()->toDateString(),
        ]);
        $this->actingAs(User::factory()->admin()->create())
            ->postJson("/api/admin/comprobantes/{$receipt->id}/aprobar")->assertOk();
        // The next request authenticates by the buyer's bearer token again, as the mobile app does.
        $this->app['auth']->forgetGuards();
    }

    public function test_hu23_mobile_inactivation_hides_the_dealer_cars_and_retains_them_for_30_days(): void
    {
        [$car, $token] = $this->retainedCarForMobileBuyer();

        $this->withToken($token)->getJson('/api/recomendaciones')->assertOk()->assertJsonPath('results', []);
        $retained = $car->propiedad->fresh();
        $this->assertFalse($retained->visible);
        $this->assertSame('2026-11-18', $retained->eliminar_desde->toDateString());
    }

    public function test_tc61_mobile_renewal_within_retention_brings_the_retained_cars_back(): void
    {
        [$car, $token] = $this->retainedCarForMobileBuyer();
        $this->travelTo(Carbon::parse('2026-11-01T12:00:00Z'));

        $this->approveRenewal($car);

        $this->withToken($token)->getJson('/api/recomendaciones')->assertOk()
            ->assertJsonCount(1, 'results')->assertJsonPath('results.0.listing_id', $car->id);
    }

    public function test_tc62_mobile_cars_are_deleted_after_retention_and_a_late_renewal_does_not_bring_them_back(): void
    {
        [$car, $token] = $this->retainedCarForMobileBuyer();
        $this->travelTo(Carbon::parse('2026-11-19T12:00:00Z'));

        $this->artisan('suscripciones:procesar')->assertSuccessful();
        $this->assertNull(Vehiculo::find($car->id));
        $this->approveRenewal($car);

        $this->withToken($token)->getJson('/api/recomendaciones')->assertOk()->assertJsonPath('results', []);
    }

    public function test_sanctum_bearer_client_reads_only_its_saved_diagnosis(): void
    {
        $user = User::factory()->create();
        $this->withToken($user->createToken('test')->plainTextToken)
            ->putJson('/api/diagnostico', $this->answers())->assertOk();
        $this->car();
        $this->getJson('/api/recomendaciones')->assertOk()->assertJsonCount(1, 'results');
    }
}
