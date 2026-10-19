<?php

namespace App\Support;

/**
 * Allowlist for the URL the browser hands control back to the app with (custom scheme / Expo Go).
 */
class MobileReturnUrl
{
    public static function isAllowed(mixed $url): bool
    {
        if (! is_string($url) || preg_match('/[\x00-\x20\x7f#\\\\]/', $url) === 1) {
            return false;
        }

        foreach (self::prefixes() as $prefix) {
            if (strlen($url) > strlen($prefix) && str_starts_with($url, $prefix)) {
                return true;
            }
        }

        return false;
    }

    /**
     * @param  array<string, string>  $params
     */
    public static function with(string $url, array $params): string
    {
        return $url.(str_contains($url, '?') ? '&' : '?').http_build_query($params);
    }

    /**
     * @return array<int, string>
     */
    private static function prefixes(): array
    {
        $prefixes = config('mobile.redirect_prefixes');

        if (! app()->isProduction()) {
            $prefixes[] = 'exp://';
        }

        return $prefixes;
    }
}
