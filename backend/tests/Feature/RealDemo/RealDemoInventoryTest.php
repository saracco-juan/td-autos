<?php

namespace Tests\Feature\RealDemo;

use App\Models\TipoCarroceria;
use App\Support\Patente;
use App\Support\VehiculoFields;
use Database\Seeders\RealDemo\RealDemoInventory;
use Database\Seeders\Support\LocalAcaraCatalogData;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Validator;
use Random\Engine\Mt19937;
use Random\Randomizer;
use RuntimeException;
use Tests\TestCase;

/**
 * UH-05 demo data: the deterministic generator behind `db:local --reales` and `demo:reales-xlsx`.
 */
class RealDemoInventoryTest extends TestCase
{
    use RefreshDatabase;

    private const COUNT = 300;

    private static ?array $snapshot = null;

    private function inventory(): RealDemoInventory
    {
        return new RealDemoInventory(self::$snapshot ??= (new LocalAcaraCatalogData)->load());
    }

    /**
     * @return array<string, array<string, mixed>> snapshot rows by version id
     */
    private function snapshotRows(): array
    {
        $rows = [];
        foreach ((self::$snapshot ??= (new LocalAcaraCatalogData)->load())['rows'] as $row) {
            $rows[$row['version_id']] = $row;
        }

        return $rows;
    }

    public function test_it_returns_exactly_the_requested_vehicles_and_is_deterministic(): void
    {
        $vehicles = $this->inventory()->vehicles(self::COUNT);

        $this->assertCount(self::COUNT, $vehicles);
        $this->assertSame($vehicles, $this->inventory()->vehicles(self::COUNT));
        $this->assertNotSame($vehicles, $this->inventory()->vehicles(self::COUNT, 7));
        $this->assertSame([], $this->inventory()->vehicles(0));
    }

    public function test_every_vehicle_passes_the_publication_rules_with_its_body_resolved_by_name(): void
    {
        $bodies = TipoCarroceria::pluck('id', 'nombre')->all();

        foreach ($this->inventory()->vehicles(self::COUNT) as $vehicle) {
            $this->assertArrayHasKey($vehicle['carroceria'], $bodies);
            $validator = Validator::make(
                [...$vehicle, 'carroceria_id' => $bodies[$vehicle['carroceria']]],
                VehiculoFields::rules(includeMatchingFacts: true),
            );
            $this->assertFalse($validator->fails(), $vehicle['marca'].' '.$vehicle['version'].': '.$validator->errors()->toJson());
        }
    }

    public function test_photos_and_plates_follow_the_import_contract(): void
    {
        $vehicles = $this->inventory()->vehicles(self::COUNT);

        foreach ($vehicles as $vehicle) {
            $this->assertCount(7, $vehicle['fotos']);
            $this->assertCount(7, array_unique($vehicle['fotos']));
            foreach ($vehicle['fotos'] as $url) {
                $this->assertStringStartsWith('https://upload.wikimedia.org/', $url);
            }
            $this->assertTrue(Patente::isValid($vehicle['patente']));
            $this->assertSame(Patente::normalize($vehicle['patente']), $vehicle['patente']);
        }
        $plates = array_column($vehicles, 'patente');
        $this->assertCount(self::COUNT, array_unique($plates));
        $this->assertTrue(count(array_filter($plates, fn ($p) => preg_match('/\A[A-Z]{3}[0-9]{3}\z/', $p) === 1)) > 0);
        $this->assertTrue(count(array_filter($plates, fn ($p) => preg_match('/\A[A-Z]{2}[0-9]{3}[A-Z]{2}\z/', $p) === 1)) > 0);
        foreach ($vehicles as $vehicle) {
            if ($vehicle['anio'] <= 2015) {
                $this->assertMatchesRegularExpression('/\A[A-Z]{3}[0-9]{3}\z/', $vehicle['patente']);
            }
        }
    }

    public function test_linked_vehicles_match_a_snapshot_row_and_price_within_ten_percent(): void
    {
        $rows = $this->snapshotRows();
        $linked = 0;

        foreach ($this->inventory()->vehicles(self::COUNT) as $vehicle) {
            if (! $vehicle['linked']) {
                continue;
            }
            $linked++;
            $row = $rows[$vehicle['acara_version_id']];
            $this->assertSame([$row['make'], $row['model'], $row['version']], [$vehicle['marca'], $vehicle['modelo'], $vehicle['version']]);
            $this->assertSame($row['currency'], $vehicle['moneda']);
            $reference = (float) $row['values'][(string) $vehicle['anio']];
            $rounding = $vehicle['moneda'] === 'ARS' ? 25000 : 50;
            $this->assertGreaterThanOrEqual($reference * 0.90 - $rounding, $vehicle['precio']);
            $this->assertLessThanOrEqual($reference * 1.10 + $rounding, $vehicle['precio']);
            $this->assertSame(0, $vehicle['precio'] % ($vehicle['moneda'] === 'ARS' ? 50000 : 100));
            $this->assertGreaterThanOrEqual(2012, $vehicle['anio']);
            $this->assertLessThanOrEqual(2025, $vehicle['anio']);
        }

        // About 15% stay unlinked: they keep the text but have no catalog identity in the local load.
        $this->assertGreaterThan(self::COUNT * 0.70, $linked);
        $this->assertLessThan(self::COUNT, $linked);
    }

