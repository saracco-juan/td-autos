<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    protected function tearDown(): void
    {
        // Cron endpoints call set_time_limit(); in the test runner that limit would cover every later test.
        set_time_limit(0);

        parent::tearDown();
    }
}
