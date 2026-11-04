<?php

namespace App\Support;

use Brick\Math\BigNumber;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationRuleParser;
use Throwable;

/**
 * Pure PHP verdict of the publication rules over the declared matching facts of a vehicle row.
 *
 * The recommendation ranker needs this verdict for every vehicle of the inventory on every request,
 * and building a Laravel validator per row costs about 2 ms. The checks here are compiled once per
 * year from the very same `VehiculoFields::rules()` (one source of truth) and reproduce the
 * semantics of the Laravel rules in use. A rule this class does not know makes the whole check fall
 * back to the validator, so adding a rule to `VehiculoFields` can never silently weaken the check.
 *
 * Known difference: where the validator would throw (numbers the BigNumber library cannot parse,
 * such as NAN or an exponent beyond +-1000) this reports invalid instead.
 */
final class VehiculoMatchingFacts
{
    private const SUPPORTED_RULES = [
        'Bail', 'Required', 'Nullable', 'RequiredIf', 'String', 'Integer', 'Numeric', 'Boolean',
        'In', 'Between', 'Max', 'Min', 'Gt', 'Decimal',
    ];

    /** @var array<int, array<string, array<string, mixed>>|null> compiled field specs by year, null when unsupported */
    private static array $compiled = [];

    /**
     * Rules the ranker applies: publication rules without the plate, with the body and year
     * checks that do not depend on persistence.
     *
     * @return array<string, array<int, mixed>>
     */
    public static function rules(int $year): array
    {
        $rules = VehiculoFields::rules(includeMatchingFacts: true);
        unset($rules['patente']);
        $rules['carroceria_id'] = ['required', 'integer', 'min:1'];
        $rules['anio'] = ['required', 'integer', 'between:1950,'.($year + 1)];

        return $rules;
    }

    /**
     * Same verdict as validating the raw attributes with `rules($year)`; the caller adds
     * `carroceria_id` (the body type column) to the attributes.
     *
     * @param  array<string, mixed>  $attributes
     */
    public static function valid(array $attributes, int $year): bool
    {
        if (! array_key_exists($year, self::$compiled)) {
            self::$compiled[$year] = self::compile(self::rules($year));
        }
        $specs = self::$compiled[$year];

        if ($specs === null) {
            return Validator::make($attributes, self::rules($year))->passes();
        }

        foreach ($specs as $field => $spec) {
            if (! self::fieldValid($field, $spec, $attributes)) {
                return false;
            }
        }

        return true;
    }

    /**
     * @param  array<string, array<int, mixed>>  $rules
     * @return array<string, array<string, mixed>>|null
     */
    private static function compile(array $rules): ?array
    {
        $specs = [];
        foreach ($rules as $field => $fieldRules) {
            $spec = ['required' => false, 'nullable' => false, 'requiredIf' => null, 'numeric' => false, 'checks' => []];
            foreach ($fieldRules as $rule) {
                if ($rule instanceof \Stringable) {
                    $rule = (string) $rule;
                }
                if (! is_string($rule)) {
                    return null;
                }
                [$name, $params] = ValidationRuleParser::parse($rule);
                if (! in_array($name, self::SUPPORTED_RULES, true)) {
                    return null;
                }
                match ($name) {
                    'Bail' => null,
                    'Required' => $spec['required'] = true,
                    'Nullable' => $spec['nullable'] = true,
                    'RequiredIf' => $spec['requiredIf'] = [$params[0], array_slice($params, 1)],
                    default => $spec['checks'][] = [$name, $params],
                };
                if (in_array($name, ['Numeric', 'Integer', 'Decimal'], true)) {
                    $spec['numeric'] = true;
                }
            }
            // Most columns are required booleans (the equipment declarations): decide them in one step.
            $spec['boolean'] = $spec['required'] && ! $spec['nullable'] && $spec['requiredIf'] === null
                && array_column($spec['checks'], 0) === ['Boolean'];
            $specs[$field] = $spec;
        }

        return $specs;
    }