    public function test_mileage_transmission_and_engine_facts_follow_the_version(): void
    {
        foreach ($this->inventory()->vehicles(self::COUNT) as $vehicle) {
            $age = max(2026 - $vehicle['anio'], 1);
            $this->assertGreaterThanOrEqual($age * 8000 - 50, $vehicle['kilometraje']);
            $this->assertLessThanOrEqual($age * 18000 + 50, $vehicle['kilometraje']);
            $this->assertSame(0, $vehicle['kilometraje'] % 100);
            $automatic = preg_match('/(?<![A-Za-z])(AT|CVT|DSG|Tiptronic|Aut|Automática|eCVT|DCT|Powershift)(?![A-Za-z])/iu', $vehicle['version']) === 1;
            $this->assertSame($automatic ? 'automatica' : 'manual', $vehicle['transmision']);
            $this->assertSame('CV', $vehicle['potencia_unidad']);
            $this->assertSame(5, $vehicle['plazas']);
            if (in_array($vehicle['combustible'], ['nafta', 'diesel'], true)) {
                $this->assertNotNull($vehicle['consumo_urbano']);
                $this->assertNotNull($vehicle['consumo_ruta']);
            }
        }
    }

    public function test_the_first_listed_engine_and_trim_match_wins(): void
    {
        $byVersion = [];
        foreach ($this->inventory()->vehicles(2000) as $vehicle) {
            $byVersion[$vehicle['marca'].'|'.$vehicle['modelo'].'|'.$vehicle['version']] ??= $vehicle;
        }

        $hybrid = array_filter($byVersion, fn ($v) => str_starts_with($v['version'], 'Hybrid 1.8 XEI'));
        $this->assertNotEmpty($hybrid);
        foreach ($hybrid as $vehicle) {
            $this->assertSame('hibrido', $vehicle['combustible']);
            $this->assertNull($vehicle['consumo_urbano']);
        }

        $v6 = array_filter($byVersion, fn ($v) => str_starts_with($v['version'], '3.0 V6 XLS'));
        $this->assertNotEmpty($v6);
        foreach ($v6 as $vehicle) {
            $this->assertSame(250, $vehicle['potencia']);
            // The V6 engine is listed before "3.0", and XLS before "XL" (a base trim that also matches).
            $this->assertSame(12.2, $vehicle['consumo_urbano']);
            $this->assertTrue($vehicle['volante_regulable']);
            $this->assertFalse($vehicle['punto_ciego']);
        }

        $limited = array_filter($byVersion, fn ($v) => $v['modelo'] === 'Ranger' && str_contains($v['version'], 'Limited'));
        $this->assertNotEmpty($limited);
        foreach ($limited as $vehicle) {
            $this->assertTrue($vehicle['camara_retroceso']);
        }
    }

    public function test_a_shorter_match_listed_first_beats_a_longer_one_listed_later(): void
    {
        $models = json_decode(file_get_contents(database_path('seeders/assets/real-demo/models.json')), true);
        foreach ($models as &$model) {
            if ($model['model'] === 'Ranger') {
                // "3.0" first: the generic engine must now win over "3.0 V6", and "xl" (any case) over "XLS".
                usort($model['engines'], fn ($a, $b) => [$b['match'] === '3.0'] <=> [$a['match'] === '3.0']);
                $model['trims'] = [['match' => ['xl'], 'tier' => 'base'], ['match' => ['XLS'], 'tier' => 'top']];
            }
        }
        unset($model);

        $vehicles = (new RealDemoInventory((new LocalAcaraCatalogData)->load(), $models))->vehicles(2000);
        $v6 = array_values(array_filter($vehicles, fn ($v) => str_starts_with($v['version'], '3.0 V6 XLS')));

        $this->assertNotEmpty($v6);
        foreach ($v6 as $vehicle) {
            $this->assertEquals(11.0, $vehicle['consumo_urbano']);
            $this->assertFalse($vehicle['camara_retroceso']);
        }
    }

