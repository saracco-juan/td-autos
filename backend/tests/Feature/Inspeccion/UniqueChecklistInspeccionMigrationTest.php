<?php

namespace Tests\Feature\Inspeccion;

use App\Models\User;
use App\Models\Vehiculo;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class UniqueChecklistInspeccionMigrationTest extends TestCase
{
    use RefreshDatabase;

    private Migration $migration;

    protected function setUp(): void
    {
        parent::setUp();

        $this->migration = require database_path('migrations/2026_10_07_000001_add_unique_user_vehicle_to_checklist_inspeccion.php');
        // Back to the state of a developer database where the index is still pending.
        $this->migration->down();
    }

    private function checklist(?int $userId, int $vehiculoId, string $estado, string $actualizadoEn): int
    {
        return DB::table('checklist_inspeccion')->insertGetId([
            'usuario_id' => $userId,
            'vehiculo_id' => $vehiculoId,
            'estado' => $estado,
            'actualizado_en' => $actualizadoEn,
        ]);
    }

    private function tick(int $checklistId, string $codigo, string $completadoEn): void
    {
        DB::table('item_inspeccion_completado')->insert([
            'checklist_id' => $checklistId,
            'item_codigo' => $codigo,
            'completado_en' => $completadoEn,
        ]);
    }

    private function codes(int $checklistId): array
    {
        return DB::table('item_inspeccion_completado')->where('checklist_id', $checklistId)->orderBy('item_codigo')->pluck('item_codigo')->all();
    }

    public function test_duplicates_collapse_to_the_lowest_id_with_the_union_of_ticked_items(): void
    {
        $user = User::factory()->create();
        $vehiculo = Vehiculo::factory()->create();
        $first = $this->checklist($user->id, $vehiculo->id, 'en_curso', '2026-10-01 10:00:00');
        $second = $this->checklist($user->id, $vehiculo->id, 'en_curso', '2026-10-01 11:00:00');
        $third = $this->checklist($user->id, $vehiculo->id, 'en_curso', '2026-10-01 12:00:00');
        $this->tick($first, 'papeles_vtv', '2026-10-01 10:00:00');
        $this->tick($second, 'papeles_titular', '2026-10-01 11:00:00');
        $this->tick($third, 'papeles_services', '2026-10-01 12:00:00');

        $this->migration->up();

        $this->assertSame([$first], DB::table('checklist_inspeccion')->pluck('id')->all());
        $this->assertSame(['papeles_services', 'papeles_titular', 'papeles_vtv'], $this->codes($first));
        $this->assertDatabaseCount('item_inspeccion_completado', 3);
    }

    public function test_a_code_ticked_in_several_duplicates_is_kept_once_with_the_earliest_timestamp(): void
    {
        $user = User::factory()->create();
        $vehiculo = Vehiculo::factory()->create();
        $first = $this->checklist($user->id, $vehiculo->id, 'en_curso', '2026-10-01 10:00:00');
        $second = $this->checklist($user->id, $vehiculo->id, 'en_curso', '2026-10-01 11:00:00');
        $third = $this->checklist($user->id, $vehiculo->id, 'en_curso', '2026-10-01 12:00:00');
        $this->tick($first, 'papeles_vtv', '2026-10-01 10:30:00');
        $this->tick($second, 'papeles_vtv', '2026-10-01 10:05:00');
        $this->tick($third, 'papeles_vtv', '2026-10-01 12:00:00');
        $this->tick($third, 'papeles_titular', '2026-10-01 12:10:00');
        $this->tick($second, 'papeles_titular', '2026-10-01 11:45:00');

        $this->migration->up();

        $items = DB::table('item_inspeccion_completado')->orderBy('item_codigo')->get();
        $this->assertCount(2, $items);
        $this->assertSame($first, $items[0]->checklist_id);
        $this->assertSame('papeles_titular', $items[0]->item_codigo);
        $this->assertStringStartsWith('2026-10-01 11:45:00', $items[0]->completado_en);
        $this->assertSame('papeles_vtv', $items[1]->item_codigo);
        $this->assertStringStartsWith('2026-10-01 10:05:00', $items[1]->completado_en);
    }

    public function test_the_kept_checklist_takes_the_state_of_the_most_recently_updated_duplicate(): void
    {
        $user = User::factory()->create();
        $vehiculo = Vehiculo::factory()->create();
        $first = $this->checklist($user->id, $vehiculo->id, 'en_curso', '2026-10-01 10:00:00');
        $this->checklist($user->id, $vehiculo->id, 'completa', '2026-10-01 13:00:00');
        $this->checklist($user->id, $vehiculo->id, 'incompleta', '2026-10-01 12:00:00');

        $this->migration->up();

        $kept = DB::table('checklist_inspeccion')->first();
        $this->assertSame($first, $kept->id);
        $this->assertSame('completa', $kept->estado);
        $this->assertStringStartsWith('2026-10-01 13:00:00', $kept->actualizado_en);
    }

    public function test_a_tie_on_the_update_time_is_broken_by_the_highest_id(): void
    {
        $user = User::factory()->create();
        $vehiculo = Vehiculo::factory()->create();
        $this->checklist($user->id, $vehiculo->id, 'en_curso', '2026-10-01 10:00:00');
        $this->checklist($user->id, $vehiculo->id, 'incompleta', '2026-10-01 12:00:00');
        $this->checklist($user->id, $vehiculo->id, 'completa', '2026-10-01 12:00:00');

        $this->migration->up();

        $this->assertSame('completa', DB::table('checklist_inspeccion')->value('estado'));
    }

    public function test_checklists_of_other_keys_and_null_users_are_untouched(): void
    {
        $user = User::factory()->create();
        $other = User::factory()->create();
        $vehiculo = Vehiculo::factory()->create();
        $anotherVehiculo = Vehiculo::factory()->create();
        $this->checklist($user->id, $vehiculo->id, 'en_curso', '2026-10-01 10:00:00');
        $this->checklist($user->id, $vehiculo->id, 'en_curso', '2026-10-01 11:00:00');
        $sameUserOtherVehicle = $this->checklist($user->id, $anotherVehiculo->id, 'incompleta', '2026-10-01 09:00:00');
        $otherUser = $this->checklist($other->id, $vehiculo->id, 'completa', '2026-10-01 08:00:00');
        $this->tick($sameUserOtherVehicle, 'papeles_vtv', '2026-10-01 09:00:00');
        $this->tick($otherUser, 'papeles_titular', '2026-10-01 08:00:00');
        $nullA = $this->checklist(null, $vehiculo->id, 'en_curso', '2026-10-01 07:00:00');
        $nullB = $this->checklist(null, $vehiculo->id, 'en_curso', '2026-10-01 07:30:00');

        $this->migration->up();

        $this->assertDatabaseCount('checklist_inspeccion', 5);
        $this->assertDatabaseHas('checklist_inspeccion', ['id' => $sameUserOtherVehicle, 'estado' => 'incompleta']);
        $this->assertDatabaseHas('checklist_inspeccion', ['id' => $otherUser, 'estado' => 'completa']);
        $this->assertDatabaseHas('checklist_inspeccion', ['id' => $nullA]);
        $this->assertDatabaseHas('checklist_inspeccion', ['id' => $nullB]);
        $this->assertSame(['papeles_vtv'], $this->codes($sameUserOtherVehicle));
        $this->assertSame(['papeles_titular'], $this->codes($otherUser));
    }

    public function test_a_database_without_duplicates_is_unchanged(): void
    {
        $user = User::factory()->create();
        $vehiculo = Vehiculo::factory()->create();
        $id = $this->checklist($user->id, $vehiculo->id, 'incompleta', '2026-10-01 10:00:00');
        $this->tick($id, 'papeles_vtv', '2026-10-01 10:00:00');

        $this->migration->up();

        $this->assertDatabaseCount('checklist_inspeccion', 1);
        $this->assertDatabaseHas('checklist_inspeccion', ['id' => $id, 'estado' => 'incompleta']);
        $this->assertSame(['papeles_vtv'], $this->codes($id));
    }

    public function test_a_second_checklist_for_the_same_key_is_rejected_after_up(): void
    {
        $user = User::factory()->create();
        $vehiculo = Vehiculo::factory()->create();
        $this->checklist($user->id, $vehiculo->id, 'en_curso', '2026-10-01 10:00:00');
        $this->checklist($user->id, $vehiculo->id, 'en_curso', '2026-10-01 11:00:00');

        $this->migration->up();

        $this->expectException(QueryException::class);
        $this->checklist($user->id, $vehiculo->id, 'en_curso', '2026-10-01 12:00:00');
    }
}
