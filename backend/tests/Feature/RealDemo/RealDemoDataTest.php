<?php

namespace Tests\Feature\RealDemo;

use App\Models\TipoCarroceria;
use App\Support\VehiculoFields;
use Database\Seeders\RealDemo\RealDemoInventory;
use Database\Seeders\Support\LocalAcaraCatalogData;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Validator;
use Tests\TestCase;

/**
 * UH-05 demo data: the researched `models.json` produces a valid, varied 800-vehicle inventory.
 */
class RealDemoDataTest extends TestCase
{
    use RefreshDatabase;

    private const COUNT = 800;

    /** @var list<array<string, mixed>>|null */
    private static ?array $vehicles = null;

    private static ?array $snapshot = null;

    /**
     * @return list<array<string, mixed>>
     */
    private function vehicles(): array
    {
        self::$snapshot ??= (new LocalAcaraCatalogData)->load();

        return self::$vehicles ??= (new RealDemoInventory(self::$snapshot))->vehicles(self::COUNT);
    }

    private function models(): array
    {
        return json_decode(file_get_contents(database_path(RealDemoInventory::DATA_FILE)), true, 512, JSON_THROW_ON_ERROR);
    }

    public function test_every_vehicle_of_the_default_run_passes_the_publication_rules(): void
    {
        $bodies = TipoCarroceria::pluck('id', 'nombre')->all();

        $this->assertCount(self::COUNT, $this->vehicles());
        foreach ($this->vehicles() as $vehicle) {
            $this->assertArrayHasKey($vehicle['carroceria'], $bodies);
            $validator = Validator::make(
                [...$vehicle, 'carroceria_id' => $bodies[$vehicle['carroceria']]],
                VehiculoFields::rules(includeMatchingFacts: true),
            );
            $this->assertFalse($validator->fails(), $vehicle['marca'].' '.$vehicle['version'].': '.$validator->errors()->toJson());
        }
    }

    public function test_every_model_has_free_licensed_wikimedia_photos(): void
    {
        foreach ($this->models() as $model) {
            $name = $model['make'].' '.$model['model'];
            $this->assertGreaterThanOrEqual(7, count($model['photos']), $name);
            foreach ($model['photos'] as $photo) {
                $this->assertStringStartsWith('https://upload.wikimedia.org/', $photo['url'], $name);
                $this->assertMatchesRegularExpression('/\A(CC0|Public domain|CC BY(-SA)?\b.*)\z/', $photo['license'], $name);
            }
        }
    }

    public function test_linked_vehicles_match_their_snapshot_row(): void
    {
        $this->vehicles();
        $rows = [];
        foreach (self::$snapshot['rows'] as $row) {
            $rows[$row['version_id']] = $row;
        }

        $linked = 0;
        foreach ($this->vehicles() as $vehicle) {
            if (! $vehicle['linked']) {
                continue;
            }
            $linked++;
            $row = $rows[$vehicle['acara_version_id']];
            $this->assertSame([$row['make'], $row['model'], $row['version'], $row['currency']], [$vehicle['marca'], $vehicle['modelo'], $vehicle['version'], $vehicle['moneda']]);
        }
        $this->assertGreaterThan(self::COUNT * 0.75, $linked);
    }

    public function test_the_body_mix_is_close_to_the_target(): void
    {
        $counts = array_count_values(array_column($this->vehicles(), 'carroceria'));

        foreach (RealDemoInventory::BODY_MIX as $body => $share) {
            if (in_array($body, array_column($this->models(), 'body'), true)) {
                $this->assertEqualsWithDelta($share, ($counts[$body] ?? 0) / self::COUNT * 100, 5, $body);
            }
        }
    }

    public function test_the_inventory_is_varied(): void
    {
        $models = array_unique(array_map(fn ($v) => $v['marca'].'|'.$v['modelo'], $this->vehicles()));

        $this->assertGreaterThanOrEqual(60, count($models));
    }

    public function test_fuel_facts_are_complete_for_every_engine_of_the_data(): void
    {
        foreach ($this->models() as $model) {
            foreach ($model['engines'] as $engine) {
                $this->assertGreaterThan(0, $engine['power_cv'], $model['model'].' '.$engine['match']);
                if (in_array($engine['fuel'], ['nafta', 'diesel'], true)) {
                    $this->assertNotNull($engine['consumo_urbano'] ?? null, $model['model'].' '.$engine['match']);
                    $this->assertNotNull($engine['consumo_ruta'] ?? null, $model['model'].' '.$engine['match']);
                }
            }
        }
    }
}
