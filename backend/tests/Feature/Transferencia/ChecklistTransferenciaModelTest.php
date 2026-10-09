<?php

namespace Tests\Feature\Transferencia;

use App\Models\ChecklistTransferencia;
use App\Models\EtapaTransferenciaCompletada;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

class ChecklistTransferenciaModelTest extends TestCase
{
    use RefreshDatabase;

    private function checklist(User $user): ChecklistTransferencia
    {
        return ChecklistTransferencia::create([
            'usuario_id' => $user->id,
            'estado' => ChecklistTransferencia::EN_CURSO,
            'actualizado_en' => now(),
        ]);
    }

    public function test_checklist_belongs_to_a_user_and_has_no_vehicle(): void
    {
        $user = User::factory()->create();

        $checklist = $this->checklist($user)->fresh();

        $this->assertTrue($checklist->usuario->is($user));
        $this->assertNull($checklist->vehiculo_id);
        $this->assertSame('en_curso', $checklist->estado);
        $this->assertInstanceOf(Carbon::class, $checklist->actualizado_en);
    }

    public function test_the_vehicle_cannot_be_mass_assigned(): void
    {
        $checklist = ChecklistTransferencia::create([
            'usuario_id' => User::factory()->create()->id,
            'vehiculo_id' => 99,
            'estado' => ChecklistTransferencia::EN_CURSO,
            'actualizado_en' => now(),
        ]);

        $this->assertNull($checklist->fresh()->vehiculo_id);
    }

    public function test_items_can_be_attached_and_removed(): void
    {
        $checklist = $this->checklist(User::factory()->create());

        $checklist->items()->create(['etapa_codigo' => 'documentacion_dni', 'completada_en' => now()]);
        $checklist->items()->create(['etapa_codigo' => 'antes_deudas', 'completada_en' => now()]);

        $items = $checklist->items()->get();
        $this->assertCount(2, $items);
        $this->assertEqualsCanonicalizing(['documentacion_dni', 'antes_deudas'], $items->pluck('etapa_codigo')->all());
        $this->assertInstanceOf(Carbon::class, $items->first()->completada_en);
        $this->assertSame($checklist->id, $items->first()->seguimiento_id);

        $checklist->items()->where('etapa_codigo', 'documentacion_dni')->delete();

        $this->assertSame(['antes_deudas'], $checklist->items()->pluck('etapa_codigo')->all());
        $this->assertDatabaseCount('etapa_transferencia_completada', 1);
    }

    public function test_an_attached_item_belongs_to_its_checklist_and_can_be_deleted_through_the_model(): void
    {
        $checklist = $this->checklist(User::factory()->create());
        $item = $checklist->items()->create(['etapa_codigo' => 'documentacion_dni', 'completada_en' => now()]);
        $other = $checklist->items()->create(['etapa_codigo' => 'antes_deudas', 'completada_en' => now()]);

        $this->assertInstanceOf(EtapaTransferenciaCompletada::class, $item);
        $this->assertTrue($item->checklist->is($checklist));

        EtapaTransferenciaCompletada::where('seguimiento_id', $checklist->id)->where('etapa_codigo', 'documentacion_dni')->delete();

        $this->assertSame([$other->etapa_codigo], $checklist->items()->pluck('etapa_codigo')->all());
    }

    public function test_the_same_item_cannot_be_attached_twice(): void
    {
        $checklist = $this->checklist(User::factory()->create());
        $checklist->items()->create(['etapa_codigo' => 'documentacion_dni', 'completada_en' => now()]);

        $this->expectException(QueryException::class);
        $checklist->items()->create(['etapa_codigo' => 'documentacion_dni', 'completada_en' => now()]);
    }

    public function test_a_second_checklist_for_the_same_user_is_rejected(): void
    {
        $user = User::factory()->create();
        $this->checklist($user);

        $this->expectException(QueryException::class);
        $this->checklist($user);
    }

    public function test_different_users_can_each_have_a_checklist(): void
    {
        $this->checklist(User::factory()->create());
        $this->checklist(User::factory()->create());

        $this->assertDatabaseCount('checklist_transferencia', 2);
    }
}