    public function test_versions_matching_no_engine_are_excluded_instead_of_falling_back(): void
    {
        $models = json_decode(file_get_contents(database_path('seeders/assets/real-demo/models.json')), true);
        foreach ($models as &$model) {
            // Ranger keeps only its 2.2 engine; Gol Trend (the only Hatchback) matches nothing at all.
            $model['engines'] = match ($model['model']) {
                'Ranger' => array_values(array_filter($model['engines'], fn ($e) => $e['match'] === '2.2')),
                'Gol Trend' => [[...$model['engines'][0], 'match' => 'no-such-engine']],
                default => $model['engines'],
            };
        }
        unset($model);

        $vehicles = (new RealDemoInventory((new LocalAcaraCatalogData)->load(), $models))->vehicles(1500);

        $this->assertCount(1500, $vehicles);
        $ranger = array_filter($vehicles, fn ($v) => $v['modelo'] === 'Ranger');
        $this->assertNotEmpty($ranger);
        foreach ($ranger as $vehicle) {
            $this->assertStringContainsString('2.2', $vehicle['version']);
        }
        // A model left without candidates is not drawn, and its body drops out of the mix.
        $this->assertNotContains('Gol Trend', array_column($vehicles, 'modelo'));
        $this->assertNotContains('Hatchback', array_column($vehicles, 'carroceria'));
    }

    public function test_driver_assistance_is_off_before_2018(): void
    {
        $old = 0;
        foreach ($this->inventory()->vehicles(1000) as $vehicle) {
            if ($vehicle['anio'] >= 2018) {
                continue;
            }
            $old++;
            foreach (['frenado_autonomo', 'asistencia_carril', 'punto_ciego', 'monitoreo_conductor', 'asistencia_velocidad'] as $field) {
                $this->assertFalse($vehicle[$field], "{$field} in {$vehicle['anio']}");
            }
        }
        $this->assertGreaterThan(0, $old);
    }

    public function test_provisional_data_only_yields_the_bodies_it_has(): void
    {
        $bodies = array_unique(array_column($this->inventory()->vehicles(self::COUNT), 'carroceria'));
        sort($bodies);

        $this->assertSame(['Hatchback', 'Pickup', 'Sedán'], $bodies);
    }

    public function test_body_weights_follow_the_mix_and_normalize_over_the_available_bodies(): void
    {
        $randomizer = new Randomizer(new Mt19937(11));
        $all = array_keys(RealDemoInventory::BODY_MIX);
        $counts = array_fill_keys($all, 0);
        for ($i = 0; $i < 2000; $i++) {
            $counts[RealDemoInventory::pickBody($randomizer, $all)]++;
        }
        foreach (RealDemoInventory::BODY_MIX as $body => $share) {
            $this->assertEqualsWithDelta($share / 100, $counts[$body] / 2000, 0.03, $body);
        }

        $two = array_fill_keys(['Hatchback', 'Sedán'], 0);
        for ($i = 0; $i < 2000; $i++) {
            $two[RealDemoInventory::pickBody($randomizer, ['Hatchback', 'Sedán'])]++;
        }
        $this->assertEqualsWithDelta(35 / 60, $two['Hatchback'] / 2000, 0.04);
    }

    public function test_dealers_are_ten_real_towns_in_six_provinces_with_uneven_stock(): void
    {
        $dealers = RealDemoInventory::DEALERS;

        $this->assertCount(10, $dealers);
        $this->assertCount(10, array_unique(array_column($dealers, 'slug')));
        $this->assertSame(
            ['Buenos Aires' => 3, 'CABA' => 2, 'Córdoba' => 2, 'Santa Fe' => 1, 'Mendoza' => 1, 'Tucumán' => 1],
            array_count_values(array_column($dealers, 'provincia')),
        );

        $perDealer = array_count_values(array_column($this->inventory()->vehicles(800), 'dealer'));
        $this->assertCount(10, $perDealer);
        $this->assertGreaterThan(2 * min($perDealer), max($perDealer));
        foreach ($this->inventory()->vehicles(40) as $vehicle) {
            $town = null;
            foreach ($dealers as $dealer) {
                $dealer['slug'] === $vehicle['dealer'] && $town = $dealer['localidad'];
            }
            $this->assertSame($town, $vehicle['ubicacion']);
        }
    }

    public function test_a_model_with_fewer_than_seven_photos_fails_loudly_naming_it(): void
    {
        $models = json_decode(file_get_contents(database_path('seeders/assets/real-demo/models.json')), true);
        $models[0]['photos'] = array_slice($models[0]['photos'], 0, 6);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('TOYOTA Corolla');

        new RealDemoInventory((new LocalAcaraCatalogData)->load(), $models);
    }
}
