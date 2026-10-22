<?php

namespace Tests\Feature\Transferencia;

use App\Models\User;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class UniqueChecklistTransferenciaMigrationTest extends TestCase
{
    use RefreshDatabase;

    private Migration $migration;

    protected function setUp(): void
    {
        parent::setUp();

        $this->migration = require database_path('migrations/2026_10_08_000001_add_unique_user_to_checklist_transferencia.php');
        // Back to the state of a developer database where the index is still pending.
        $this->migration->down();
    }

    private function checklist(?int $userId, string $estado, string $actualizadoEn): int
    {
        return DB::table('checklist_transferencia')->insertGetId([
            'usuario_id' => $userId,
            'estado' => $estado,
            'actualizado_en' => $actualizadoEn,
        ]);
    }

    private function tick(int $checklistId, string $codigo, string $completadaEn): void
    {
        DB::table('etapa_transferencia_completada')->insert([
            'seguimiento_id' => $checklistId,
            'etapa_codigo' => $codigo,
            'completada_en' => $completadaEn,
        ]);
    }

    private function codes(int $checklistId): array
    {
        return DB::table('etapa_transferencia_completada')->where('seguimiento_id', $checklistId)->orderBy('etapa_codigo')->pluck('etapa_codigo')->all();
    }

    public function test_duplicates_collapse_to_the_lowest_id_with_the_union_of_ticked_stages(): void
    {
        $user = User::factory()->create();
        $first = $this->checklist($user->id, 'en_curso', '2026-10-01 10:00:00');
        $second = $this->checklist($user->id, 'en_curso', '2026-10-01 11:00:00');
        $third = $this->checklist($user->id, 'en_curso', '2026-10-01 12:00:00');
        $this->tick($first, 'etapa_a', '2026-10-01 10:00:00');
        $this->tick($second, 'etapa_b', '2026-10-01 11:00:00');
        $this->tick($third, 'etapa_c', '2026-10-01 12:00:00');

        $this->migration->up();

        $this->assertSame([$first], DB::table('checklist_transferencia')->pluck('id')->all());
        $this->assertSame(['etapa_a', 'etapa_b', 'etapa_c'], $this->codes($first));
        $this->assertDatabaseCount('etapa_transferencia_completada', 3);
    }

    public function test_a_code_ticked_in_several_duplicates_is_kept_once_with_the_earliest_timestamp(): void
    {
        $user = User::factory()->create();
        $first = $this->checklist($user->id, 'en_curso', '2026-10-01 10:00:00');
        $second = $this->checklist($user->id, 'en_curso', '2026-10-01 11:00:00');
        $third = $this->checklist($user->id, 'en_curso', '2026-10-01 12:00:00');
        $this->tick($first, 'etapa_a', '2026-10-01 10:30:00');
        $this->tick($second, 'etapa_a', '2026-10-01 10:05:00');
        $this->tick($third, 'etapa_a', '2026-10-01 12:00:00');
        $this->tick($third, 'etapa_b', '2026-10-01 12:10:00');
        $this->tick($second, 'etapa_b', '2026-10-01 11:45:00');

        $this->migration->up();

        $items = DB::table('etapa_transferencia_completada')->orderBy('etapa_codigo')->get();
        $this->assertCount(2, $items);
        $this->assertSame($first, $items[0]->seguimiento_id);
        $this->assertSame('etapa_a', $items[0]->etapa_codigo);
        $this->assertStringStartsWith('2026-10-01 10:05:00', $items[0]->completada_en);
        $this->assertSame('etapa_b', $items[1]->etapa_codigo);
        $this->assertStringStartsWith('2026-10-01 11:45:00', $items[1]->completada_en);
    }

    public function test_the_kept_checklist_takes_the_state_of_the_most_recently_updated_duplicate(): void
    {
        $user = User::factory()->create();
        $first = $this->checklist($user->id, 'en_curso', '2026-10-01 10:00:00');
        $this->checklist($user->id, 'completa', '2026-10-01 13:00:00');
        $this->checklist($user->id, 'incompleta', '2026-10-01 12:00:00');

        $this->migration->up();

        $kept = DB::table('checklist_transferencia')->first();
        $this->assertSame($first, $kept->id);
        $this->assertSame('completa', $kept->estado);
        $this->assertStringStartsWith('2026-10-01 13:00:00', $kept->actualizado_en);
    }

    public function test_a_tie_on_the_update_time_is_broken_by_the_highest_id(): void
    {
        $user = User::factory()->create();
        $this->checklist($user->id, 'en_curso', '2026-10-01 10:00:00');
        $this->checklist($user->id, 'incompleta', '2026-10-01 12:00:00');
        $this->checklist($user->id, 'completa', '2026-10-01 12:00:00');

        $this->migration->up();

        $this->assertSame('completa', DB::table('checklist_transferencia')->value('estado'));
    }

    public function test_checklists_of_other_users_and_null_users_are_untouched(): void
    {
        $user = User::factory()->create();
        $other = User::factory()->create();
        $this->checklist($user->id, 'en_curso', '2026-10-01 10:00:00');
        $this->checklist($user->id, 'en_curso', '2026-10-01 11:00:00');
        $otherUser = $this->checklist($other->id, 'completa', '2026-10-01 08:00:00');
        $this->tick($otherUser, 'etapa_a', '2026-10-01 08:00:00');
        $nullA = $this->checklist(null, 'en_curso', '2026-10-01 07:00:00');
        $nullB = $this->checklist(null, 'en_curso', '2026-10-01 07:30:00');

        $this->migration->up();

        $this->assertDatabaseCount('checklist_transferencia', 4);
        $this->assertDatabaseHas('checklist_transferencia', ['id' => $otherUser, 'estado' => 'completa']);
        $this->assertDatabaseHas('checklist_transferencia', ['id' => $nullA]);
        $this->assertDatabaseHas('checklist_transferencia', ['id' => $nullB]);
        $this->assertSame(['etapa_a'], $this->codes($otherUser));
    }

    public function test_a_database_without_duplicates_is_unchanged(): void
    {
        $user = User::factory()->create();
        $id = $this->checklist($user->id, 'incompleta', '2026-10-01 10:00:00');
        $this->tick($id, 'etapa_a', '2026-10-01 10:00:00');

        $this->migration->up();

        $this->assertDatabaseCount('checklist_transferencia', 1);
        $this->assertDatabaseHas('checklist_transferencia', ['id' => $id, 'estado' => 'incompleta']);
        $this->assertSame(['etapa_a'], $this->codes($id));
    }

    public function test_a_second_checklist_for_the_same_user_is_rejected_after_up(): void
    {
        $user = User::factory()->create();
        $this->checklist($user->id, 'en_curso', '2026-10-01 10:00:00');
        $this->checklist($user->id, 'en_curso', '2026-10-01 11:00:00');

        $this->migration->up();

        $this->expectException(QueryException::class);
        $this->checklist($user->id, 'en_curso', '2026-10-01 12:00:00');
    }
}
