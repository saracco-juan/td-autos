<?php

namespace App\Support;

/**
 * Argentine license plates: stored normalized so one car cannot be loaded twice
 * under different spellings.
 */
final class Patente
{
    /** AAA123 (until 2016) and AA123AA (Mercosur). */
    private const FORMAT = '/\A(?:[A-Z]{3}[0-9]{3}|[A-Z]{2}[0-9]{3}[A-Z]{2})\z/';

    /**
     * Uppercase, without spaces, dashes or dots.
     */
    public static function normalize(string $plate): string
    {
        return strtoupper(preg_replace('/[\s.\-]+/u', '', $plate));
    }

    /**
     * Whether an already normalized plate follows one of the accepted formats.
     */
    public static function isValid(string $plate): bool
    {
        return preg_match(self::FORMAT, $plate) === 1;
    }
}
