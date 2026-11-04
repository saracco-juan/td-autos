<?php

namespace Tests\Feature\Portales;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RetiredSearchEndpointTest extends TestCase
{
    use RefreshDatabase;

    public function test_the_centralized_search_endpoint_no_longer_exists(): void
    {
        $this->actingAs(User::factory()->create())->getJson('/api/busqueda')->assertNotFound();
    }
}
