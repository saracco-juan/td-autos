<?php

namespace Tests\Feature\Resale;

use App\Models\Concesionaria;
use App\Services\Catalog\FixedAcaraCatalog;
use App\Services\Resale\AcaraPriceReader;
use App\Services\Resale\AcaraPriceSource;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Tests\Fixtures\AcaraPdf;
use Tests\TestCase;

class FixedAcaraSourceTest extends TestCase
{
    use RefreshDatabase;

    public function test_fixed_source_survives_cache_loss_preserves_catalog_api_and_age_warning(): void
    {
        Http::preventStrayRequests();
        $this->travelTo(now()->parse('2026-10-24T12:00:00Z'));
        $this->assertNull(app(AcaraPriceSource::class)->current()['snapshot']);
        app(FixedAcaraCatalog::class)->import(app(AcaraPriceReader::class)->read(AcaraPdf::make()));
        $first = app(AcaraPriceSource::class)->current()['snapshot'];
        $this->actingAs(Concesionaria::factory()->active()->create()->usuario)
            ->getJson('/api/concesionaria/vehiculos/catalogo')->assertOk()
            ->assertJsonCount(1, 'entries')->assertJsonPath('entries.0.id', $first['rows'][0]['version_id']);
        $this->assertDatabaseCount('vehiculo', 0);
        $this->travel(14)->days();
        Cache::store('catalog')->flush();
        $state = app(AcaraPriceSource::class)->current();
        $this->assertSame($first, $state['snapshot']);
        $this->assertTrue($state['stale']);
        $this->assertSame('acara_stale', $state['warning']);
        Http::assertNothingSent();
    }

    public function test_acara_acquisition_is_removed_but_unrelated_schedules_remain(): void
    {
        $this->assertArrayNotHasKey('acara:refresh', Artisan::all());
        $events = collect(app(Schedule::class)->events());
        $this->assertNull($events->first(fn ($event) => str_contains($event->command, 'acara:refresh')));
        $this->assertSame('0 1 * * *', $events->first(fn ($event) => str_contains($event->command, 'dnrpa:refresh'))->expression);
        $this->assertSame('0 * * * *', $events->first(fn ($event) => str_contains($event->command, 'suscripciones:procesar'))->expression);
    }
}
