<?php

namespace App\Services\ExchangeRates;

use Carbon\CarbonImmutable;
use DateTimeImmutable;
use Exception;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

/** DolarAPI official sell quote: HTTP, validation and last-valid cache, never ranking logic. */
final class DolarApi
{
    private const URL = 'https://dolarapi.com/v1/dolares/oficial';

    private const QUOTE_KEY = 'exchange-rates.dolarapi.official.last-valid.v1';

    private const ATTEMPT_KEY = 'exchange-rates.dolarapi.official.attempt.v1';

    /**
     * Refresh on demand, at most once per three hours across callers, including failures.
     * The configured shared cache must persist between requests; do not use array/null in production.
     *
     * @return array{quote: ?array, stale: bool, warning: ?string}
     */
    public function current(): array
    {
        $now = now()->toImmutable();
        // Claim before I/O: other callers can read the previous snapshot without waiting.
        if (Cache::add(self::ATTEMPT_KEY, true, $now->addHours(3))) {
            $previous = Cache::get(self::QUOTE_KEY);
            $quote = $this->fetch($now);
            if ($quote !== null && ($previous === null || $quote['updated_at'] >= $previous['updated_at'])) {
                Cache::forever(self::QUOTE_KEY, $quote);
            }
        }
        $quote = Cache::get(self::QUOTE_KEY);
        $stale = $quote !== null && CarbonImmutable::parse($quote['fetched_at'])->addHours(3)->lessThanOrEqualTo($now);

        return [
            'quote' => $quote, 'stale' => $stale,
            'warning' => $quote === null ? 'exchange_rate_unavailable' : ($stale ? 'exchange_rate_stale' : null),
        ];
    }

    private function fetch(CarbonImmutable $now): ?array
    {
        try {
            $response = Http::acceptJson()->connectTimeout(3)->timeout(8)->withoutRedirecting()->get(self::URL);
        } catch (ConnectionException) {
            return null;
        }
        if (! $response->successful()) {
            return null;
        }

        return $this->normalize($response->json(), $now);
    }

    private function normalize(mixed $data, CarbonImmutable $now): ?array
    {
        if (! is_array($data) || ($data['moneda'] ?? null) !== 'USD' || ($data['casa'] ?? null) !== 'oficial') {
            return null;
        }
        $sell = $data['venta'] ?? null;
        $timestamp = $data['fechaActualizacion'] ?? null;
        if ((! is_int($sell) && ! is_float($sell)) || ! is_finite((float) $sell) || $sell <= 0
            || ! is_string($timestamp)
            || ! preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/D', $timestamp)) {
            return null;
        }
        try {
            $date = new DateTimeImmutable($timestamp);
            $errors = DateTimeImmutable::getLastErrors();
            if ($errors !== false && ($errors['warning_count'] > 0 || $errors['error_count'] > 0)) {
                return null;
            }
            $updated = CarbonImmutable::instance($date)->utc();
        } catch (Exception) {
            return null;
        }
        if ($updated->greaterThan($now)) {
            return null;
        }

        return [
            'sell' => (float) $sell, 'source' => 'DolarAPI', 'source_url' => 'https://dolarapi.com',
            'upstream_source' => 'Ámbito Financiero', 'updated_at' => $updated->toISOString(),
            'fetched_at' => $now->toISOString(),
        ];
    }
}
