<?php

namespace Tests\Feature\Concesionaria;

use App\Models\Concesionaria;
use App\Models\VehiculoConcesionaria;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DealerLeadBrandsTest extends TestCase
{
    use RefreshDatabase;

    public function test_brand_metadata_is_additive_and_keeps_the_dealers_counts_and_labels(): void
    {
        $dealer = Concesionaria::factory()->create();
        $mine = VehiculoConcesionaria::factory()->create(['concesionaria_id' => $dealer->id]);
        $mine->vehiculo->update(['marca' => 'Land Rover', 'modelo' => 'Discovery', 'version' => 'SE', 'anio' => 2021]);
        $other = VehiculoConcesionaria::factory()->create();
        $other->vehiculo->update(['marca' => 'Toyota']);

        $this->actingAs($dealer->usuario)->getJson('/api/concesionaria/leads?period=all')
            ->assertOk()->assertJsonPath('total', 0)->assertJsonCount(1, 'vehicles')
            ->assertJsonPath('vehicles.0.id', $mine->vehiculo_id)
            ->assertJsonPath('vehicles.0.brand', 'Land Rover')
            ->assertJsonPath('vehicles.0.label', 'Land Rover Discovery SE 2021')
            ->assertJsonPath('vehicles.0.leads', 0);
    }
}
