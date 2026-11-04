<?php

namespace Database\Seeders\Support;

use RuntimeException;

final class DemoCredentials
{
    public static function password(): string
    {
        $password = config('demo.password');

        if (! is_string($password) || trim($password) === '') {
            throw new RuntimeException('Set DEMO_PASSWORD before creating demo accounts.');
        }

        return $password;
    }
}
