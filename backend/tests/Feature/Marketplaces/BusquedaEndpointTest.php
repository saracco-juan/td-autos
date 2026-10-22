<?php

namespace Tests\Feature\Marketplaces;

use App\Models\PublicacionExterna;
use App\Models\User;
use App\Models\Vehiculo;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class BusquedaEndpointTest extends TestCase
{
    use RefreshDatabase;

    private const URL = '/api/busqueda';

    public function test_authenticated_search_returns_the_existing_envelope_without_external_acquisition(): void
    {
        Http::preventStrayRequests();

        $response = $this->actingAs(User::factory()->create())->getJson(self::URL)->assertOk();

        $response->assertJsonPath('publicaciones', [])
            ->assertJsonPath('fuentes', [])
            ->assertJsonPath('meta', ['page' => 1, 'per_page' => 24, 'total' => 0, 'last_page' => 1])
            ->assertJsonStructure(['publicaciones', 'fuentes', 'meta' => ['page', 'per_page', 'total', 'last_page']]);
        Http::assertNothingSent();
        $this->assertDatabaseCount('publicacion_externa', 0);
    }

    public function test_search_keeps_historical_external_records_unchanged(): void
    {
        $vehicle = Vehiculo::factory()->create([
            'origen' => 'externo',
            'marca' => 'Toyota',
            'modelo' => 'Corolla',
            'descripcion' => 'Historical listing',
        ]);
        PublicacionExterna::query()->create([
            'vehiculo_id' => $vehicle->id,
            'marketplace' => 'mercadolibre',
            'external_id' => 'historical-1',
            'url_original' => 'https://example.test/listing',
        ]);
        Http::preventStrayRequests();

        $this->actingAs(User::factory()->create())->getJson(self::URL)
            ->assertOk()
            ->assertJsonPath('fuentes', [])
            ->assertJsonPath('publicaciones', []);

        Http::assertNothingSent();
        $this->assertDatabaseHas('publicacion_externa', [
            'vehiculo_id' => $vehicle->id,
            'marketplace' => 'mercadolibre',
            'external_id' => 'historical-1',
            'url_original' => 'https://example.test/listing',
        ]);
        $this->assertDatabaseHas('vehiculo', [
            'id' => $vehicle->id,
            'origen' => 'externo',
            'descripcion' => 'Historical listing',
        ]);
    }

    public function test_guests_are_rejected(): void
    {
        $this->getJson(self::URL)->assertUnauthorized();
    }

    public function test_search_query_is_validated(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)->getJson(self::URL.'?q='.str_repeat('a', 101))
            ->assertUnprocessable()
            ->assertJsonValidationErrors('q');

        foreach (['page=0', 'page=abc', 'per_page=0', 'per_page=61', 'per_page=x'] as $query) {
            $this->actingAs($user)->getJson(self::URL.'?'.$query)->assertUnprocessable();
        }
    }
}
