<?php

namespace App\Services\Calculadora;

use Illuminate\Support\Facades\Http;
use RuntimeException;

/** INDEC national CPI, general level, monthly index (datos.gob.ar series API). */
final class CpiSource
{
    private const URL = 'https://apis.datos.gob.ar/series/api/series/';

    private const SERIES = '148.3_INIVELNAL_DICI_M_26';

    /**
     * `$extraMonths` are further base months (other ARS amounts stated at their own month). A month the series has not
     * published yet is left out of `extra_bases`: its amounts stay unindexed instead of failing the refresh.
     *
     * @param  list<string>  $extraMonths
     * @return array{latest_month: string, latest_value: float, base_month: string, base_value: float, extra_bases: array<string, float>}
     */
    public function fetch(string $baseMonth, array $extraMonths = []): array
    {
        foreach ([$baseMonth, ...$extraMonths] as $month) {
            if (preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', $month) !== 1) {
                throw new RuntimeException('CPI: the base month in the config is not YYYY-MM.');
            }
        }
        $start = min([$baseMonth, ...$extraMonths]);
        $response = Http::acceptJson()->connectTimeout(10)->timeout(30)->get(self::URL, [
            'ids' => self::SERIES, 'start_date' => $start.'-01', 'format' => 'json',
        ]);
        if (! $response->successful()) {
            throw new RuntimeException('CPI: the series API did not answer.');
        }

        $values = [];
        foreach ((array) $response->json('data', []) as $row) {
            if (is_array($row) && is_string($row[0] ?? null) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $row[0]) === 1
                && is_numeric($row[1] ?? null) && (float) $row[1] > 0) {
                $values[substr($row[0], 0, 7)] = (float) $row[1];
            }
        }
        if (! isset($values[$baseMonth])) {
            throw new RuntimeException('CPI: the base month is not published in the series.');
        }
        ksort($values);
        $latest = array_key_last($values);

        $extraBases = [];
        foreach ($extraMonths as $month) {
            if (isset($values[$month])) {
                $extraBases[$month] = $values[$month];
            }
        }

        return [
            'latest_month' => $latest, 'latest_value' => $values[$latest], 'base_month' => $baseMonth, 'base_value' => $values[$baseMonth],
            'extra_bases' => $extraBases,
        ];
    }
}
