<?php

namespace Database\Seeders\RealDemo;

use Illuminate\Support\Facades\DB;

/**
 * Describes the database the demo commands are about to write to. It reads the effective connection
 * (`DB_URL` is merged only when Laravel builds it, so the config array can name another host) and never
 * includes the password.
 */
final class RealDemoTarget
{
    public static function describe(): string
    {
        $connection = DB::connection();

        return sprintf(
            '%s @ %s',
            $connection->getConfig('driver') ?? '?',
            $connection->getConfig('host') ?? $connection->getConfig('database') ?? '?',
        );
    }
}
