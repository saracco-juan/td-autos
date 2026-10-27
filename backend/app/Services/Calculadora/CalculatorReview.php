<?php

namespace App\Services\Calculadora;

use Illuminate\Http\Client\Pool;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Http;

/**
 * Yearly control of the hand-reviewed calculator values (`config('calculadora.review')`).
 *
 * It only reports: which groups were last reviewed more than `max_age_months` ago, which source URLs no longer answer
 * and whether the monthly snapshot is late. It never writes and never changes a rate.
 */
class CalculatorReview
{
    private const SOURCE_TIMEOUT_SECONDS = 5;

    public function __construct(private readonly CalculatorRatesStore $store) {}

    /**
     * @return array{
     *   generated_at: string,
     *   stale: list<array<string, mixed>>,
     *   fresh: list<array<string, mixed>>,
     *   unreachable_sources: list<array{url: string, status: int|null, error: string|null, groups: list<string>}>,
     *   snapshot: array{latest_fetched_at: string|null, age_days: int|null, stale: bool}
     * }
     */
    public function run(): array
    {
        $now = now();
        $maxAge = (int) config('calculadora.review.max_age_months', 12);
        $limit = $now->copy()->startOfDay()->subMonthsNoOverflow($maxAge);
        $groups = (array) config('calculadora.review.groups', []);

        $stale = [];
        $fresh = [];
        foreach ($groups as $key => $group) {
            $reviewedAt = Carbon::parse($group['reviewed_at'])->startOfDay();
            $entry = [
                'key' => $key,
                'label' => $group['label'],
                'config_path' => $group['config_path'],
                'reviewed_at' => $reviewedAt->toDateString(),
                'age_months' => (int) $reviewedAt->diffInMonths($now),
                'sources' => array_values($group['sources'] ?? []),
            ];
            if ($reviewedAt->lt($limit)) {
                $stale[] = $entry;
            } else {
                $fresh[] = $entry;
            }
        }

        return [
            'generated_at' => $now->toIso8601String(),
            'stale' => $stale,
            'fresh' => $fresh,
            'unreachable_sources' => $this->unreachableSources($groups),
            'snapshot' => $this->snapshotStatus($now),
        ];
    }

    public function title(?Carbon $at = null): string
    {
        return 'Revisión anual de valores de la calculadora ('.($at ?? now())->year.')';
    }

    /** Ready-to-paste Spanish checklist for a GitHub issue. */
    public function markdown(array $review): string
    {
        $maxAge = (int) config('calculadora.review.max_age_months', 12);
        $lines = ['Control anual de los valores de la calculadora de costos. Solo avisa: no modifica ninguna tasa.', ''];

        $lines[] = '## Grupos para revisar';
        if ($review['stale'] === []) {
            $lines[] = "Todo al día: ningún grupo tiene más de {$maxAge} meses desde su última revisión.";
        }
        foreach ($review['stale'] as $group) {
            $sources = $group['sources'] === []
                ? 'sin fuente pública'
                : implode(', ', array_map(fn (string $url) => "[{$url}]({$url})", $group['sources']));
            $lines[] = "- [ ] **{$group['label']}** · `{$group['config_path']}` · revisado el {$group['reviewed_at']} · fuentes: {$sources}";
        }

        if ($review['unreachable_sources'] !== []) {
            $lines[] = '';
            $lines[] = '## Fuentes que no responden';
            foreach ($review['unreachable_sources'] as $source) {
                $reason = $source['status'] !== null ? 'HTTP '.$source['status'] : 'sin conexión ('.$source['error'].')';
                $lines[] = "- {$source['url']} · {$reason} · usada en: ".implode(', ', $source['groups']);
            }
        }

        $snapshot = $review['snapshot'];
        $lines[] = '';
        $lines[] = '## Valores mensuales';
        if ($snapshot['latest_fetched_at'] === null) {
            $lines[] = '- Sin snapshot válido: revisar `calculadora:refresh`.';
        } else {
            $late = $snapshot['stale'] ? ' (atrasado, revisar `calculadora:refresh`)' : '';
            $lines[] = "- Último snapshot válido: {$snapshot['latest_fetched_at']}, hace {$snapshot['age_days']} días{$late}.";
        }

        $lines[] = '';
        $lines[] = 'Cómo revisar y actualizar `reviewed_at`: `docs/development/calculator.md`, sección "Calculator yearly review".';

        return implode("\n", $lines)."\n";
    }

    /**
     * Each distinct URL is requested once, in parallel, with a short timeout. A GET is used because some sites refuse HEAD.
     *
     * @return list<array{url: string, status: int|null, error: string|null, groups: list<string>}>
     */
    private function unreachableSources(array $groups): array
    {
        $usedBy = [];
        foreach ($groups as $group) {
            foreach ($group['sources'] ?? [] as $url) {
                $usedBy[$url][] = $group['label'];
            }
        }
        if ($usedBy === []) {
            return [];
        }

        $responses = Http::pool(fn (Pool $pool) => array_map(
            fn (string $url) => $pool->as($url)->timeout(self::SOURCE_TIMEOUT_SECONDS)->get($url),
            array_keys($usedBy),
        ));

        $unreachable = [];
        foreach ($usedBy as $url => $labels) {
            $response = $responses[$url] ?? null;
            if ($response instanceof Response) {
                // Redirects are followed by the client; any 2xx/3xx left over still counts as answering.
                if ($response->status() < 400) {
                    continue;
                }
                $unreachable[] = ['url' => $url, 'status' => $response->status(), 'error' => null, 'groups' => $labels];

                continue;
            }
            $error = $response instanceof \Throwable ? $response->getMessage() : 'no response';
            $unreachable[] = ['url' => $url, 'status' => null, 'error' => $error, 'groups' => $labels];
        }

        return $unreachable;
    }

    /** @return array{latest_fetched_at: string|null, age_days: int|null, stale: bool} */
    private function snapshotStatus(Carbon $now): array
    {
        $snapshot = $this->store->latestValid();
        if ($snapshot === null) {
            return ['latest_fetched_at' => null, 'age_days' => null, 'stale' => true];
        }

        $age = (int) floor($snapshot->fetched_at->diffInDays($now));

        return [
            'latest_fetched_at' => $snapshot->fetched_at->toIso8601String(),
            'age_days' => $age,
            'stale' => $age > (int) config('calculadora.review.snapshot_max_age_days', 40),
        ];
    }
}
