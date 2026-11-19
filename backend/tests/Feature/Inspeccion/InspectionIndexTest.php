<?php

namespace Tests\Feature\Inspeccion;

use App\Models\ChecklistInspeccion;
use App\Models\User;
use App\Models\Vehiculo;
use App\Support\InspeccionChecklist;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class InspectionIndexTest extends TestCase
{
    use RefreshDatabase;

    public function test_guests_cannot_list_inspections(): void
    {
        $this->getJson('/api/inspecciones')->assertUnauthorized();
    }

    public function test_listing_an_empty_account_does_not_create_progress(): void
    {
        $this->actingAs(User::factory()->create())->getJson('/api/inspecciones')
            ->assertOk()
            ->assertJsonPath('inspecciones', [])
            ->assertJsonPath('pasos', InspeccionChecklist::steps());

        $this->assertDatabaseCount('checklist_inspeccion', 0);
    }

    public function test_lists_only_own_inspections_in_recent_order_without_mutation(): void
    {
        $user = User::factory()->create();
        $other = User::factory()->create();
        $vehicle = Vehiculo::factory()->create();
        $recent = Vehiculo::factory()->create();
        foreach ([[$user, $vehicle], [$other, $vehicle], [$user, $recent]] as [$owner, $car]) {
            $this->actingAs($owner)->putJson("/api/vehiculos/{$car->id}/inspeccion/items/papeles_vtv", ['completado' => true])->assertOk();
        }
        ChecklistInspeccion::where('usuario_id', $user->id)->where('vehiculo_id', $vehicle->id)
            ->update(['actualizado_en' => now()->subDay()]);
        $before = ChecklistInspeccion::orderBy('id')->get()->toArray();

        $this->actingAs($user)->getJson('/api/inspecciones')->assertOk()
            ->assertJsonCount(2, 'inspecciones')
            ->assertJsonPath('inspecciones.0.vehiculo.id', $recent->id)
            ->assertJsonPath('inspecciones.1.vehiculo.id', $vehicle->id)
            ->assertJsonPath('inspecciones.0.items_completados', ['papeles_vtv']);

        $this->assertSame($before, ChecklistInspeccion::orderBy('id')->get()->toArray());
        $this->assertDatabaseCount('item_inspeccion_completado', 3);
    }
}
