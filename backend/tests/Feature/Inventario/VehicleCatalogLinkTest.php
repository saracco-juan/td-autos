<?php

namespace Tests\Feature\Inventario;

use App\Models\TipoCarroceria;
use App\Models\Vehiculo;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/** HU21: catalog selection is validated on the server without rewriting legacy inventory. */
class VehicleCatalogLinkTest extends TestCase
{
    use InteractsWithVehiculos;
    use RefreshDatabase;

    private const URL = '/api/concesionaria/vehiculos';

    private function catalog(): string
    {
        $id = 'acara:'.hash('sha256', 'test-corolla');
        Cache::forever('resale.acara.last-valid.v1', [
            'snapshot_id' => 'acara:test', 'source_date' => now()->toDateString(),
            'fetched_at' => now()->toIso8601String(), 'rows' => [
                ['version_id' => $id, 'make' => 'Toyota', 'model' => 'Corolla',
                    'version' => 'XEI 2.0 CVT', 'currency' => 'ARS', 'values' => [2021 => null]],
            ],
        ]);

        return $id;
    }

    public function test_hu21_selected_identity_round_trips_even_without_year_prices(): void
    {
        TipoCarroceria::query()->firstOrCreate(['nombre' => 'Sedán']);
        $id = $this->catalog();
        $response = $this->actingAs($this->dealer())->postJson(self::URL, $this->payload(['acara_version_id' => $id]));
        $response->assertCreated()->assertJsonPath('vehiculo.acara_version_id', $id)->assertJsonCount(7, 'vehiculo.fotos');
        $this->getJson(self::URL.'/'.$response->json('vehiculo.id'))->assertOk()->assertJsonPath('vehiculo.acara_version_id', $id);
        $this->getJson(self::URL)->assertOk()->assertJsonPath('vehiculos.0.acara_version_id', $id);
        $this->assertDatabaseHas('vehiculo', ['id' => $response->json('vehiculo.id'), 'acara_version_id' => $id]);
    }

    public function test_missing_unknown_mismatched_or_unavailable_selection_never_writes(): void
    {
        TipoCarroceria::query()->firstOrCreate(['nombre' => 'Sedán']);
        $id = $this->catalog();
        $this->actingAs($this->dealer());
        foreach ([[], ['acara_version_id' => 'unknown'], ['acara_version_id' => $id, 'modelo' => 'Onix']] as $changes) {
            $this->postJson(self::URL, $this->payload($changes))->assertUnprocessable()->assertJsonValidationErrors('acara_version_id');
            $this->assertDatabaseCount('vehiculo', 0);
            $this->assertSame([], Storage::disk($this->disk)->allFiles());
        }
        Cache::forget('resale.acara.last-valid.v1');
        $this->postJson(self::URL, $this->payload(['acara_version_id' => $id]))->assertUnprocessable()->assertJsonValidationErrors('acara_version_id');
        $this->assertDatabaseCount('vehiculo', 0);
    }

    public function test_legacy_identity_can_be_preserved_but_not_replaced_without_selection(): void
    {
        TipoCarroceria::query()->firstOrCreate(['nombre' => 'Sedán']);
        $user = $this->dealer();
        $vehicle = $this->vehicleOf($user->concesionaria);
        $input = $this->payload([...$vehicle->only(['marca', 'modelo', 'version']), 'precio' => 12345]);
        unset($input['fotos']);
        $this->actingAs($user)->postJson(self::URL.'/'.$vehicle->id, $input)->assertOk()
            ->assertJsonPath('vehiculo.acara_version_id', null)->assertJsonPath('vehiculo.precio', 12345);
        $before = $vehicle->fresh()->getAttributes();
        $this->postJson(self::URL.'/'.$vehicle->id, [...$input, 'modelo' => 'Changed'])->assertUnprocessable()->assertJsonValidationErrors('acara_version_id');
        $this->assertSame($before, $vehicle->fresh()->getAttributes());
    }

    public function test_existing_link_survives_source_outage_and_cannot_be_silently_cleared(): void
    {
        TipoCarroceria::query()->firstOrCreate(['nombre' => 'Sedán']);
        $id = $this->catalog();
        $this->actingAs($this->dealer());
        $input = $this->payload(['acara_version_id' => $id]);
        $created = $this->postJson(self::URL, $input)->assertCreated();
        unset($input['fotos']);
        Cache::forget('resale.acara.last-valid.v1');
        foreach ([$id, null] as $submitted) {
            $this->postJson(self::URL.'/'.$created->json('vehiculo.id'), [...$input, 'acara_version_id' => $submitted, 'precio' => 12345])
                ->assertOk()->assertJsonPath('vehiculo.acara_version_id', $id);
        }
        $this->assertSame($id, Vehiculo::query()->firstOrFail()->acara_version_id);
    }
}
