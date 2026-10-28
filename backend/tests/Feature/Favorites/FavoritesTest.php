<?php

namespace Tests\Feature\Favorites;

use App\Models\Concesionaria;
use App\Models\Suscripcion;
use App\Models\User;
use App\Models\Vehiculo;
use App\Models\VehiculoConcesionaria;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class FavoritesTest extends TestCase
{
    use RefreshDatabase;

    private function listing(): Vehiculo
    {
        $dealer = Concesionaria::factory()->active()->create();
        Suscripcion::factory()->create(['concesionaria_id' => $dealer->id,
            'estado' => 'activa', 'vigente_hasta' => now()->addMonth()->toDateString()]);
        $vehicle = Vehiculo::factory()->create();
        VehiculoConcesionaria::factory()->create(['vehiculo_id' => $vehicle->id, 'concesionaria_id' => $dealer->id]);

        return $vehicle;
    }

    // HU11 / RF10 / TC-31: repeated saves preserve a single persistent favorite.
    public function test_buyer_saves_once_and_reads_current_public_facts(): void
    {
        Http::preventStrayRequests();
        $buyer = User::factory()->create(['rol' => User::ROL_COMPRADOR]);
        $vehicle = $this->listing();
        $vehicle->fotos()->create(['ubicacion_archivo' => 'https://example.test/car.jpg', 'orden' => 1]);
        $this->actingAs($buyer)->putJson("/api/favoritos/{$vehicle->id}")->assertNoContent();
        $savedAt = DB::table('favorito')->value('fecha_guardado');
        $this->travel(1)->hours();
        $this->putJson("/api/favoritos/{$vehicle->id}")->assertNoContent();
        $this->assertDatabaseCount('favorito', 1);
        $this->assertDatabaseHas('favorito', ['usuario_id' => $buyer->id, 'vehiculo_id' => $vehicle->id, 'fecha_guardado' => $savedAt]);
        $vehicle->update(['precio' => 123456]);
        $this->getJson('/api/favoritos')->assertOk()->assertHeader('Cache-Control', 'no-store, private')
            ->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $vehicle->id)
            ->assertJsonPath('data.0.precio', 123456)->assertJsonPath('data.0.image_url', 'https://example.test/car.jpg')
            ->assertJsonMissingPath('data.0.patente')->assertJsonMissingPath('data.0.propiedad');
        Http::assertNothingSent();
    }

    // TC-32: removal is scoped to the session owner and can safely be repeated.
    public function test_buyers_cannot_read_or_remove_another_buyers_favorite(): void
    {
        $owner = User::factory()->create(['rol' => User::ROL_COMPRADOR]);
        $other = User::factory()->create(['rol' => User::ROL_COMPRADOR]);
        $vehicle = $this->listing();
        $this->actingAs($owner)->putJson("/api/favoritos/{$vehicle->id}")->assertNoContent();
        $this->actingAs($other)->getJson('/api/favoritos')->assertJsonPath('meta.total', 0);
        $this->deleteJson("/api/favoritos/{$vehicle->id}")->assertNoContent();
        $this->assertDatabaseHas('favorito', ['usuario_id' => $owner->id, 'vehiculo_id' => $vehicle->id]);
        $this->actingAs($owner)->deleteJson("/api/favoritos/{$vehicle->id}")->assertNoContent();
        $this->deleteJson("/api/favoritos/{$vehicle->id}")->assertNoContent();
        $this->assertDatabaseCount('favorito', 0);
    }

    // TC-34 (favorites only): no diagnosis is needed to view an empty list.
    public function test_empty_list_and_paginated_status_lookup(): void
    {
        $this->actingAs(User::factory()->create(['rol' => User::ROL_COMPRADOR]));
        $this->getJson('/api/favoritos')->assertOk()->assertJsonPath('data', [])->assertJsonPath('meta.total', 0);
        $first = $this->listing();
        $second = $this->listing();
        $this->putJson("/api/favoritos/{$first->id}")->assertNoContent();
        $this->travel(1)->seconds();
        $this->putJson("/api/favoritos/{$second->id}")->assertNoContent();
        $this->getJson('/api/favoritos?per_page=1')->assertJsonPath('data.0.id', $second->id)
            ->assertJsonPath('meta.total', 2)->assertJsonPath('meta.last_page', 2);
        $this->getJson('/api/favoritos?per_page=1&page=2')->assertJsonPath('data.0.id', $first->id);
        $this->getJson("/api/favoritos?ids[]={$first->id}")->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $first->id);
        foreach (['per_page=0', 'per_page=61', 'page=0', 'ids[]=abc'] as $query) {
            $this->getJson("/api/favoritos?$query")->assertUnprocessable();
        }
    }

    public function test_only_available_dealer_listings_can_be_saved_or_shown(): void
    {
        $this->actingAs(User::factory()->create(['rol' => User::ROL_COMPRADOR]));
        $vehicle = $this->listing();
        $this->putJson("/api/favoritos/{$vehicle->id}")->assertNoContent();
        $vehicle->propiedad->update(['visible' => false]);
        $this->getJson('/api/favoritos')->assertJsonPath('data', []);
        $this->putJson("/api/favoritos/{$vehicle->id}")->assertNotFound();
        $this->deleteJson("/api/favoritos/{$vehicle->id}")->assertNoContent();
        $this->assertDatabaseCount('favorito', 0);
        $vehicle->propiedad->update(['visible' => true]);
        $vehicle->update(['origen' => 'externo']);
        $this->putJson("/api/favoritos/{$vehicle->id}")->assertNotFound();
        $vehicle->update(['origen' => 'concesionaria']);
        $vehicle->propiedad->concesionaria->forceFill(['estado_alta' => Concesionaria::ESTADO_PENDIENTE])->save();
        $this->putJson("/api/favoritos/{$vehicle->id}")->assertNotFound();
        $this->putJson('/api/favoritos/999999')->assertNotFound();
        $this->assertDatabaseCount('favorito', 0);
    }

    public function test_request_owner_spoofing_cannot_change_or_disclose_other_favorites(): void
    {
        $owner = User::factory()->create(['rol' => User::ROL_COMPRADOR]);
        $other = User::factory()->create(['rol' => User::ROL_COMPRADOR]);
        $vehicle = $this->listing();
        $this->actingAs($owner)->putJson("/api/favoritos/{$vehicle->id}")->assertNoContent();
        $before = DB::table('favorito')->get()->toArray();
        $this->actingAs($other)->getJson('/api/favoritos?usuario_id='.$owner->id.'&ids[]='.$vehicle->id)
            ->assertOk()->assertJsonPath('data', [])->assertJsonPath('meta.total', 0);
        $this->deleteJson("/api/favoritos/{$vehicle->id}?usuario_id={$owner->id}")->assertNoContent();
        $this->assertEquals($before, DB::table('favorito')->get()->toArray());
        $this->putJson("/api/favoritos/{$vehicle->id}", ['usuario_id' => $owner->id])->assertNoContent();
        $this->assertDatabaseHas('favorito', ['usuario_id' => $owner->id, 'vehiculo_id' => $vehicle->id]);
        $this->assertDatabaseHas('favorito', ['usuario_id' => $other->id, 'vehiculo_id' => $vehicle->id]);
        $this->assertDatabaseCount('favorito', 2);
    }

    public function test_rejected_input_preserves_data_and_response_exposes_only_public_listing_fields(): void
    {
        $buyer = User::factory()->create(['rol' => User::ROL_COMPRADOR]);
        $vehicle = $this->listing();
        $this->actingAs($buyer)->putJson("/api/favoritos/{$vehicle->id}")->assertNoContent();
        $before = DB::table('favorito')->get()->toArray();
        foreach (['page=0', 'per_page=61', 'ids[]=abc', 'ids[]=-1'] as $bad) {
            $this->getJson('/api/favoritos?'.$bad)->assertUnprocessable();
            $this->assertEquals($before, DB::table('favorito')->get()->toArray());
        }
        $response = $this->getJson('/api/favoritos?per_page=60')->assertOk()
            ->assertJsonPath('meta.per_page', 60)->assertJsonPath('meta.total', 1);
        $this->assertSame([
            'id', 'marca', 'modelo', 'version', 'anio', 'precio', 'moneda',
            'kilometraje', 'transmision', 'combustible', 'ubicacion', 'image_url',
        ], array_keys($response->json('data.0')));
        $vehicle->propiedad->update(['visible' => false]);
        $this->getJson('/api/favoritos')->assertOk()->assertJsonPath('data', []);
        $this->assertEquals($before, DB::table('favorito')->get()->toArray());
    }

    public function test_guests_and_non_buyers_cannot_access_favorites(): void
    {
        foreach (['get', 'put', 'delete'] as $method) {
            $url = $method === 'get' ? '/api/favoritos' : '/api/favoritos/1';
            $this->{$method.'Json'}($url)->assertUnauthorized();
        }
        foreach ([User::ROL_CONCESIONARIA, User::ROL_ADMINISTRADOR] as $role) {
            $this->actingAs(User::factory()->create(['rol' => $role]));
            $this->getJson('/api/favoritos')->assertForbidden();
            $this->putJson('/api/favoritos/1')->assertForbidden();
            $this->deleteJson('/api/favoritos/1')->assertForbidden();
        }
        $this->assertDatabaseCount('favorito', 0);
    }
}
