<?php

namespace Tests\Feature\Calculadora;

use App\Models\CalculatorRefreshSnapshot;
use App\Models\Concesionaria;
use App\Models\Suscripcion;
use App\Models\User;
use App\Models\Vehiculo;
use App\Models\VehiculoConcesionaria;
use App\Services\Calculadora\CalculatorRatesStore;
use App\Services\Calculadora\EffectiveRates;
use App\Support\VehiculoFields;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Factory;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class CalculatorRefreshTest extends TestCase
{
    use RefreshDatabase;

    private const PACKAGE = 'http://datos.energia.gob.ar/api/3/action/package_show?id=precios-en-surtidor';

    private const CSV_URL = 'http://datos.energia.gob.ar/dataset/x/resource/y/download/precios.csv';

    private const CPI = 'https://apis.datos.gob.ar/series/api/series/*';

    private const HEADER = 'indice_tiempo,idempresa,cuit,empresa,direccion,localidad,provincia,region,idproducto,producto,idtipohorario,tipohorario,precio,fecha_vigencia,idempresabandera,empresabandera,latitud,longitud,geojson';

    protected function setUp(): void
    {
        parent::setUp();
        config(['cache.default' => 'array']);
        Cache::flush();
        $this->travelTo(Carbon::parse('2026-11-01T07:00:00Z'));
        config(['calculadora' => $this->baseConfig()]);
    }

    private function baseConfig(array $changes = []): array
    {
        return array_replace([
            'updated_at' => '2026-10-01',
            'cpi_base_month' => '2026-08',
            'rounding' => 1000,
            'km_per_month' => ['menos_500' => 500, '500_1500' => 1500, '1500_3000' => 3000, 'mas_3000' => 4500, 'no_sabe' => 1500],
            'fuel_prices' => ['nafta' => 1000, 'diesel' => 900, 'gnc' => 500],
            'insurance' => [
                'tc_base' => ['hatchback' => 100000, 'pickup' => 150000],
                'value_rate_tc' => 0.023,
                'zone_factor' => ['cordoba' => 0.8, 'default' => 0.8],
                'tr_ratio' => ['hatchback' => 1.8, 'pickup' => 2.35],
                'value_rate_tr' => 0.06,
                'cpi_base_month' => '2026-10',
            ],
            'transfer' => ['dnrpa_rate' => 0.01, 'fixed_costs' => 100000, 'stamp_rate' => ['cordoba' => 0.02, 'caba' => 0.01]],
            'patente' => [
                'cpi_base_month' => '2026-02',
                'scale' => ['buenos_aires' => [
                    ['up_to' => 14100000, 'fixed' => 0, 'rate' => 0.01], ['up_to' => 18700000, 'fixed' => 141000, 'rate' => 0.02],
                    ['up_to' => 26100000, 'fixed' => 233000, 'rate' => 0.03], ['up_to' => null, 'fixed' => 455000, 'rate' => 0.04],
                ]],
                'bracket_rate' => ['cordoba' => [['up_to' => 20000000, 'rate' => 0.025], ['up_to' => null, 'rate' => 0.03]]],
                'flat_rate' => ['caba' => 0.01, 'mendoza' => 0.03],
            ],
            'service' => [
                'fuel_factor' => ['nafta' => 1.0, 'diesel' => 1.0, 'hibrido' => 1.0, 'gnc' => 1.15, 'electrico' => 0.5],
                'brands' => [
                    'toyota' => [
                        'label' => 'Toyota', 'aliases' => [], 'interval_km' => 10000, 'interval_months' => 12, 'cpi_base_month' => '2026-08',
                        'models' => ['yaris' => 360000], 'body' => ['hatchback' => 360000],
                    ],
                    'volkswagen' => [
                        'label' => 'Volkswagen', 'aliases' => ['vw'], 'interval_km' => 15000, 'interval_months' => 12, 'cpi_base_month' => '2025-12',
                        'models' => ['gol' => 320000], 'body' => ['hatchback' => 380000],
                    ],
                ],
                'fallback' => [
                    'interval_km' => 10000, 'interval_months' => 12, 'cpi_base_month' => '2025-09',
                    'body' => ['hatchback' => 200000, 'sedan' => 380000],
                ],
            ],
        ], $changes);
    }

    /** @param list<array{0: string, 1: string, 2: string, 3: float|int}> $rows [province, product, schedule, price] */
    private function csv(array $rows): string
    {
        $lines = [self::HEADER];
        foreach ($rows as $i => [$province, $product, $schedule, $price]) {
            $lines[] = implode(',', ['2026-10-30 00:00:00', $i, '30-0-0', '"EMPRESA, SA"', 'CALLE 1', 'LOCALIDAD', $province, 'PAMPEANA',
                1, $product, 1, $schedule, $price, '2026-10-'.str_pad((string) (10 + $i % 15), 2, '0', STR_PAD_LEFT).' 08:00:00',
                1, 'YPF', '-34.6', '-58.4', '']);
        }

        return implode("\n", $lines)."\n";
    }

    /** Five daytime prices per product in Córdoba and CABA, plus rows that must be ignored. */
    private function fuelCsv(): string
    {
        $nafta = 'Nafta (súper) entre 92 y 95 Ron';
        $rows = [];
        foreach ([1000, 1100, 1200, 1300, 2000] as $price) {
            $rows[] = ['CORDOBA', $nafta, 'Diurno', $price];
            $rows[] = ['CAPITAL FEDERAL', $nafta, 'Diurno', $price + 100];
        }
        foreach ([2000, 2100, 2200, 2300, 3000] as $price) {
            $rows[] = ['CORDOBA', 'Gas Oil Grado 2', 'Diurno', $price];
        }
        foreach ([500, 600, 700, 800, 1500] as $price) {
            $rows[] = ['BUENOS AIRES', 'GNC', 'Diurno', $price];
        }
        // Ignored: night schedule, zero price, other products.
        $rows[] = ['CORDOBA', $nafta, 'Nocturno', 9000];
        $rows[] = ['CORDOBA', $nafta, 'Diurno', 0];
        $rows[] = ['CORDOBA', 'Nafta (premium) de más de 95 Ron', 'Diurno', 9000];
        $rows[] = ['CORDOBA', 'Kerosene', 'Diurno', 9000];

        return $this->csv($rows);
    }

    /** @param list<array{0: string, 1: float}>|null $cpiRows */
    private function fakeSources(?string $csv = null, bool $fuelOk = true, bool $cpiOk = true, ?array $cpiRows = null): void
    {
        Http::swap(new Factory);
        Http::preventStrayRequests();
        Http::fake([
            self::PACKAGE => $fuelOk ? Http::response(['success' => true, 'result' => ['resources' => [
                ['name' => 'Precios históricos', 'format' => 'CSV', 'url' => 'http://datos.energia.gob.ar/old.csv'],
                ['name' => 'Precios vigentes en surtidor - Resolución 314/2016', 'format' => 'CSV', 'url' => self::CSV_URL],
            ]]]) : Http::response('', 500),
            self::CSV_URL => $fuelOk ? Http::response($csv ?? $this->fuelCsv(), 200, ['Content-Type' => 'text/csv']) : Http::response('', 500),
            self::CPI => $cpiOk ? Http::response(['data' => $cpiRows ?? [['2026-08-01', 12276.766], ['2026-09-01', 12600.0]]]) : Http::response('', 500),
        ]);
    }

    public function test_refresh_stores_province_and_national_percentiles(): void
    {
        $this->fakeSources();

        $result = app(CalculatorRatesStore::class)->refresh();

        $this->assertSame('valid', $result['status']);
        $fuel = CalculatorRefreshSnapshot::query()->latest('id')->firstOrFail()->payload['fuel'];
        // 90th percentile, linear interpolation: 1300 + 0.6 x (2000 - 1300) = 1720.
        $this->assertSame(1720.0, (float) $fuel['provinces']['cordoba']['nafta']);
        $this->assertSame(1820.0, (float) $fuel['provinces']['caba']['nafta']);
        $this->assertSame(2720.0, (float) $fuel['provinces']['cordoba']['diesel']);
        $this->assertSame(1220.0, (float) $fuel['provinces']['buenos_aires']['gnc']);
        $this->assertArrayNotHasKey('gnc', $fuel['provinces']['cordoba']);
        // National: nafta over the 10 rows of both provinces, position 8.1: 2000 + 0.1 x (2100 - 2000).
        $this->assertSame(2010.0, (float) $fuel['national']['nafta']);
        $this->assertSame(2720.0, (float) $fuel['national']['diesel']);
        $this->assertSame(1220.0, (float) $fuel['national']['gnc']);
        $this->assertMatchesRegularExpression('/^2026-10-\d{2}$/', $fuel['source_date']);
    }

    public function test_resource_url_is_resolved_from_the_package_by_name(): void
    {
        $this->fakeSources();

        app(CalculatorRatesStore::class)->refresh();

        Http::assertSent(fn ($request) => $request->url() === self::CSV_URL);
        Http::assertNotSent(fn ($request) => str_contains($request->url(), 'old.csv'));
    }

    public function test_night_schedule_zero_prices_and_other_products_are_ignored(): void
    {
        $nafta = 'Nafta (súper) entre 92 y 95 Ron';
        $this->fakeSources($this->csv([
            ['SALTA', $nafta, 'Diurno', 1000], ['SALTA', $nafta, 'Nocturno', 99999], ['SALTA', $nafta, 'Diurno', 0],
            ['SALTA', 'Nafta (premium) de más de 95 Ron', 'Diurno', 99999], ['SALTA', 'Gas Oil Grado 3', 'Diurno', 99999],
        ]));

        app(CalculatorRatesStore::class)->refresh();

        $fuel = CalculatorRefreshSnapshot::query()->latest('id')->firstOrFail()->payload['fuel'];
        $this->assertEquals(['salta' => ['nafta' => 1000.0]], $fuel['provinces']);
        $this->assertEquals(['nafta' => 1000.0], $fuel['national']);
    }

    public function test_csv_province_names_are_normalized_like_the_calculator(): void
    {
        $nafta = 'Nafta (súper) entre 92 y 95 Ron';
        $this->fakeSources($this->csv([
            ['CAPITAL FEDERAL', $nafta, 'Diurno', 1000], ['BUENOS AIRES', $nafta, 'Diurno', 1100],
            ['TIERRA DEL FUEGO', $nafta, 'Diurno', 1200], ['SANTIAGO DEL ESTERO', $nafta, 'Diurno', 1300],
            ['CÓRDOBA', $nafta, 'Diurno', 1400], ['RIO NEGRO', $nafta, 'Diurno', 1500],
        ]));

        app(CalculatorRatesStore::class)->refresh();

        $provinces = CalculatorRefreshSnapshot::query()->latest('id')->firstOrFail()->payload['fuel']['provinces'];
        $this->assertEqualsCanonicalizing(
            ['caba', 'buenos_aires', 'tierra_del_fuego', 'santiago_del_estero', 'cordoba', 'rio_negro'],
            array_keys($provinces),
        );
    }

    public function test_cpi_latest_and_base_values_are_stored(): void
    {
        $this->fakeSources();

        app(CalculatorRatesStore::class)->refresh();

        $this->assertEquals(
            ['latest_month' => '2026-09', 'latest_value' => 12600.0, 'base_month' => '2026-08', 'base_value' => 12276.766],
            collect(CalculatorRefreshSnapshot::query()->latest('id')->firstOrFail()->payload['cpi'])
                ->only(['latest_month', 'latest_value', 'base_month', 'base_value'])->all(),
        );
        Http::assertSent(fn ($request) => str_contains($request->url(), 'ids=148.3_INIVELNAL_DICI_M_26')
            && str_contains($request->url(), 'start_date=2025-09-01'));
    }

    public function test_a_failed_source_keeps_that_part_from_the_previous_valid_snapshot(): void
    {
        $this->fakeSources();
        app(CalculatorRatesStore::class)->refresh();
        $this->travelTo(Carbon::parse('2026-12-01T07:00:00Z'));
        $this->fakeSources(fuelOk: false);

        $result = app(CalculatorRatesStore::class)->refresh();

        $this->assertSame('valid', $result['status']);
        $this->assertSame('kept', $result['fuel']);
        $this->assertSame('refreshed', $result['cpi']);
        $latest = app(CalculatorRatesStore::class)->latestValid();
        $this->assertSame(1720.0, (float) $latest->payload['fuel']['provinces']['cordoba']['nafta']);
        $this->assertSame('2026-12-01', $latest->fetched_at->toDateString());
    }

    public function test_a_failed_attempt_never_replaces_a_valid_snapshot(): void
    {
        $this->fakeSources();
        app(CalculatorRatesStore::class)->refresh();
        $valid = app(CalculatorRatesStore::class)->latestValid();
        $this->travelTo(Carbon::parse('2026-12-01T07:00:00Z'));
        $this->fakeSources(fuelOk: false, cpiOk: false);

        $result = app(CalculatorRatesStore::class)->refresh();

        $this->assertSame('failed', $result['status']);
        $this->assertSame(2, CalculatorRefreshSnapshot::count());
        $this->assertSame($valid->id, app(CalculatorRatesStore::class)->latestValid()->id);
    }

    public function test_a_first_refresh_with_every_source_down_stores_nothing_valid(): void
    {
        $this->fakeSources(fuelOk: false, cpiOk: false);

        $result = app(CalculatorRatesStore::class)->refresh();

        $this->assertSame('failed', $result['status']);
        $this->assertNull(app(CalculatorRatesStore::class)->latestValid());
    }

    public function test_an_unusable_csv_counts_as_a_failed_fuel_source(): void
    {
        $this->fakeSources("<html>not a csv</html>\n");

        $result = app(CalculatorRatesStore::class)->refresh();

        $this->assertSame('missing', $result['fuel']);
        $this->assertSame('refreshed', $result['cpi']);
    }

    public function test_no_snapshot_falls_back_to_the_config(): void
    {
        $rates = app(EffectiveRates::class)->forProvince('cordoba');

        $this->assertSame(config('calculadora.fuel_prices'), $rates['fuel_prices']);
        $this->assertSame(200000, $rates['service']['fallback']['body']['hatchback']);
        $this->assertSame(100000, $rates['transfer']['fixed_costs']);
        $this->assertSame('2026-10-01', $rates['updated_at']);
    }

    public function test_effective_rates_use_the_province_then_the_national_fuel_price(): void
    {
        $this->fakeSources();
        app(CalculatorRatesStore::class)->refresh();

        $cordoba = app(EffectiveRates::class)->forProvince('cordoba');
        $unknown = app(EffectiveRates::class)->forProvince('jujuy');

        $this->assertEquals(['nafta' => 1720.0, 'diesel' => 2720.0, 'gnc' => 1220.0], $cordoba['fuel_prices']);
        $this->assertEquals(['nafta' => 2010.0, 'diesel' => 2720.0, 'gnc' => 1220.0], $unknown['fuel_prices']);
    }

    public function test_a_province_without_a_fuel_type_uses_the_national_value_for_it(): void
    {
        $this->fakeSources();
        app(CalculatorRatesStore::class)->refresh();

        // Córdoba has no GNC rows: it takes the national GNC figure, not the config one.
        $this->assertEquals(1220.0, app(EffectiveRates::class)->forProvince('cordoba')['fuel_prices']['gnc']);
    }

    public function test_ars_amounts_are_indexed_by_the_cpi_factor(): void
    {
        $this->fakeSources();
        app(CalculatorRatesStore::class)->refresh();
        $factor = 12600.0 / 12276.766;

        $rates = app(EffectiveRates::class)->forProvince('cordoba');

        $this->assertEqualsWithDelta(100000 * $factor, $rates['transfer']['fixed_costs'], 1.0);
        $this->assertSame(0.01, $rates['transfer']['dnrpa_rate']);
        $this->assertSame(0.023, $rates['insurance']['value_rate_tc']);
        $this->assertSame(0.8, $rates['insurance']['zone_factor']['cordoba']);
    }

    public function test_the_insurance_base_month_is_stored_next_to_the_main_one_when_published(): void
    {
        $this->fakeSources(cpiRows: [['2026-08-01', 12276.766], ['2026-10-01', 13000.0], ['2026-11-01', 13650.0]]);

        app(CalculatorRatesStore::class)->refresh();

        $cpi = CalculatorRefreshSnapshot::query()->latest('id')->firstOrFail()->payload['cpi'];
        $this->assertEquals(['2026-10' => 13000.0], $cpi['extra_bases']);
        $this->assertSame('2026-11', $cpi['latest_month']);
        Http::assertSent(fn ($request) => str_contains($request->url(), 'start_date=2025-09-01'));
    }

    public function test_an_unpublished_insurance_base_month_is_skipped_and_the_refresh_still_succeeds(): void
    {
        $this->fakeSources();

        $result = app(CalculatorRatesStore::class)->refresh();

        $this->assertSame('refreshed', $result['cpi']);
        $this->assertSame([], CalculatorRefreshSnapshot::query()->latest('id')->firstOrFail()->payload['cpi']['extra_bases']);
    }

    public function test_insurance_bases_are_indexed_from_their_own_base_month(): void
    {
        $this->fakeSources(cpiRows: [['2026-08-01', 12276.766], ['2026-10-01', 13000.0], ['2026-11-01', 13650.0]]);
        app(CalculatorRatesStore::class)->refresh();

        $rates = app(EffectiveRates::class)->forProvince('cordoba');

        // Insurance: 13650 / 13000 = 1,05. The transfer keeps the main month (2026-08): 13650 / 12276,766.
        $this->assertSame(105000, $rates['insurance']['tc_base']['hatchback']);
        $this->assertSame(157500, $rates['insurance']['tc_base']['pickup']);
        $this->assertEqualsWithDelta(100000 * 13650.0 / 12276.766, $rates['transfer']['fixed_costs'], 1.0);
        $this->assertSame(0.023, $rates['insurance']['value_rate_tc']);
        $this->assertSame(1.8, $rates['insurance']['tr_ratio']['hatchback']);
    }

    public function test_insurance_bases_keep_the_config_until_the_base_month_is_published(): void
    {
        $this->fakeSources();
        app(CalculatorRatesStore::class)->refresh();

        $rates = app(EffectiveRates::class)->forProvince('cordoba');

        $this->assertSame(100000, $rates['insurance']['tc_base']['hatchback']);
        $this->assertSame(150000, $rates['insurance']['tc_base']['pickup']);
    }

    public function test_the_insurance_factor_never_goes_below_one(): void
    {
        $this->fakeSources(cpiRows: [['2026-08-01', 12000.0], ['2026-10-01', 13000.0], ['2026-11-01', 12800.0]]);
        app(CalculatorRatesStore::class)->refresh();

        $this->assertSame(100000, app(EffectiveRates::class)->forProvince('cordoba')['insurance']['tc_base']['hatchback']);
    }

    public function test_the_insurance_base_month_may_equal_the_main_base_month(): void
    {
        config(['calculadora.insurance.cpi_base_month' => '2026-08']);
        $this->fakeSources();
        app(CalculatorRatesStore::class)->refresh();

        // 12600 / 12276,766 = 1,02633 -> 102.633.
        $this->assertEqualsWithDelta(102633, app(EffectiveRates::class)->forProvince('cordoba')['insurance']['tc_base']['hatchback'], 2);
    }

    public function test_a_snapshot_stored_before_the_insurance_base_month_existed_stays_readable(): void
    {
        CalculatorRefreshSnapshot::create([
            'fetched_at' => now(), 'status' => CalculatorRefreshSnapshot::STATUS_VALID, 'cpi_month' => '2026-09',
            'payload' => ['fuel' => null, 'cpi' => ['latest_month' => '2026-09', 'latest_value' => 12600.0, 'base_month' => '2026-08', 'base_value' => 12276.766]],
        ]);

        $rates = app(EffectiveRates::class)->forProvince('cordoba');

        $this->assertSame(100000, $rates['insurance']['tc_base']['hatchback']);
        $this->assertGreaterThan(100000, $rates['transfer']['fixed_costs']);
    }

    public function test_the_refresh_fetches_every_base_month_in_use(): void
    {
        $this->fakeSources(cpiRows: [['2025-09-01', 9000.0], ['2025-12-01', 9500.0], ['2026-02-01', 10000.0], ['2026-04-01', 11000.0],
            ['2026-08-01', 12276.766], ['2026-10-01', 13000.0], ['2026-11-01', 13650.0]]);

        app(CalculatorRatesStore::class)->refresh();

        $cpi = CalculatorRefreshSnapshot::query()->latest('id')->firstOrFail()->payload['cpi'];
        // The main base (2026-08, also Toyota's) is not repeated; 2026-04 is not used anymore.
        $this->assertSame('2026-08', $cpi['base_month']);
        $this->assertEquals(['2025-09' => 9000.0, '2025-12' => 9500.0, '2026-02' => 10000.0, '2026-10' => 13000.0], $cpi['extra_bases']);
    }

    public function test_patente_limits_and_fixed_amounts_are_indexed_from_their_own_base_month_but_rates_are_not(): void
    {
        $this->fakeSources(cpiRows: [['2026-02-01', 10000.0], ['2026-08-01', 12276.766], ['2026-11-01', 11000.0]]);
        app(CalculatorRatesStore::class)->refresh();

        $patente = app(EffectiveRates::class)->forProvince('buenos_aires')['patente'];

        // Factor 11000 / 10000 = 1,1.
        $this->assertSame(15510000, $patente['scale']['buenos_aires'][0]['up_to']);
        $this->assertSame(0, $patente['scale']['buenos_aires'][0]['fixed']);
        $this->assertSame(20570000, $patente['scale']['buenos_aires'][1]['up_to']);
        $this->assertSame(256300, $patente['scale']['buenos_aires'][2]['fixed']);
        $this->assertNull($patente['scale']['buenos_aires'][3]['up_to']);
        $this->assertSame(500500, $patente['scale']['buenos_aires'][3]['fixed']);
        $this->assertSame(22000000, $patente['bracket_rate']['cordoba'][0]['up_to']);
        $this->assertSame(0.025, $patente['bracket_rate']['cordoba'][0]['rate']);
        $this->assertSame(0.03, $patente['scale']['buenos_aires'][2]['rate']);
        $this->assertSame(0.03, $patente['flat_rate']['mendoza']);
    }

    public function test_patente_keeps_the_config_until_its_base_month_is_published(): void
    {
        $this->fakeSources();
        app(CalculatorRatesStore::class)->refresh();

        $patente = app(EffectiveRates::class)->forProvince('buenos_aires')['patente'];

        $this->assertSame(config('calculadora.patente.scale'), $patente['scale']);
        $this->assertSame(config('calculadora.patente.bracket_rate'), $patente['bracket_rate']);
    }

    public function test_the_patente_factor_never_goes_below_one(): void
    {
        $this->fakeSources(cpiRows: [['2026-02-01', 10000.0], ['2026-08-01', 12276.766], ['2026-11-01', 9000.0]]);
        app(CalculatorRatesStore::class)->refresh();

        $this->assertSame(config('calculadora.patente.scale'), app(EffectiveRates::class)->forProvince('buenos_aires')['patente']['scale']);
    }

    public function test_service_prices_are_indexed_from_each_brands_own_base_month(): void
    {
        $this->fakeSources(cpiRows: [['2025-09-01', 11000.0], ['2025-12-01', 12000.0], ['2026-08-01', 12276.766], ['2026-11-01', 13200.0]]);
        app(CalculatorRatesStore::class)->refresh();

        $service = app(EffectiveRates::class)->forProvince('cordoba')['service'];

        // Volkswagen 13200 / 12000 = 1,1; Toyota 13200 / 12276,766 (the main month); the fallback 13200 / 11000 = 1,2.
        $this->assertSame(352000, $service['brands']['volkswagen']['models']['gol']);
        $this->assertSame(418000, $service['brands']['volkswagen']['body']['hatchback']);
        $this->assertEqualsWithDelta(360000 * 13200 / 12276.766, $service['brands']['toyota']['models']['yaris'], 1.0);
        $this->assertEqualsWithDelta(360000 * 13200 / 12276.766, $service['brands']['toyota']['body']['hatchback'], 1.0);
        $this->assertSame(240000, $service['fallback']['body']['hatchback']);
        $this->assertSame(456000, $service['fallback']['body']['sedan']);
        // Intervals, labels, aliases and the fuel factors are never indexed.
        $this->assertSame(15000, $service['brands']['volkswagen']['interval_km']);
        $this->assertSame(['vw'], $service['brands']['volkswagen']['aliases']);
        $this->assertSame(10000, $service['fallback']['interval_km']);
        $this->assertSame(1.15, $service['fuel_factor']['gnc']);
    }

    public function test_service_prices_keep_the_config_until_their_base_month_is_published_and_never_go_below_it(): void
    {
        $this->fakeSources();
        app(CalculatorRatesStore::class)->refresh();
        $service = app(EffectiveRates::class)->forProvince('cordoba')['service'];
        $this->assertSame(320000, $service['brands']['volkswagen']['models']['gol']);
        $this->assertSame(200000, $service['fallback']['body']['hatchback']);

        // The index fell since the base month: the factor stays 1.
        $this->fakeSources(cpiRows: [['2025-09-01', 13000.0], ['2025-12-01', 13000.0], ['2026-08-01', 12276.766], ['2026-09-01', 12600.0]]);
        app(CalculatorRatesStore::class)->refresh();
        $service = app(EffectiveRates::class)->forProvince('cordoba')['service'];
        $this->assertSame(320000, $service['brands']['volkswagen']['models']['gol']);
        $this->assertSame(200000, $service['fallback']['body']['hatchback']);
    }

    public function test_the_refresh_requests_the_cpi_from_the_oldest_base_month(): void
    {
        $this->fakeSources(cpiRows: [['2025-09-01', 9000.0], ['2026-02-01', 10000.0], ['2026-08-01', 12276.766], ['2026-10-01', 13000.0], ['2026-11-01', 13650.0]]);

        app(CalculatorRatesStore::class)->refresh();

        $cpi = CalculatorRefreshSnapshot::query()->latest('id')->firstOrFail()->payload['cpi'];
        $this->assertEquals(['2025-09' => 9000.0, '2026-02' => 10000.0, '2026-10' => 13000.0], $cpi['extra_bases']);
        Http::assertSent(fn ($request) => str_contains($request->url(), 'start_date=2025-09-01'));
    }

    public function test_a_snapshot_stored_before_the_service_model_stays_readable(): void
    {
        CalculatorRefreshSnapshot::create([
            'fetched_at' => now(), 'status' => CalculatorRefreshSnapshot::STATUS_VALID, 'cpi_month' => '2026-09',
            'payload' => ['fuel' => null, 'cpi' => ['latest_month' => '2026-09', 'latest_value' => 12600.0, 'base_month' => '2026-08', 'base_value' => 12276.766,
                'extra_bases' => ['2026-04' => 12000.0, '2026-10' => 13000.0]]],
        ]);

        $service = app(EffectiveRates::class)->forProvince('cordoba')['service'];

        $this->assertSame(200000, $service['fallback']['body']['hatchback']);
        $this->assertGreaterThan(360000, $service['brands']['toyota']['models']['yaris']);
    }

    public function test_the_cpi_factor_never_goes_below_one(): void
    {
        Http::swap(new Factory);
        Http::preventStrayRequests();
        Http::fake([self::CPI => Http::response(['data' => [['2026-08-01', 12000.0], ['2026-09-01', 11000.0]]]),
            self::PACKAGE => Http::response('', 500)]);
        app(CalculatorRatesStore::class)->refresh();

        $rates = app(EffectiveRates::class)->forProvince('cordoba');

        $this->assertSame(200000, $rates['service']['fallback']['body']['hatchback']);
        $this->assertSame(100000, $rates['transfer']['fixed_costs']);
    }

    public function test_a_snapshot_for_another_base_month_does_not_index_anything(): void
    {
        $this->fakeSources();
        app(CalculatorRatesStore::class)->refresh();
        config(['calculadora.cpi_base_month' => '2026-05']);

        $this->assertSame(100000, app(EffectiveRates::class)->forProvince('cordoba')['transfer']['fixed_costs']);
    }

    public function test_rates_updated_at_is_the_snapshot_fetch_date(): void
    {
        $this->fakeSources();
        app(CalculatorRatesStore::class)->refresh();

        $this->assertSame('2026-11-01', app(EffectiveRates::class)->forProvince('cordoba')['updated_at']);
    }

    public function test_the_costs_endpoint_uses_the_province_fuel_price_and_indexed_service(): void
    {
        $this->fakeSources(cpiRows: [['2025-09-01', 12000.0], ['2026-08-01', 12276.766], ['2026-09-01', 12600.0]]);
        app(CalculatorRatesStore::class)->refresh();
        $this->actingAs(User::factory()->create());
        $car = $this->car();

        $response = $this->getJson("/api/vehiculos/{$car->id}/costos?km=1500")->assertOk();

        // Fuel: 1500 km x 8 L / 100 x 1720 = 206.400 -> 207.000 (the config price is 1.000).
        $response->assertJsonPath('monthly.fuel', 207000)
            ->assertJsonPath('breakdown.fuel.unit_price', 1720)
            ->assertJsonPath('rates_updated_at', '2026-11-01');
        // Service: 2 services x (sedan reference 380.000 x 12600 / 12000 = 399.000) = 798.000 (it was 760.000 unindexed).
        $response->assertJsonPath('yearly.service', 798000);
        $this->assertSame(399000, $response->json('breakdown.service.price_per_service'));
        $this->assertEqualsWithDelta(102633, $response->json('breakdown.transfer.fixed_costs'), 2);
    }

    public function test_the_costs_endpoint_keeps_the_config_when_there_is_no_snapshot(): void
    {
        $this->actingAs(User::factory()->create());
        $car = $this->car();

        $this->getJson("/api/vehiculos/{$car->id}/costos?km=1500")->assertOk()
            ->assertJsonPath('monthly.fuel', 120000)
            ->assertJsonPath('yearly.service', 760000)
            ->assertJsonPath('rates_updated_at', '2026-10-01');
    }

    public function test_the_refresh_command_stores_a_snapshot_and_reports_it(): void
    {
        $this->fakeSources();

        $this->artisan('calculadora:refresh')
            ->expectsOutputToContain('Fuel prices: refreshed')
            ->expectsOutputToContain('CPI: refreshed')
            ->assertSuccessful();

        $this->assertSame(1, CalculatorRefreshSnapshot::where('status', 'valid')->count());
    }

    public function test_the_refresh_command_fails_when_nothing_could_be_refreshed(): void
    {
        $this->fakeSources(fuelOk: false, cpiOk: false);

        $this->artisan('calculadora:refresh')->assertFailed();
    }

    public function test_the_refresh_command_is_scheduled_monthly_without_overlap(): void
    {
        $event = collect(app(Schedule::class)->events())
            ->first(fn ($event) => str_contains($event->command, 'calculadora:refresh'));

        $this->assertNotNull($event, 'calculadora:refresh is not scheduled.');
        $this->assertSame('0 4 1 * *', $event->expression);
        $this->assertSame('America/Argentina/Buenos_Aires', (string) $event->timezone);
        $this->assertTrue($event->withoutOverlapping);
    }

    public function test_the_cron_endpoint_is_disabled_without_a_secret_and_rejects_a_wrong_token(): void
    {
        $this->fakeSources();
        config(['cron.secret' => null]);
        $this->postJson('/internal/cron/calculadora', [], ['Authorization' => 'Bearer x'])->assertNotFound();

        config(['cron.secret' => 'right']);
        $this->postJson('/internal/cron/calculadora', [], ['Authorization' => 'Bearer wrong'])->assertUnauthorized();
        $this->assertSame(0, CalculatorRefreshSnapshot::count());
    }

    public function test_the_cron_endpoint_runs_the_refresh(): void
    {
        $this->fakeSources();
        config(['cron.secret' => 'right']);

        $this->postJson('/internal/cron/calculadora', [], ['Authorization' => 'Bearer right'])->assertOk()
            ->assertJsonPath('status', 'valid')->assertJsonPath('fuel', 'refreshed')->assertJsonPath('cpi', 'refreshed');
    }

    private function car(): Vehiculo
    {
        $dealer = Concesionaria::factory()->active()->create(['provincia' => 'Córdoba']);
        Suscripcion::factory()->create(['concesionaria_id' => $dealer->id, 'estado' => 'activa',
            'vigente_hasta' => now()->addMonth()->toDateString()]);
        $vehicle = Vehiculo::factory()->create(array_replace(array_fill_keys(array_keys(VehiculoFields::EQUIPMENT_FIELDS), true), [
            'tipo_carroceria_id' => 1, 'anio' => 2022, 'kilometraje' => 40000,
            'precio' => 20000000, 'moneda' => 'ARS', 'combustible' => 'nafta', 'transmision' => 'manual',
            'plazas' => 5, 'motor' => '1.6', 'turbo' => false, 'potencia' => 110, 'potencia_unidad' => 'CV',
            'consumo_urbano' => 8, 'consumo_ruta' => 6, 'marca' => 'Renault', 'modelo' => 'Sandero',
        ]));
        VehiculoConcesionaria::factory()->create(['vehiculo_id' => $vehicle->id, 'concesionaria_id' => $dealer->id, 'visible' => true]);

        return $vehicle;
    }
}
