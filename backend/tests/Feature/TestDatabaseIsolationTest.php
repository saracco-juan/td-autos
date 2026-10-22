<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\DB;
use SimpleXMLElement;
use Tests\TestCase;

/**
 * Guards the test suite against touching a real database. It deliberately
 * avoids RefreshDatabase and migrations: it must be safe to run first.
 */
class TestDatabaseIsolationTest extends TestCase
{
    public function test_phpunit_forces_an_empty_db_url(): void
    {
        $xml = new SimpleXMLElement(file_get_contents(base_path('phpunit.xml')));
        $entries = $xml->xpath('//php/env[@name="DB_URL"]');

        $this->assertCount(1, $entries, 'phpunit.xml must declare DB_URL.');
        $this->assertSame('', (string) $entries[0]['value']);
        $this->assertSame('true', (string) $entries[0]['force']);
    }

    public function test_phpunit_forces_the_in_memory_sqlite_connection(): void
    {
        $xml = new SimpleXMLElement(file_get_contents(base_path('phpunit.xml')));

        foreach (['DB_CONNECTION' => 'sqlite', 'DB_DATABASE' => ':memory:'] as $name => $value) {
            $entries = $xml->xpath('//php/env[@name="'.$name.'"]');

            $this->assertCount(1, $entries, "phpunit.xml must declare {$name}.");
            $this->assertSame($value, (string) $entries[0]['value']);
            $this->assertSame('true', (string) $entries[0]['force']);
        }
    }

    public function test_tests_run_against_the_in_memory_sqlite_database(): void
    {
        $this->assertSame('sqlite', config('database.default'));
        $this->assertEmpty(config('database.connections.sqlite.url'));
        $this->assertSame(':memory:', config('database.connections.sqlite.database'));
        $this->assertSame('sqlite', DB::connection()->getDriverName());
    }
}
