<?php

namespace Tests\Feature\Inventario;

use App\Models\Concesionaria;
use App\Models\User;
use App\Models\Vehiculo;
use App\Services\Catalog\FixedAcaraCatalog;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/** HU21/HU22: both inventory input paths share a local, price-independent catalog. */
class VehicleCatalogTest extends TestCase
{
    use RefreshDatabase;

    private const URL = '/api/concesionaria/vehiculos/catalogo';

    public function test_catalog_requires_an_authenticated_approved_dealer(): void
    {
        $this->getJson(self::URL)->assertUnauthorized();
        $this->actingAs(User::factory()->create())->getJson(self::URL)->assertForbidden();
        $this->actingAs(Concesionaria::factory()->create()->usuario)
            ->getJson(self::URL)->assertForbidden();
    }

    public function test_catalog_unavailability_is_explicit_without_downloading_a_pdf(): void
    {
        Http::preventStrayRequests();
        $this->actingAs(Concesionaria::factory()->active()->create()->usuario)
            ->getJson(self::URL)->assertStatus(503)->assertExactJson([
                'snapshot_id' => null, 'source_date' => null, 'stale' => false,
                'warning' => 'acara_unavailable', 'entries' => [],
            ]);
    }

    public function test_catalog_preserves_missing_price_versions_and_deduplicates_only_identity(): void
    {
        Http::preventStrayRequests();
        $fiat = $this->row('FIAT', 'STRADA', '1.3 Freedom Cab.Doble');
        $chevrolet = $this->row('CHEVROLET', 'ONIX', '1.2 MT LT (90cv) 5Ptas.');
        $snapshot = $this->snapshot([
            $fiat,
            $chevrolet,
            array_replace($fiat, ['values' => [2024 => '20000000']]),
        ]);
        $count = Vehiculo::query()->count();
        $this->actingAs(Concesionaria::factory()->active()->create()->usuario)
            ->getJson(self::URL)->assertOk()->assertExactJson([
                'snapshot_id' => 'acara:test', 'source_date' => '2026-10-19', 'stale' => false,
                'warning' => null, 'entries' => [$this->entry($chevrolet), $this->entry($fiat)],
            ]);
        $this->assertSame($snapshot, Cache::store('catalog')->get(FixedAcaraCatalog::cacheKey()));
        $this->assertSame($count, Vehiculo::query()->count());
    }

    public function test_conflicting_identity_keys_are_not_arbitrarily_assigned(): void
    {
        $row = $this->row('FIAT', 'STRADA', 'Freedom');
        $this->snapshot([$row, array_replace($row, ['version' => 'Ultra'])]);
        $this->actingAs(Concesionaria::factory()->active()->create()->usuario)
            ->getJson(self::URL)->assertOk()->assertJsonPath('entries', []);
    }

    public function test_stale_catalog_retains_its_identity_and_exposes_the_warning(): void
    {
        $row = $this->row('FIAT', 'STRADA', 'Freedom');
        $snapshot = $this->snapshot([$row]);
        $snapshot['fetched_at'] = now()->subDays(15)->toIso8601String();
        Cache::store('catalog')->forever(FixedAcaraCatalog::cacheKey(), $snapshot);
        $this->actingAs(Concesionaria::factory()->active()->create()->usuario)
            ->getJson(self::URL)->assertOk()->assertJsonPath('stale', true)
            ->assertJsonPath('warning', 'acara_stale')
            ->assertJsonPath('entries.0.id', $row['version_id']);
    }

    private function row(string $make, string $model, string $version): array
    {
        return ['make' => $make, 'model' => $model, 'version' => $version,
            'version_id' => 'acara:'.hash('sha256', json_encode([$make, $model, $version], JSON_THROW_ON_ERROR)),
            'currency' => 'ARS', 'values' => [2024 => null]];
    }

    private function entry(array $row): array
    {
        return ['id' => $row['version_id'], 'marca' => $row['make'],
            'modelo' => $row['model'], 'version' => $row['version']];
    }

    private function snapshot(array $rows): array
    {
        $snapshot = ['snapshot_id' => 'acara:test', 'source_date' => '2026-10-19',
            'fetched_at' => now()->toIso8601String(), 'rows' => $rows];
        Cache::store('catalog')->forever(FixedAcaraCatalog::cacheKey(), $snapshot);

        return $snapshot;
    }
}
