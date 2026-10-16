<?php

namespace Tests\Feature\Marketplaces;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/**
 * UH-06 (RF05): the buyer searches every integrated marketplace in one call (TC-18, TC-19).
 */
class BusquedaEndpointTest extends TestCase
{
    use RefreshDatabase;

    private const URL = '/api/busqueda';

    public function test_buyer_gets_the_unified_list_from_the_recorded_source(): void
    {
        $response = $this->actingAs(User::factory()->create())->getJson(self::URL)->assertOk();

        $this->assertCount(24, $response->json('publicaciones'));
        $response->assertJsonPath('meta', ['page' => 1, 'per_page' => 24, 'total' => 26, 'last_page' => 2]);
        $response->assertJsonPath('fuentes.0', ['clave' => 'mercadolibre', 'nombre' => 'Mercado Libre', 'estado' => 'ok']);
        $response->assertJsonStructure(['publicaciones' => [[
            'id', 'titulo', 'marca', 'modelo', 'version', 'anio', 'kilometraje', 'precio', 'moneda',
            'ubicacion', 'imagen_url', 'url_original', 'fuente' => ['clave', 'nombre'],
        ]]]);
        $first = $response->json('publicaciones.0');
        $this->assertSame('mercadolibre', $first['fuente']['clave']);
        $this->assertDatabaseHas('vehiculo', ['id' => $first['id'], 'origen' => 'externo']);
    }

    public function test_the_same_search_twice_does_not_duplicate_vehicles(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)->getJson(self::URL)->assertOk();
        $this->actingAs($user)->getJson(self::URL)->assertOk();

        $this->assertDatabaseCount('publicacion_externa', 26);
        $this->assertDatabaseCount('vehiculo', 26);
    }

    public function test_q_filters_the_listings(): void
    {
        $response = $this->actingAs(User::factory()->create())->getJson(self::URL.'?q=corolla')->assertOk();

        $this->assertNotEmpty($response->json('publicaciones'));
        foreach ($response->json('publicaciones') as $publicacion) {
            $this->assertSame('Corolla', $publicacion['modelo']);
        }
    }

    // TC-19
    public function test_a_rejected_source_answers_200_with_the_failure_noted(): void
    {
        config([
            'services.mercadolibre.driver' => 'api',
            'services.mercadolibre.client_id' => 'id',
            'services.mercadolibre.client_secret' => 'secret',
        ]);
        Http::fake([
            '*/oauth/token' => Http::response(['access_token' => 't', 'expires_in' => 21600]),
            '*/sites/MLA/search*' => Http::response(['message' => 'forbidden'], 403),
        ]);

        $this->actingAs(User::factory()->create())->getJson(self::URL)
            ->assertOk()
            ->assertJsonPath('publicaciones', [])
            ->assertJsonPath('fuentes.0.clave', 'mercadolibre')
            ->assertJsonPath('fuentes.0.estado', 'sin_respuesta');
    }

    public function test_guests_are_rejected(): void
    {
        $this->getJson(self::URL)->assertUnauthorized();
    }

    public function test_q_longer_than_100_characters_is_rejected(): void
    {
        $this->actingAs(User::factory()->create())
            ->getJson(self::URL.'?q='.str_repeat('a', 101))
            ->assertUnprocessable()
            ->assertJsonValidationErrors('q');
    }
}
