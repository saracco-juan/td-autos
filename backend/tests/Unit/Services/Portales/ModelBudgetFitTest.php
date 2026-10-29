<?php

namespace Tests\Unit\Services\Portales;

use App\Services\Portales\ModelBudgetFit;
use PHPUnit\Framework\TestCase;

class ModelBudgetFitTest extends TestCase
{
    private function row(int $model, int $year, string $currency, float $min, ?float $max = null): object
    {
        return (object) ['modelo_id' => $model, 'year' => (string) $year, 'currency' => $currency,
            'min_amount' => $min, 'max_amount' => $max ?? $min];
    }

    public function test_the_window_is_the_last_ten_model_years_or_the_newest_five_without_a_cap(): void
    {
        $this->assertSame([2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026], ModelBudgetFit::years(20000000, 2026));
        $this->assertSame([2022, 2023, 2024, 2025, 2026], ModelBudgetFit::years(null, 2026));
    }

    public function test_a_year_fits_when_its_cheapest_version_is_within_the_budget(): void
    {
        $fits = (new ModelBudgetFit)->fit([
            $this->row(1, 2020, 'ARS', 18000000, 30000000),
            $this->row(1, 2021, 'ARS', 19000000, 31000000),
            $this->row(1, 2022, 'ARS', 21000000, 33000000),
        ], 20000000, null, 2026);

        $this->assertSame([2020, 2021], $fits[1]->years);
        $this->assertSame(2021, $fits[1]->referenceYear);
        $this->assertSame([19000000, 31000000], [$fits[1]->minArs, $fits[1]->maxArs]);
        $this->assertFalse($fits[1]->usedUsd);
    }

    public function test_a_model_with_no_fitting_year_is_left_out(): void
    {
        $fits = (new ModelBudgetFit)->fit([$this->row(1, 2020, 'ARS', 20000001)], 20000000, null, 2026);

        $this->assertSame([], $fits);
    }

    public function test_a_price_equal_to_the_budget_fits(): void
    {
        $fits = (new ModelBudgetFit)->fit([$this->row(1, 2020, 'ARS', 20000000)], 20000000, null, 2026);

        $this->assertSame([2020], $fits[1]->years);
    }

    public function test_without_a_cap_every_priced_year_of_the_newest_five_enters(): void
    {
        $fits = (new ModelBudgetFit)->fit([
            $this->row(1, 2018, 'ARS', 1000000),
            $this->row(1, 2022, 'ARS', 40000000),
            $this->row(1, 2026, 'ARS', 90000000),
            $this->row(2, 2019, 'ARS', 1000000),
        ], null, null, 2026);

        $this->assertSame([1], array_keys($fits));
        $this->assertSame([2022, 2026], $fits[1]->years);
        $this->assertSame(2026, $fits[1]->referenceYear);
    }

    public function test_years_outside_the_window_and_non_numeric_years_are_ignored(): void
    {
        $fits = (new ModelBudgetFit)->fit([
            $this->row(1, 2016, 'ARS', 1000000),
            (object) ['modelo_id' => 1, 'year' => '0km', 'currency' => 'ARS', 'min_amount' => 1.0, 'max_amount' => 1.0],
            (object) ['modelo_id' => 1, 'year' => '20ab', 'currency' => 'ARS', 'min_amount' => 1.0, 'max_amount' => 1.0],
            $this->row(1, 2017, 'ARS', 5000000),
        ], 20000000, null, 2026);

        $this->assertSame([2017], $fits[1]->years);
    }

    public function test_usd_prices_are_converted_with_the_rate_and_flagged(): void
    {
        $fits = (new ModelBudgetFit)->fit([$this->row(1, 2023, 'USD', 15000, 20000)], 20000000, 1000.0, 2026);

        $this->assertSame([2023], $fits[1]->years);
        $this->assertSame([15000000, 20000000], [$fits[1]->minArs, $fits[1]->maxArs]);
        $this->assertTrue($fits[1]->usedUsd);
    }

    public function test_usd_prices_cannot_fit_without_a_rate(): void
    {
        $fits = (new ModelBudgetFit)->fit([$this->row(1, 2023, 'USD', 10)], 20000000, null, 2026);

        $this->assertSame([], $fits);
    }

    public function test_a_year_with_ars_and_usd_prices_takes_the_extremes_in_pesos_and_rounds_them(): void
    {
        $fits = (new ModelBudgetFit)->fit([
            $this->row(1, 2023, 'ARS', 19500000.4, 22000000),
            $this->row(1, 2023, 'USD', 18000, 25000.5),
        ], 20000000, 1000.0, 2026);

        $this->assertSame([18000000, 25000500], [$fits[1]->minArs, $fits[1]->maxArs]);
    }

    public function test_models_are_evaluated_independently(): void
    {
        $fits = (new ModelBudgetFit)->fit([
            $this->row(1, 2020, 'ARS', 10000000),
            $this->row(2, 2020, 'ARS', 30000000),
            $this->row(3, 2024, 'ARS', 12000000),
            $this->row(3, 2025, 'ARS', 13000000),
        ], 20000000, null, 2026);

        $this->assertSame([1, 3], array_keys($fits));
        $this->assertSame([2024, 2025], $fits[3]->years);
    }
}
