<?php

namespace App\Services\Resale;

use DateTimeImmutable;
use Smalot\PdfParser\Config;
use Smalot\PdfParser\Parser;
use Throwable;
use UnexpectedValueException;

/** Reads ACARA's positioned table; never fetches, persists or guesses inventory identity. */
final class AcaraPriceReader
{
    public function read(string $bytes): array
    {
        if (strlen($bytes) > 25 * 1024 * 1024 || ! str_starts_with($bytes, '%PDF-')
            || ! str_ends_with(rtrim($bytes), '%%EOF')) {
            throw new UnexpectedValueException('Invalid ACARA PDF envelope.');
        }
        $config = new Config;
        $config->setDecodeMemoryLimit(2 * 1024 * 1024);
        try {
            $pages = (new Parser([], $config))->parseContent($bytes)->getPages();
        } catch (Throwable $error) {
            throw new UnexpectedValueException('Unreadable ACARA PDF.', 0, $error);
        }
        if (! $pages || count($pages) > 500) {
            throw new UnexpectedValueException('Invalid ACARA page count.');
        }
        $make = $model = $date = null;
        $columns = $labels = $rows = [];
        foreach ($pages as $pageNumber => $page) {
            $tokens = array_map(fn ($item) => [(float) $item[0][4], (float) $item[0][5], trim($item[1])], $page->getDataTm());
            for ($i = 0; $i < count($tokens); $i++) {
                [$x, $y, $text] = $tokens[$i];
                if (in_array($text, ['', 'Guía Oficial de Precios', 'Importes en pesos redondeados sin decimales'], true)) {
                    continue;
                }
                if (str_starts_with($text, 'Precios al:')) {
                    $raw = trim(substr($text, strlen('Precios al:')));
                    $parsed = DateTimeImmutable::createFromFormat('!d/m/Y', $raw);
                    if (! $parsed || $parsed->format('d/m/Y') !== $raw) {
                        throw new UnexpectedValueException('Invalid ACARA source date.');
                    }
                    $sourceDate = $parsed->format('Y-m-d');
                    if ($date !== null && $date !== $sourceDate) {
                        throw new UnexpectedValueException('Inconsistent ACARA source dates.');
                    }
                    $date = $sourceDate;

                    continue;
                }
                if (($tokens[$i + 1][2] ?? null) === '0km') {
                    $make = $text;
                    $model = null;
                    $labels = [];
                    $columns = [$tokens[++$i]];
                    while (isset($tokens[$i + 1]) && $tokens[$i + 1][0] >= 30 && preg_match('/^\d{4}$/D', $tokens[$i + 1][2])) {
                        $next = $tokens[++$i];
                        $previous = end($columns);
                        if (abs($next[1] - $y) > 0.1 || $next[0] <= $previous[0]
                            || (count($columns) > 1 && (int) $next[2] >= (int) $previous[2])) {
                            throw new UnexpectedValueException('Invalid ACARA year columns.');
                        }
                        $columns[] = $next;
                    }

                    continue;
                }
                if (in_array($text, ['$', 'u$s'], true)) {
                    if (! $make || count($columns) < 2 || ! $labels) {
                        throw new UnexpectedValueException('Missing ACARA table context.');
                    }
                    // Wrapped descriptions are vertically centered on their currency cell.
                    $start = count($labels) - 1;
                    while ($start >= 0 && abs(($labels[$start][1] + end($labels)[1]) / 2 - $y) > 0.1) {
                        $start--;
                    }
                    if ($start < 0) {
                        throw new UnexpectedValueException('Ambiguous ACARA description.');
                    }
                    if ($start > 0) {
                        $model = implode(' ', array_column(array_slice($labels, 0, $start), 2));
                    }
                    $version = implode(' ', array_column(array_slice($labels, $start), 2));
                    $labels = [];
                    if (! $model || ! $version) {
                        throw new UnexpectedValueException('Missing ACARA model or version.');
                    }
                    $values = [];
                    foreach ($columns as $column => [$cx, , $year]) {
                        $cell = $tokens[++$i] ?? null;
                        $left = ($columns[$column - 1][0] ?? $cx - ($columns[1][0] - $cx));
                        $right = ($columns[$column + 1][0] ?? $cx + ($cx - $columns[$column - 1][0]));
                        if (! $cell || abs($cell[1] - $y) > 0.1 || $cell[0] <= ($left + $cx) / 2 || $cell[0] >= ($right + $cx) / 2) {
                            throw new UnexpectedValueException('Misaligned ACARA price cell.');
                        }
                        $values[$year] = $this->amount($cell[2]);
                    }
                    $rows[] = [
                        'make' => $make, 'model' => $model, 'version' => $version,
                        'version_id' => 'acara:'.hash('sha256', json_encode([$make, $model, $version], JSON_THROW_ON_ERROR)),
                        'currency' => $text === '$' ? 'ARS' : 'USD', 'page' => $pageNumber + 1,
                        'zero_km_price' => $values['0km'], 'values' => array_diff_key($values, ['0km' => true]),
                    ];

                    continue;
                }
                if ($x < 30 && $text !== '') {
                    $labels[] = [$x, $y, $text];

                    continue;
                }
                throw new UnexpectedValueException('Unrecognized ACARA table content.');
            }
        }
        if (! $rows || $labels || ! $date) {
            throw new UnexpectedValueException('Incomplete ACARA table.');
        }
        $hash = hash('sha256', $bytes);

        return ['source_date' => $date, 'sha256' => $hash, 'snapshot_id' => "acara:$date:$hash", 'rows' => $rows];
    }

    private function amount(string $value): ?string
    {
        if ($value === '-') {
            return null;
        }
        if (! preg_match('/^(?:[1-9]\d{0,2}(?:\.\d{3})*|[1-9]\d*)(?:,\d{2})?$/D', $value)) {
            throw new UnexpectedValueException('Invalid ACARA price.');
        }

        return str_replace(['.', ','], ['', '.'], $value);
    }
}
