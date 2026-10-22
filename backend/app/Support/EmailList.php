<?php

namespace App\Support;

final class EmailList
{
    /**
     * Parses a comma separated list of addresses: trimmed, empty entries removed.
     *
     * @return list<string>
     */
    public static function parse(?string $raw): array
    {
        return array_values(array_filter(
            array_map('trim', explode(',', $raw ?? '')),
            fn (string $email) => $email !== '',
        ));
    }
}
