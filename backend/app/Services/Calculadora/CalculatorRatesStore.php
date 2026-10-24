<?php

namespace App\Services\Calculadora;

use App\Models\CalculatorRefreshSnapshot;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * History of the calculator's moving values. Readers take the latest VALID snapshot; a source that fails
 * keeps its part from the previous valid snapshot, and an attempt with nothing usable is recorded as failed.
 */
final class CalculatorRatesStore
{
    public function __construct(private readonly FuelPriceSource $fuel, private readonly CpiSource $cpi) {}

    public function latestValid(): ?CalculatorRefreshSnapshot
    {
        return CalculatorRefreshSnapshot::query()->where('status', CalculatorRefreshSnapshot::STATUS_VALID)
            ->orderByDesc('fetched_at')->orderByDesc('id')->first();
    }

    /** @return array{status: string, fuel: string, cpi: string} per part: refreshed, kept (previous value) or missing */
    public function refresh(): array
    {
        $previous = $this->latestValid()?->payload ?? [];
        $fuel = $this->attempt('fuel prices', fn () => $this->fuel->fetch());
        $cpi = $this->attempt('CPI', fn () => $this->cpi->fetch(
            (string) config('calculadora.cpi_base_month'),
            $this->extraBaseMonths(),
        ));

        $payload = ['fuel' => $fuel ?? $previous['fuel'] ?? null, 'cpi' => $cpi ?? $previous['cpi'] ?? null];
        // Valid only when at least one source answered; otherwise the attempt is logged and the previous snapshot stays in force.
        $valid = $fuel !== null || $cpi !== null;
        $status = $valid ? CalculatorRefreshSnapshot::STATUS_VALID : CalculatorRefreshSnapshot::STATUS_FAILED;
        CalculatorRefreshSnapshot::create([
            'fetched_at' => now(),
            'status' => $status,
            'fuel_source_date' => $payload['fuel']['source_date'] ?? null,
            'cpi_month' => $payload['cpi']['latest_month'] ?? null,
            'payload' => $valid ? $payload : null,
        ]);

        return [
            'status' => $status,
            'fuel' => $this->outcome($fuel, $payload['fuel']),
            'cpi' => $this->outcome($cpi, $payload['cpi']),
        ];
    }

    /**
     * Every base month in use besides the main one, so each ARS amount can be indexed from its own month.
     *
     * @return list<string>
     */
    private function extraBaseMonths(): array
    {
        $months = array_map(fn (string $key) => (string) config($key), [
            'calculadora.insurance.cpi_base_month', 'calculadora.patente.cpi_base_month', 'calculadora.maintenance.cpi_base_month',
        ]);

        return array_values(array_unique(array_filter($months)));
    }

    private function attempt(string $label, callable $fetch): ?array
    {
        try {
            return $fetch();
        } catch (Throwable $error) {
            Log::warning("Calculator refresh: {$label} failed; the previous value is kept.", ['exception' => $error::class, 'message' => $error->getMessage()]);

            return null;
        }
    }

    private function outcome(?array $fresh, ?array $effective): string
    {
        return $fresh !== null ? 'refreshed' : ($effective !== null ? 'kept' : 'missing');
    }
}
