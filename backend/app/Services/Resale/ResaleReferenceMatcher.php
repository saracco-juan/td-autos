<?php

namespace App\Services\Resale;

use Illuminate\Support\Str;

/** Resolve compatible local references; never stitch curves or choose the first ambiguous match. */
final class ResaleReferenceMatcher
{
    private const TURBO_WORDS = 'tsi|tfsi|thp|tbi|turbo';

    public function candidates(object $car, array $rows, bool $allowGroup = true): array
    {
        $label = $this->text($car->version ?? '');
        if ($label === '') {
            return [];
        }
        $wanted = $this->parts($label);
        $facts = $this->listingFacts($car);
        $wanted['body'] ??= $facts['body'];
        unset($facts['body']);
        foreach ($facts as $key => $fact) {
            if ($fact !== null && $wanted[$key] !== null && $wanted[$key] != $fact) {
                return [];
            }
            $wanted[$key] ??= $fact;
        }
        $exact = $strict = $typos = $fallback = [];
        foreach ($rows as $row) {
            $parts = $this->parts($this->text($row['version']));
            if (! $this->compatible($wanted, $parts)) {
                continue;
            }
            $row['_technical'] = array_intersect_key($parts, array_flip(['engine', 'power', 'transmission', 'gearbox', 'body', 'doors', 'fuel', 'turbo', 'special']));
            if (trim(preg_replace('/[^a-z0-9]+/', ' ', $this->text($row['version']))) === trim(preg_replace('/[^a-z0-9]+/', ' ', $label))) {
                $exact[] = $row;

                continue;
            }
            if (($wanted['engine'] === null || $parts['engine'] === null) && count($wanted['trim']) < 2) {
                continue;
            }
            $fallback[] = $row;
            if ($wanted['trim'] !== [] && in_array($wanted['trim'], $parts['aliases'], true)) {
                $strict[] = $row;
            } elseif ($this->singleTypo($wanted['trim'], $parts['trim'])) {
                $typos[] = $row;
            }
        }
        foreach ([$exact, $strict, $typos] as $tier) {
            $dated = array_values(array_filter($tier, fn ($r) => is_numeric($r['values'][$car->anio] ?? null)
                && is_finite((float) $r['values'][$car->anio]) && $r['values'][$car->anio] > 0));
            if ($dated !== []) {
                return $dated;
            }
        }
        $matches = $exact !== [] ? $exact : ($strict !== [] ? $strict : $typos);

        return $matches !== [] ? $matches : ($allowGroup && count($fallback) > 1 ? $fallback : []);
    }

    /** Approximate family inference needs positive technical evidence, not name similarity alone. */
    public function approximateCandidates(object $car, array $rows): array
    {
        $normalize = $this->normalize(...);
        $model = $normalize($car->modelo ?? '');
        $facts = $this->listingFacts($car, approximate: true);
        $wanted = $this->parts($this->text($car->version ?? ''));
        if (strlen($model) < 3 || $facts['engine'] === null || $facts['transmission'] === null || $facts['body'] === null
            || ! ($facts['power'] > 0) || $wanted['trim'] === []) {
            return [];
        }
        $identity = $this->parts($this->text(($car->modelo ?? '').' '.($car->version ?? '')));
        $identity['fuel'] ??= $facts['fuel'];
        $identity['turbo'] ??= $facts['turbo'];
        $families = [];
        foreach ($rows as $row) {
            $candidate = $normalize($row['model']);
            if ($candidate === $model || $normalize($row['make']) !== $normalize($car->marca ?? '')
                || ! (str_starts_with($candidate, $model.' ') || str_starts_with($model, $candidate.' '))) {
                continue;
            }
            if (! $this->compatible($identity, $this->parts($this->text($row['model'].' '.$row['version'])))) {
                continue;
            }
            $parts = $this->parts($this->text($row['version']));
            $candidateBody = $parts['body'] ?? ['3' => 'hatch', '5' => 'hatch', '4' => 'sedan'][$parts['doors']] ?? null;
            $price = $row['values'][$car->anio] ?? null;
            if ($parts['engine'] !== $facts['engine'] || $parts['power'] != $facts['power']
                || $parts['transmission'] !== $facts['transmission'] || $candidateBody !== $facts['body']
                || ! in_array($wanted['trim'], $parts['aliases'], true)
                || ! is_numeric($price) || ! is_finite((float) $price) || $price <= 0) {
                continue;
            }
            foreach ($this->candidates($car, [$row], false) as $match) {
                $families[$candidate][] = $match;
            }
        }

        return count($families) === 1 ? reset($families) : [];
    }

