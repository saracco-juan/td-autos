<?php

namespace Tests\Feature;

use Illuminate\Support\Env;
use Tests\TestCase;

class ConfigTest extends TestCase
{
    public function test_frontend_url_points_to_the_vite_dev_server(): void
    {
        $this->assertSame('http://localhost:5173', config('app.frontend_url'));
    }

    public function test_sanctum_treats_the_vite_dev_server_as_stateful(): void
    {
        $repository = Env::getRepository();
        $previous = $repository->get('SANCTUM_STATEFUL_DOMAINS');
        $repository->clear('SANCTUM_STATEFUL_DOMAINS');

        try {
            $stateful = (require config_path('sanctum.php'))['stateful'];
        } finally {
            if ($previous !== null) {
                $repository->set('SANCTUM_STATEFUL_DOMAINS', $previous);
            }
        }

        $this->assertContains('localhost:5173', $stateful);
        $this->assertContains('127.0.0.1:5173', $stateful);
    }

    public function test_cors_allows_the_vite_dev_server_origin(): void
    {
        $this->assertContains('http://localhost:5173', config('cors.allowed_origins'));
    }

    public function test_defaults_target_the_vite_dev_server_when_env_is_unset(): void
    {
        $repository = Env::getRepository();
        $previous = $repository->get('FRONTEND_URL');
        $repository->clear('FRONTEND_URL');

        try {
            $this->assertSame('http://localhost:5173', (require config_path('app.php'))['frontend_url']);
            $this->assertSame(['http://localhost:5173'], (require config_path('cors.php'))['allowed_origins']);
        } finally {
            $repository->set('FRONTEND_URL', $previous);
        }
    }
}