    /**
     * @param  array<string, mixed>  $spec
     * @param  array<string, mixed>  $data
     */
    private static function fieldValid(string $field, array $spec, array $data): bool
    {
        if ($spec['boolean']) {
            return in_array($data[$field] ?? null, [true, false, 0, 1, '0', '1'], true);
        }

        $present = array_key_exists($field, $data);
        $value = $data[$field] ?? null;

        // Implicit rules run even when the value is empty or missing.
        if ($spec['requiredIf'] !== null && self::requiredIfApplies($spec['requiredIf'], $data) && ! self::filled($value)) {
            return false;
        }
        if ($spec['required'] && ! self::filled($value)) {
            return false;
        }

        // The remaining rules skip a missing value, a blank string and a null marked nullable.
        if (! $present || (is_string($value) && trim($value) === '') || ($value === null && $spec['nullable'])) {
            return true;
        }

        foreach ($spec['checks'] as [$name, $params]) {
            if (! self::check($name, $params, $value, $spec['numeric'])) {
                return false;
            }
        }

        return true;
    }

    /**
     * @param  array{string, list<string>}  $condition
     * @param  array<string, mixed>  $data
     */
    private static function requiredIfApplies(array $condition, array $data): bool
    {
        [$other, $values] = $condition;
        if (! array_key_exists($other, $data)) {
            return false;
        }
        $value = $data[$other];

        return in_array($value, $values, is_bool($value) || $value === null);
    }

    private static function filled(mixed $value): bool
    {
        if ($value === null || (is_string($value) && trim($value) === '')) {
            return false;
        }

        return ! (is_countable($value) && count($value) < 1);
    }

    /**
     * @param  list<string>  $params
     */
    private static function check(string $name, array $params, mixed $value, bool $numericField): bool
    {
        return match ($name) {
            'String' => is_string($value),
            'Integer' => filter_var($value, FILTER_VALIDATE_INT) !== false,
            'Numeric' => is_numeric($value),
            'Boolean' => in_array($value, [true, false, 0, 1, '0', '1'], true),
            'In' => ! is_array($value) && in_array((string) $value, $params, true),
            'Between' => ($min = self::compare($value, $params[0], $numericField)) !== null
                && $min >= 0 && ($max = self::compare($value, $params[1], $numericField)) !== null && $max <= 0,
            'Max' => ($cmp = self::compare($value, $params[0], $numericField)) !== null && $cmp <= 0,
            'Min' => ($cmp = self::compare($value, $params[0], $numericField)) !== null && $cmp >= 0,
            'Gt' => is_numeric($value) && ($cmp = self::compare($value, $params[0], true)) !== null && $cmp > 0,
            'Decimal' => self::decimal($value, $params),
        };
    }

    /**
     * @param  list<string>  $params
     */
    private static function decimal(mixed $value, array $params): bool
    {
        if (! is_numeric($value) || preg_match('/^[+-]?\d*\.?(\d*)$/', (string) $value, $matches) !== 1) {
            return false;
        }
        $decimals = strlen(end($matches));

        return isset($params[1])
            ? $decimals >= $params[0] && $decimals <= $params[1]
            : $decimals == $params[0];
    }

    /**
     * Compares the Laravel "size" of the value (the number itself for numeric fields, otherwise the
     * string length or item count) with a rule limit. Null when the library cannot parse the number.
     */
    private static function compare(mixed $value, string $limit, bool $numericField): ?int
    {
        if ($numericField && is_int($value) && abs($value) < 2 ** 53) {
            return $value <=> (float) $limit;
        }
        if (is_numeric($value) && $numericField) {
            $size = is_string($value) ? trim($value) : (string) $value;
        } elseif (is_array($value)) {
            return count($value) <=> (float) $limit;
        } else {
            return mb_strlen($value ?? '') <=> (float) $limit;
        }

        // Plain numbers far from the limit need no arbitrary precision.
        if (! is_float($value) || is_finite($value)) {
            if (strpbrk($size, 'eE') === false) {
                $a = (float) $size;
                $b = (float) $limit;
                if (abs($a - $b) > 1e-9 * max(1.0, abs($b))) {
                    return $a <=> $b;
                }
            }
        }

        try {
            if (strpbrk($size, 'eE') !== false && abs((int) substr($size, (int) stripos($size, 'e') + 1)) > 1000) {
                return null;
            }

            return BigNumber::of($size)->compareTo(trim($limit));
        } catch (Throwable) {
            return null;
        }
    }
}
