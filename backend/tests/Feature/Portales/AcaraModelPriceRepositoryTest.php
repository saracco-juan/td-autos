<?php

namespace Tests\Feature\Portales;

use App\Repositories\AcaraModelPriceRepository;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\Feature\Portales\Concerns\SeedsModelPrices;
use Tests\TestCase;

class AcaraModelPriceRepositoryTest extends TestCase
{
    use RefreshDatabase;
    use SeedsModelPrices;

    public function test_it_returns_min_and_max_per_model_year_and_currency_across_versions(): void
    {
        $etios = $this->makeModel('TOYOTA', 'Etios');
        $this->addVersion('TOYOTA', 'Etios', 'X', [2020 => 10000000, 2021 => 12000000]);
        $this->addVersion('TOYOTA', 'Etios', 'XLS', [2020 => 14000000, 2021 => 15000000]);
        $this->addVersion('TOYOTA', 'Etios', 'Import', [2020 => 9000], 'USD');

        $rows = app(AcaraModelPriceRepository::class)->yearRanges([2020, 2021])
            ->sortBy(fn ($r) => $r->year.$r->currency)->values();

        $this->assertCount(3, $rows);
        $this->assertSame([$etios->id, '2020', 'ARS', 10000000.0, 14000000.0],
            [$rows[0]->modelo_id, $rows[0]->year, $rows[0]->currency, (float) $rows[0]->min_amount, (float) $rows[0]->max_amount]);
        $this->assertSame(['2020', 'USD', 9000.0, 9000.0],
            [$rows[1]->year, $rows[1]->currency, (float) $rows[1]->min_amount, (float) $rows[1]->max_amount]);
        $this->assertSame(['2021', 'ARS', 12000000.0, 15000000.0],
            [$rows[2]->year, $rows[2]->currency, (float) $rows[2]->min_amount, (float) $rows[2]->max_amount]);
    }

    public function test_it_ignores_other_years_zero_km_null_and_non_positive_amounts_and_uncurated_models(): void
    {
        $this->makeModel('TOYOTA', 'Etios');
        $this->addVersion('TOYOTA', 'Etios', 'X', [2020 => 10000000, 2019 => 8000000, '0km' => 20000000, 2021 => null, 2022 => 0]);
        $this->addVersion('TOYOTA', 'Etios', 'Y', [2020 => 11000000, 2022 => -5]);
        $this->addVersion('FORD', 'Fiesta', 'Z', [2020 => 5000000]);

        $rows = app(AcaraModelPriceRepository::class)->yearRanges([2020, 2021, 2022]);

        $this->assertCount(1, $rows);
        $this->assertSame('2020', $rows[0]->year);
        $this->assertSame(10000000.0, (float) $rows[0]->min_amount);
        $this->assertSame(11000000.0, (float) $rows[0]->max_amount);
    }

    public function test_it_runs_one_query_for_all_the_curated_models(): void
    {
        foreach (['A', 'B', 'C'] as $name) {
            $this->makeModel('MARCA', $name);
            $this->addVersion('MARCA', $name, 'v', [2020 => 1000000]);
        }

        DB::enableQueryLog();
        $rows = app(AcaraModelPriceRepository::class)->yearRanges([2020]);

        $this->assertCount(3, $rows);
        $this->assertCount(1, DB::getQueryLog());
    }

    public function test_it_reads_the_source_date_of_the_price_guide(): void
    {
        $repository = app(AcaraModelPriceRepository::class);
        $this->assertNull($repository->sourceDate());

        DB::table('catalog_import')->insert(['id' => 1, 'source_date' => '2026-10-19', 'sha256' => str_repeat('a', 64),
            'snapshot_id' => 'acara:test', 'imported_at' => now()]);

        $this->assertSame('2026-10-19', $repository->sourceDate());
    }
}