    /** Shared facts, preserving the existing ordinary and approximate normalization profiles. */
    private function listingFacts(object $car, bool $approximate = false): array
    {
        $engine = (string) ($car->motor ?? '');
        $body = method_exists($car, 'relationLoaded') && $car->relationLoaded('tipoCarroceria')
            ? ($car->getRelation('tipoCarroceria')->nombre ?? '') : '';
        $normalize = $approximate ? $this->normalize(...) : $this->text(...);
        $bodies = [];
        foreach (['hatchback' => 'hatch', 'sedan' => 'sedan', 'rural / familiar' => 'wagon'] as $name => $identity) {
            $bodies[$normalize($name)] = $identity;
        }

        return ['engine' => $this->engine($approximate ? $engine : $this->text($engine)),
            'power' => ($car->potencia_unidad ?? '') === 'CV' ? $car->potencia : null,
            'transmission' => ['manual' => 'manual', 'automatica' => 'auto'][$car->transmision ?? ''] ?? null,
            'fuel' => $car->combustible ?? null, 'turbo' => $car->turbo ?? null,
            'body' => $bodies[$normalize($body)] ?? null];
    }

    private function normalize(string $value): string
    {
        return trim(preg_replace('/[^a-z0-9]+/', ' ', $this->text($value)));
    }

    private function compatible(array $wanted, array $candidate): bool
    {
        foreach (['engine', 'power', 'generation', 'transmission', 'gearbox', 'body', 'doors', 'fuel', 'turbo', 'special'] as $key) {
            if ($wanted[$key] !== null && $candidate[$key] !== null && $wanted[$key] != $candidate[$key]) {
                return false;
            }
        }

        // An unmarked engine-bearing catalog variant is not evidence of an automatic gearbox.
        return ! ($wanted['transmission'] === 'auto' && $candidate['engine'] !== null
            && $candidate['transmission'] === null)
            && ($wanted['gearbox'] === null || $wanted['gearbox'] === $candidate['gearbox'])
            && $wanted['special'] === $candidate['special'];
    }

    private function parts(string $label): array
    {
        $engine = $this->engine($label);
        preg_match('/\b(\d+)\s*cv\b/', $label, $power);
        preg_match('/\bl(\d{2})\b/', $label, $generation);
        $auto = preg_match('/\b(at\d?|\d?at|cvt|tiptronic|dsg|powershift|automatic[ao])\b/', $label);
        $manual = preg_match('/\b(\d?mt|mt\d?|manual)\b/', $label);
        preg_match('/\b(cvt|dsg)\b/', $label, $gearbox);
        preg_match('/\b([345])\s*ptas\b/', $label, $doors);
        $body = preg_match('/\b(variant|sw|rural|familiar)\b/', $label) ? 'wagon' : (preg_match('/\b(sedan|4ptas)\b/', $label) ? 'sedan' : null);
        $fuel = preg_match('/\b(diesel|tdi|hdi|dci)\b/', $label) ? 'diesel' : null;
        $turbo = preg_match('/\b('.self::TURBO_WORDS.')\b|\d[.,]\dt\b/', $label) ? true : null;
        $trim = preg_replace([
            '/\b\d[.,]\d(?:tsi|tbi|tdi|t)?\b/', '/\b\d+\s*cv\b/', '/\bl\d{2}\b/',
            '/\b(at\d?|\d?at|cvt|tiptronic|dsg|powershift|automatic[ao]|\d?mt|mt\d?|manual)\b/',
            // Technical terms cannot also become trim modifiers; keep recognition and removal in sync.
            '/\b('.self::TURBO_WORDS.')\b/',
            '/\bi[ -]?vtec\b/', '/\bpaddleshift\s*\d*\b/',
            '/\b(sedan|\d\s*ptas|[24]wd)\b/',
        ], ' ', $label);
        $trim = preg_replace('/\bex[ -]+l\b/', 'exl', $trim);
        $tokens = preg_split('/[^a-z0-9+]+/', $trim, -1, PREG_SPLIT_NO_EMPTY);
        sort($tokens);
        $aliases = array_map(function ($name) {
            $words = preg_split('/[^a-z0-9+]+/', $name, -1, PREG_SPLIT_NO_EMPTY);
            sort($words);

            return $words;
        }, explode('/', $trim));

        return ['engine' => $engine, 'power' => isset($power[1]) ? (int) $power[1] : null,
            'generation' => $generation[1] ?? null, 'transmission' => $auto ? 'auto' : ($manual ? 'manual' : null),
            'gearbox' => $gearbox[1] ?? null, 'trim' => $tokens, 'aliases' => $aliases,
            'body' => $body, 'doors' => $doors[1] ?? null, 'fuel' => $fuel, 'turbo' => $turbo,
            'special' => preg_match('/\bgti\b/', $label) ? 'gti' : null];
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
        preg_match('/\b(\d[.,]\d)(?!\d)/', $label, $match);

        return isset($match[1]) ? str_replace(',', '.', $match[1]) : null;
    }

    private function text(string $value): string
    {
        return trim(Str::ascii(mb_strtolower($value, 'UTF-8')));
    }
}
