<?php

namespace Tests\Feature\Inventario;

use App\Models\Vehiculo;
use App\Services\Catalog\FixedAcaraCatalog;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/** Workbook dropdowns are editable: catalog identity is enforced again on the server. */
class CatalogImportTest extends TestCase
{
    use InteractsWithImportXlsx;
    use InteractsWithVehiculos;
    use RefreshDatabase;

    private const URL = '/api/concesionaria/vehiculos/importar';

    public function test_rows_without_dropdowns_are_validated_and_linked_even_without_source_prices(): void
    {
        $this->actingAs($this->dealer())->postJson(self::URL, [
            'archivo' => $this->workbookFile($this->workbookContent([$this->workbookRow()])),
        ])->assertOk()->assertExactJson(['nuevos' => 1, 'actualizaciones' => 0]);
        $vehicle = Vehiculo::query()->sole();
        $this->assertSame($this->catalogId('Toyota', 'Corolla', 'XEI 2.0 CVT'), $vehicle->acara_version_id);
        $this->assertEquals(25000000, $vehicle->precio);
    }

    public static function invalidIdentities(): array
    {
        return [
            'unknown version' => [['version' => 'Invented']],
            'wrong chain' => [['marca' => 'Ford']],
            'blank version' => [['version' => '']],
            'no fuzzy case match' => [['marca' => 'toyota']],
        ];
    }

    #[DataProvider('invalidIdentities')]
    public function test_unknown_identity_rejects_the_whole_batch_in_preview_and_apply(array $identity): void
    {
        $user = $this->dealer();
        $existing = $this->vehicleOf($user->concesionaria, 7, 'ABC123');
        $before = $existing->fresh()->getAttributes();
        foreach (['ABC123', 'DEF456'] as $plate) {
            foreach (['/vista-previa', ''] as $suffix) {
                $this->actingAs($user)->postJson(self::URL.$suffix, [
                    'archivo' => $this->workbookFile($this->workbookContent([
                        $this->workbookRow(), $this->workbookRow(['patente' => $plate, ...$identity]),
                    ])),
                ])->assertUnprocessable()->assertJsonPath('errores.0.fila', 3)
                    ->assertJsonPath('errores.0.mensajes', ['La marca, el modelo y la versión no coinciden con el catálogo. Volvé a seleccionarlos.']);
                $this->assertSame($before, $existing->fresh()->getAttributes());
                $this->assertDatabaseCount('vehiculo', 1);
                $this->assertDatabaseCount('foto_vehiculo', 7);
            }
        }
    }

    public function test_unavailable_catalog_rejects_new_identity_without_writes(): void
    {
        Cache::store('catalog')->forget(FixedAcaraCatalog::cacheKey());
        foreach (['/vista-previa', ''] as $suffix) {
            $this->actingAs($this->dealer())->postJson(self::URL.$suffix, [
                'archivo' => $this->workbookFile($this->workbookContent([$this->workbookRow()])),
            ])->assertUnprocessable()->assertJsonPath('errores.0.mensajes', ['El catálogo no está disponible. Intentá de nuevo más tarde.']);
        }
        $this->assertDatabaseCount('vehiculo', 0);
    }

    public static function legacyLinks(): array
    {
        return [[null], ['acara:'.str_repeat('a', 64)]];
    }

    #[DataProvider('legacyLinks')]
    public function test_unchanged_legacy_identity_remains_editable_during_catalog_outage(?string $id): void
    {
        $user = $this->dealer();
        $existing = $this->vehicleOf($user->concesionaria, 7, 'AB123CD');
        $existing->update(['marca' => 'Legacy', 'modelo' => 'Old', 'version' => null, 'acara_version_id' => $id]);
        Cache::store('catalog')->forget(FixedAcaraCatalog::cacheKey());
        $this->actingAs($user)->postJson(self::URL, [
            'archivo' => $this->workbookFile($this->workbookContent([
                $this->workbookRow(['marca' => 'Legacy', 'modelo' => 'Old', 'version' => '', 'precio' => '12345']),
            ])),
        ])->assertOk()->assertExactJson(['nuevos' => 0, 'actualizaciones' => 1]);
        $this->assertEquals(12345, $existing->fresh()->precio);
        $this->assertSame($id, $existing->fresh()->acara_version_id);
        $this->assertNull($existing->fresh()->version);
    }

    public function test_ambiguous_labels_are_not_guessed(): void
    {
        $snapshot = Cache::store('catalog')->get(FixedAcaraCatalog::cacheKey());
        $snapshot['rows'][] = [...$snapshot['rows'][0], 'version_id' => 'acara:'.str_repeat('f', 64)];
        Cache::store('catalog')->forever(FixedAcaraCatalog::cacheKey(), $snapshot);
        $this->actingAs($this->dealer())->postJson(self::URL, [
            'archivo' => $this->workbookFile($this->workbookContent([$this->workbookRow(), $this->workbookRow(['patente' => 'ABC123'])])),
        ])->assertUnprocessable()->assertJsonPath('errores.0.fila', 2)->assertJsonPath('errores.1.fila', 3)
            ->assertJsonPath('errores.0.mensajes', ['La selección del catálogo es ambigua. Revisá la versión antes de importar.']);
        $this->assertDatabaseCount('vehiculo', 0);
    }
}
