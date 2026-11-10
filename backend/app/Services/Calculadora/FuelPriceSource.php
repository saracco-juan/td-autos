<?php

namespace App\Services\Calculadora;

use Illuminate\Support\Facades\Http;
use RuntimeException;

/**
 * Fuel prices per province from the Secretaría de Energía "Precios en surtidor" open data (CKAN).
 * Background use only (calculadora:refresh): the CSV is about 9 MB, so it is streamed row by row.
 */
final class FuelPriceSource
{
    private const PACKAGE_URL = 'http://datos.energia.gob.ar/api/3/action/package_show?id=precios-en-surtidor';

    private const RESOURCE_NAME = 'Precios vigentes en surtidor - Resolución 314/2016';

    private const MAX_BYTES = 60 * 1024 * 1024;

    /** Normalized CSV product name => fuel type used by config('calculadora.fuel_prices'). */
    private const PRODUCTS = [
        'nafta (super) entre 92 y 95 ron' => 'nafta',
        'gas oil grado 2' => 'diesel',
        'gnc' => 'gnc',
    ];

    private const PERCENTILE = 0.9;

    public function __construct(private readonly OwnershipCostCalculator $calculator) {}

    /** @return array{source_date: string, national: array<string, float>, provinces: array<string, array<string, float>>} */
    public function fetch(): array
    {
        $sink = tmpfile();
        if ($sink === false) {
            throw new RuntimeException('Fuel prices: temporary download could not be opened.');
        }
        try {
            $response = Http::withHeaders(['Accept' => 'text/csv, application/octet-stream'])
                ->connectTimeout(20)->timeout(180)->sink($sink)->withOptions($this->downloadOptions())->get($this->resourceUrl());
            if ($response->status() !== 200 || fstat($sink)['size'] > self::MAX_BYTES) {
                throw new RuntimeException('Fuel prices: download was rejected.');
            }
            rewind($sink);

            return $this->aggregate($sink);
        } finally {
            if (is_resource($sink)) {
                fclose($sink);
            }
        }
    }

    /** The resource URL is never hardcoded: it changes when the publisher re-uploads the file. */
    private function resourceUrl(): string
    {
        $response = Http::acceptJson()->connectTimeout(10)->timeout(30)->get(self::PACKAGE_URL);
        if (! $response->successful()) {
            throw new RuntimeException('Fuel prices: the CKAN package could not be read.');
        }
        foreach ((array) $response->json('result.resources', []) as $resource) {
            if (($resource['name'] ?? null) === self::RESOURCE_NAME && is_string($resource['url'] ?? null) && $resource['url'] !== '') {
                return $resource['url'];
            }
        }

        throw new RuntimeException('Fuel prices: the current prices resource is not in the CKAN package.');
    }

    /** @return array<string, mixed> */
    private function downloadOptions(): array
    {
        $options = ['verify' => true, 'allow_redirects' => ['max' => 3, 'protocols' => ['http', 'https']],
            'progress' => function ($total, $downloaded): void {
                if (max($total, $downloaded) > self::MAX_BYTES) {
                    throw new RuntimeException('Fuel prices: download exceeds the size limit.');
                }
            },
        ];
        // Use the existing Windows trust, never disable certificate verification.
        if (PHP_OS_FAMILY === 'Windows' && defined('CURLSSLOPT_NATIVE_CA')) {
            $options['curl'][CURLOPT_SSL_OPTIONS] = CURLSSLOPT_NATIVE_CA;
        }

        return $options;
    }

    /**
     * @param  resource  $stream
     * @return array{source_date: string, national: array<string, float>, provinces: array<string, array<string, float>>}
     */
    private function aggregate($stream): array
    {
        $header = fgetcsv($stream, 0, ',', '"', '');
        $names = is_array($header) ? array_map(fn ($name) => trim((string) preg_replace('/^\xEF\xBB\xBF/', '', (string) $name)), $header) : [];
        $columns = array_flip($names);
        foreach (['provincia', 'producto', 'tipohorario', 'precio', 'fecha_vigencia'] as $required) {
            if (! isset($columns[$required])) {
                throw new RuntimeException("Fuel prices: the CSV has no '{$required}' column.");
            }
        }

        $byProvince = [];
        $national = [];
        $sourceDate = null;
        while (($row = fgetcsv($stream, 0, ',', '"', '')) !== false) {
            $type = self::PRODUCTS[$this->plain($row[$columns['producto']] ?? '')] ?? null;
            $price = $row[$columns['precio']] ?? null;
            if ($type === null || $this->plain($row[$columns['tipohorario']] ?? '') !== 'diurno'
                || ! is_numeric($price) || (float) $price <= 0) {
                continue;
            }
            $province = $this->calculator->normalizeProvince($this->utf8($row[$columns['provincia']] ?? ''));
            if ($province === '') {
                continue;
            }
            $byProvince[$province][$type][] = (float) $price;
            $national[$type][] = (float) $price;
            $date = substr((string) ($row[$columns['fecha_vigencia']] ?? ''), 0, 10);
            if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) === 1 && ($sourceDate === null || $date > $sourceDate)) {
                $sourceDate = $date;
            }
        }
        if ($national === [] || $sourceDate === null) {
            throw new RuntimeException('Fuel prices: the CSV has no usable daytime prices.');
        }

        return [
            'source_date' => $sourceDate,
            'national' => array_map($this->percentile(...), $national),
            'provinces' => array_map(fn (array $types) => array_map($this->percentile(...), $types), $byProvince),
        ];
    }

    /**
     * Linear interpolation between the closest ranks, rounded to cents.
     *
     * @param  list<float>  $prices
     */
    private function percentile(array $prices): float
    {
        sort($prices);
        $position = self::PERCENTILE * (count($prices) - 1);
        $low = (int) floor($position);
        $high = (int) ceil($position);

        return round($prices[$low] + ($prices[$high] - $prices[$low]) * ($position - $low), 2);
    }

    private function plain(string $text): string
    {
        return strtr(mb_strtolower(trim($this->utf8($text))), ['á' => 'a', 'é' => 'e', 'í' => 'i', 'ó' => 'o', 'ú' => 'u']);
    }

    private function utf8(string $text): string
    {
        return mb_check_encoding($text, 'UTF-8') ? $text : mb_convert_encoding($text, 'UTF-8', 'ISO-8859-1');
    }
}
