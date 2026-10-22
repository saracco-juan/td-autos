<?php

namespace App\Support;

use Illuminate\Support\Str;

final class Email
{
    /**
     * Canonical stored form: trimmed and lowercase.
     */
    public static function normalize(string $email): string
    {
        return Str::lower(trim($email));
    }
}
