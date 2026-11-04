<?php

namespace App\Services\Resale;

use DateTimeImmutable;
use Illuminate\Support\Str;
use UnexpectedValueException;

/** Monthly transfer counts, not sales probabilities or exact trim equivalences. */
final class DnrpaActivityReader
{
    /** Consume the caller-owned stream; return no raw rows or holder information. */
    public function read(mixed $stream, string $month, array $catalog): array
    {
        $date = DateTimeImmutable::createFromFormat('!Y-m', $month);
        if (! is_resource($stream) || get_resource_type($stream) !== 'stream'
            || ! $date || $date->format('Y-m') !== $month) {
            throw new UnexpectedValueException('Invalid DNRPA stream or month.');
        }
        $families = $this->families($catalog);
        $header = fgetcsv($stream, 65536, ',', '"', '');
        if (! is_array($header)) {
            throw new UnexpectedValueException('Missing DNRPA header.');
        }
        $header[0] = preg_replace('/^\xEF\xBB\xBF/', '', $header[0] ?? '');
        $fields = ['tramite_fecha', 'automotor_marca_descripcion', 'automotor_modelo_descripcion'];
        if (count(array_unique($header)) !== count($header) || array_diff($fields, $header)) {
            throw new UnexpectedValueException('Invalid DNRPA header.');
        }
        $indices = array_map(fn ($field) => array_search($field, $header, true), $fields);
        $models = [];
        $transfers = $identified = 0;
        while (($row = fgetcsv($stream, 65536, ',', '"', '')) !== false) {
            if ($row === [null]) {
                continue;
            }
            if (count($row) !== count($header)) {
                throw new UnexpectedValueException('Invalid DNRPA row width.');
            }
            // Whitelist before processing; extra columns never enter the result or errors.
            [$rawDate, $make, $description] = array_map(fn ($index) => $row[$index], $indices);
            $parsed = DateTimeImmutable::createFromFormat('!Y-m-d', $rawDate);
            if (! $parsed || $parsed->format('Y-m-d') !== $rawDate || substr($rawDate, 0, 7) !== $month
                || ! mb_check_encoding($make.$description, 'UTF-8')) {
                throw new UnexpectedValueException('Invalid DNRPA row date or encoding.');
            }
            $make = $this->normalize($make);
            $description = $this->normalize($description);
            $transfers++;
            if ($make === '' || $description === '') {
                continue;
            }
            if (str_starts_with($description, $make.' ')) {
                $description = substr($description, strlen($make) + 1);
            }
            foreach ($families[$make] ?? [] as $model => $markers) {
                $model = (string) $model;
                if ($description !== $model && ! str_starts_with($description, $model.' ')) {
                    continue;
                }
                $special = array_values(array_intersect($markers, explode(' ', $description)));
                $key = $make.'|'.$model.'|'.implode('+', $special);
                $models[$key] ??= ['make' => $make, 'model' => $model, 'special' => $special, 'transfers' => 0];
                $models[$key]['transfers']++;
                $identified++;
                break;
            }
        }
        if (! feof($stream) || $transfers === 0) {
            throw new UnexpectedValueException('Incomplete or empty DNRPA month.');
        }
        $models = array_values($models);
        usort($models, fn ($a, $b) => [$a['make'], $a['model'], $a['special']] <=> [$b['make'], $b['model'], $b['special']]);

        return ['source' => 'DNRPA', 'month' => $month, 'catalog_snapshot_id' => $catalog['snapshot_id'],
            'transfers' => $transfers, 'identified' => $identified, 'unmatched' => $transfers - $identified,
            'models' => $models];
    }

    private function families(array $catalog): array
    {
        if (! is_string($catalog['snapshot_id'] ?? null) || trim($catalog['snapshot_id']) === ''
            || ! is_array($catalog['rows'] ?? null) || ! $catalog['rows']) {
            throw new UnexpectedValueException('Missing ACARA catalog provenance or rows.');
        }
        $families = [];
        foreach ($catalog['rows'] as $row) {
            foreach (['make', 'model', 'version'] as $field) {
                if (! is_string($row[$field] ?? null) || $this->normalize($row[$field]) === '') {
                    throw new UnexpectedValueException('Invalid ACARA catalog identity.');
                }
            }
            $make = $this->normalize($row['make']);
            $model = $this->normalize($row['model']);
            // Only literal, corroborated tokens: TDI/HDI/N are not guessed fuel labels.
            $tokens = explode(' ', $this->normalize($row['model'].' '.$row['version']));
            $markers = array_values(array_intersect(['diesel', 'gti'], $tokens));
            $families[$make][$model] = array_values(array_unique(array_merge($families[$make][$model] ?? [], $markers)));
            sort($families[$make][$model], SORT_STRING);
        }
        foreach ($families as &$models) {
            // Nested names resolve by specificity: Corolla Cross before Corolla.
            uksort($models, fn ($a, $b) => strlen($b) <=> strlen($a) ?: strcmp($a, $b));
        }

        return $families;
    }

    private function normalize(string $value): string
    {
        return trim(preg_replace('/[^a-z0-9]+/', ' ', Str::ascii(mb_strtolower($value, 'UTF-8'))));
    }
}
