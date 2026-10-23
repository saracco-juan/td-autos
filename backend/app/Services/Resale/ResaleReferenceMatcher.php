<?php

namespace App\Services\Resale;

use Illuminate\Support\Str;

/** Resolve one local catalog row; never merge curves or choose the first ambiguous match. */
final class ResaleReferenceMatcher
{
    public function resolve(object $car, array $rows): ?array
    {
        $label = $this->text($car->version ?? '');
        if ($label === '') {
            return null;
        }
        $wanted = $this->parts($label);
        $engine = $this->engine($this->text((string) ($car->motor ?? '')));
        $power = ($car->potencia_unidad ?? '') === 'CV' ? $car->potencia : null;
        $transmission = match ($car->transmision ?? null) {
            'automatica' => 'auto', 'manual' => 'manual', default => null,
        };
        foreach (['engine' => $engine, 'power' => $power, 'transmission' => $transmission] as $key => $fact) {
            if ($fact !== null && $wanted[$key] !== null && $wanted[$key] != $fact) {
                return null;
            }
            $wanted[$key] ??= $fact;
        }
        $exact = $strict = $typos = [];
        foreach ($rows as $row) {
            $parts = $this->parts($this->text($row['version']));
            if (! $this->compatible($wanted, $parts)) {
                continue;
            }
            if (trim(preg_replace('/[^a-z0-9]+/', ' ', $this->text($row['version']))) === trim(preg_replace('/[^a-z0-9]+/', ' ', $label))) {
                $exact[] = $row;

                continue;
            }
            // Tolerant matching needs technical identity and an observed price for this year.
            if ($wanted['engine'] === null || $parts['engine'] === null
                || ! isset($row['values'][$car->anio]) || $wanted['trim'] === []) {
                continue;
            }
            if ($wanted['trim'] === $parts['trim']) {
                $strict[] = $row;
            } elseif ($this->singleTypo($wanted['trim'], $parts['trim'])) {
                $typos[] = $row;
            }
        }
        $matches = $exact !== [] ? $exact : ($strict !== [] ? $strict : $typos);

        return count($matches) === 1 ? $matches[0] : null;
    }

    private function compatible(array $wanted, array $candidate): bool
    {
        foreach (['engine', 'power', 'generation', 'transmission', 'gearbox'] as $key) {
            if ($wanted[$key] !== null && $candidate[$key] !== null && $wanted[$key] != $candidate[$key]) {
                return false;
            }
        }

        // An unmarked engine-bearing catalog variant is not evidence of an automatic gearbox.
        return ! ($wanted['transmission'] === 'auto' && $candidate['engine'] !== null
            && $candidate['transmission'] === null)
            && ($wanted['gearbox'] === null || $wanted['gearbox'] === $candidate['gearbox']);
    }

    private function parts(string $label): array
    {
        $engine = $this->engine($label);
        preg_match('/\b(\d+)\s*cv\b/', $label, $power);
        preg_match('/\bl(\d{2})\b/', $label, $generation);
        $auto = preg_match('/\b(at|cvt|tiptronic|dsg|automatic[ao])\b/', $label);
        $manual = preg_match('/\b(mt|manual)\b/', $label);
        preg_match('/\b(cvt|dsg)\b/', $label, $gearbox);
        $trim = preg_replace([
            '/\b\d[.,]\d\b/', '/\b\d+\s*cv\b/', '/\bl\d{2}\b/',
            '/\b(at|cvt|tiptronic|dsg|automatic[ao]|mt|manual)\b/',
            '/\bi[ -]?vtec\b/', '/\bpaddleshift\s*\d*\b/',
            '/\b(sedan|\d\s*ptas|[24]wd)\b/',
        ], ' ', $label);
        $trim = preg_replace('/\bex[ -]+l\b/', 'exl', $trim);
        $tokens = preg_split('/[^a-z0-9+]+/', $trim, -1, PREG_SPLIT_NO_EMPTY);
        sort($tokens);

        return ['engine' => $engine, 'power' => isset($power[1]) ? (int) $power[1] : null,
            'generation' => $generation[1] ?? null, 'transmission' => $auto ? 'auto' : ($manual ? 'manual' : null),
            'gearbox' => $gearbox[1] ?? null, 'trim' => $tokens];
    }

    private function singleTypo(array $wanted, array $candidate): bool
    {
        $left = array_values(array_diff($wanted, $candidate));
        $right = array_values(array_diff($candidate, $wanted));

        return count($wanted) === count($candidate) && count($left) === 1 && count($right) === 1
            && min(strlen($left[0]), strlen($right[0])) >= 4
            && levenshtein($left[0], $right[0]) <= 2;
    }

    private function engine(string $label): ?string
    {
        preg_match('/\b(\d[.,]\d)\b/', $label, $match);

        return isset($match[1]) ? str_replace(',', '.', $match[1]) : null;
    }

    private function text(string $value): string
    {
        return trim(Str::ascii(mb_strtolower($value, 'UTF-8')));
    }
}
