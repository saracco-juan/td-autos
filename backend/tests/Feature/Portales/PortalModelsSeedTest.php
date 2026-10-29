<?php

namespace Tests\Feature\Portales;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * The shipped curated models must point at real ACARA catalog models, because the reference prices come from there.
 */
class PortalModelsSeedTest extends TestCase
{
    use RefreshDatabase;

    private const BODY_TYPES = ['Sedán', 'Hatchback', 'SUV', 'Pickup', 'Furgón', 'Rural / familiar'];

    /**
     * @return list<array<string, mixed>>
     */
    private function rows(): array
    {
        return json_decode((string) file_get_contents(database_path('seeders/assets/portal-models.json')), true, 512, JSON_THROW_ON_ERROR);
    }

    public function test_every_model_resolves_to_an_acara_catalog_model_with_prices(): void
    {
        Cache::store('catalog')->flush();
        $this->artisan('catalog:load-bundled')->assertSuccessful();

        $priced = DB::table('catalog_models')
            ->join('catalog_brands', 'catalog_brands.id', '=', 'catalog_models.brand_id')
            ->join('catalog_versions', 'catalog_versions.model_id', '=', 'catalog_models.id')
            ->join('catalog_prices', 'catalog_prices.version_id', '=', 'catalog_versions.id')
            ->whereNotNull('catalog_prices.amount')
            ->select('catalog_brands.name as marca', 'catalog_models.name as modelo')
            ->distinct()->get()
            ->mapWithKeys(fn (object $row) => [$row->marca.'|'.$row->modelo => true]);

        $missing = collect($this->rows())
            ->map(fn (array $row) => $row['marca'].'|'.$row['modelo'])
            ->reject(fn (string $key) => $priced->has($key))->values()->all();

        $this->assertSame([], $missing, 'Models missing from the ACARA catalog (or without any price)');
    }

    public function test_the_seed_has_a_diverse_set_of_unique_models(): void
    {
        $rows = $this->rows();
        $keys = array_map(fn (array $row) => $row['marca'].'|'.$row['modelo'], $rows);

        $this->assertGreaterThanOrEqual(30, count($rows));
        $this->assertLessThanOrEqual(40, count($rows));
        $this->assertSame($keys, array_values(array_unique($keys)));
        $this->assertEqualsCanonicalizing(['Sedán', 'Hatchback', 'SUV', 'Pickup', 'Rural / familiar'], array_values(array_unique(array_column($rows, 'carroceria'))));
    }

    public function test_every_row_has_valid_values(): void
    {
        foreach ($this->rows() as $row) {
            $label = $row['marca'].' '.$row['modelo'];

            $this->assertContains($row['carroceria'], self::BODY_TYPES, $label);
            $this->assertGreaterThanOrEqual(2, $row['plazas'], $label);
            $this->assertLessThanOrEqual(7, $row['plazas'], $label);
            $this->assertTrue($row['tiene_manual'] || $row['tiene_automatica'], "$label: no transmission");
            $this->assertNotEmpty($row['combustibles'], $label);
            $this->assertSame([], array_diff($row['combustibles'], ['nafta', 'diesel', 'gnc', 'electrico']), $label);
            $this->assertContains($row['consumo'], ['bajo', 'medio', 'alto'], $label);
            $this->assertNotEmpty($row['usos'], $label);
            $this->assertSame([], array_diff($row['usos'], ['ciudad', 'ruta', 'trabajo']), $label);
            $stars = $row['seguridad_estrellas'];
            $this->assertTrue($stars === null || (is_int($stars) && $stars >= 0 && $stars <= 5), "$label: stars");
            $this->assertMatchesRegularExpression('#^[a-z0-9]+(-[a-z0-9]+)*/[a-z0-9]+(-[a-z0-9]+)*$#', $row['ruta_mercadolibre'], $label);
            if ($row['ruta_kavak'] !== null) {
                $this->assertMatchesRegularExpression('#^[a-z0-9]+(-[a-z0-9]+)*/[a-z0-9]+(-[a-z0-9]+)*$#', $row['ruta_kavak'], $label);
            }
        }
    }

    public function test_the_shipped_file_loads_with_the_command(): void
    {
        $this->artisan('portales:load-models')->assertSuccessful();

        $this->assertSame(count($this->rows()), DB::table('modelo_referencia')->count());
    }
}
