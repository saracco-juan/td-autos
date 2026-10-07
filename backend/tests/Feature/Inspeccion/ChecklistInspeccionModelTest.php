<?php

namespace Tests\Feature\Inspeccion;

use App\Models\ChecklistInspeccion;
use App\Models\ItemInspeccionCompletado;
use App\Models\TipoCarroceria;
use App\Models\User;
use App\Models\Vehiculo;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

class ChecklistInspeccionModelTest extends TestCase
{
    use RefreshDatabase;

    private function checklist(User $user, Vehiculo $vehiculo): ChecklistInspeccion
    {
        return ChecklistInspeccion::create([
            'usuario_id' => $user->id,
            'vehiculo_id' => $vehiculo->id,
            'estado' => ChecklistInspeccion::EN_CURSO,
            'actualizado_en' => now(),
        ]);
    }

    public function test_vehicle_factory_creates_a_vehicle_with_a_body_type_relation(): void
    {
        $vehiculo = Vehiculo::factory()->create();

        $this->assertNotNull($vehiculo->marca);
        $this->assertSame('ARS', $vehiculo->moneda);
        $this->assertNull($vehiculo->tipoCarroceria);

        $tipo = TipoCarroceria::first();
        $vehiculo->update(['tipo_carroceria_id' => $tipo->id]);

        $this->assertTrue($vehiculo->fresh()->tipoCarroceria->is($tipo));
    }

    public function test_checklist_belongs_to_a_user_and_a_vehicle(): void
    {
        $user = User::factory()->create();
        $vehiculo = Vehiculo::factory()->create();

        $checklist = $this->checklist($user, $vehiculo)->fresh();

        $this->assertTrue($checklist->usuario->is($user));
        $this->assertTrue($checklist->vehiculo->is($vehiculo));
        $this->assertSame('en_curso', $checklist->estado);
        $this->assertInstanceOf(Carbon::class, $checklist->actualizado_en);
    }

    public function test_items_can_be_attached_and_removed(): void
    {
        $checklist = $this->checklist(User::factory()->create(), Vehiculo::factory()->create());

        $checklist->items()->create(['item_codigo' => 'papeles_vtv', 'completado_en' => now()]);
        $checklist->items()->create(['item_codigo' => 'papeles_titular', 'completado_en' => now()]);

        $items = $checklist->items()->get();
        $this->assertCount(2, $items);
        $this->assertEqualsCanonicalizing(['papeles_vtv', 'papeles_titular'], $items->pluck('item_codigo')->all());
        $this->assertInstanceOf(Carbon::class, $items->first()->completado_en);
        $this->assertSame($checklist->id, $items->first()->checklist_id);

        $checklist->items()->where('item_codigo', 'papeles_vtv')->delete();

        $this->assertSame(['papeles_titular'], $checklist->items()->pluck('item_codigo')->all());
        $this->assertDatabaseCount('item_inspeccion_completado', 1);
    }

    public function test_an_attached_item_can_be_deleted_through_the_model(): void
    {
        $checklist = $this->checklist(User::factory()->create(), Vehiculo::factory()->create());
        $item = $checklist->items()->create(['item_codigo' => 'papeles_vtv', 'completado_en' => now()]);
        $other = $checklist->items()->create(['item_codigo' => 'papeles_services', 'completado_en' => now()]);

        $this->assertInstanceOf(ItemInspeccionCompletado::class, $item);
        ItemInspeccionCompletado::where('checklist_id', $checklist->id)->where('item_codigo', 'papeles_vtv')->delete();

        $this->assertSame([$other->item_codigo], $checklist->items()->pluck('item_codigo')->all());
    }

    public function test_the_same_item_cannot_be_attached_twice(): void
    {
        $checklist = $this->checklist(User::factory()->create(), Vehiculo::factory()->create());
        $checklist->items()->create(['item_codigo' => 'papeles_vtv', 'completado_en' => now()]);

        $this->expectException(QueryException::class);
        $checklist->items()->create(['item_codigo' => 'papeles_vtv', 'completado_en' => now()]);
    }

    public function test_a_second_checklist_for_the_same_user_and_vehicle_is_rejected(): void
    {
        $user = User::factory()->create();
        $vehiculo = Vehiculo::factory()->create();
        $this->checklist($user, $vehiculo);

        $this->expectException(QueryException::class);
        $this->checklist($user, $vehiculo);
    }

    public function test_the_same_user_can_have_checklists_for_different_vehicles(): void
    {
        $user = User::factory()->create();
        $this->checklist($user, Vehiculo::factory()->create());
        $this->checklist($user, Vehiculo::factory()->create());

        $this->assertDatabaseCount('checklist_inspeccion', 2);
    }

    public function test_different_users_can_have_a_checklist_for_the_same_vehicle(): void
    {
        $vehiculo = Vehiculo::factory()->create();
        $this->checklist(User::factory()->create(), $vehiculo);
        $this->checklist(User::factory()->create(), $vehiculo);

        $this->assertDatabaseCount('checklist_inspeccion', 2);
    }
}
