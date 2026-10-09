<?php

namespace Tests\Feature\Inspeccion;

use App\Models\ChecklistInspeccion;
use App\Models\ItemInspeccionCompletado;
use App\Models\User;
use App\Models\Vehiculo;
use App\Support\InspeccionChecklist;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class InspeccionTest extends TestCase
{
    use RefreshDatabase;

    private function vehiculo(): Vehiculo
    {
        return Vehiculo::factory()->create([
            'marca' => 'Toyota',
            'modelo' => 'Corolla',
            'version' => 'XEI',
            'anio' => 2021,
        ]);
    }

    private function tick(User $user, Vehiculo $vehiculo, string $codigo, bool $completado = true): void
    {
        $this->actingAs($user)
            ->putJson("/api/vehiculos/{$vehiculo->id}/inspeccion/items/$codigo", ['completado' => $completado])
            ->assertOk();
    }

    // TC-35 (scenario 1)
    public function test_ticking_every_item_and_finishing_completes_the_checklist(): void
    {
        $user = User::factory()->create();
        $vehiculo = $this->vehiculo();

        foreach (InspeccionChecklist::codes() as $codigo) {
            $this->tick($user, $vehiculo, $codigo);
        }

        $this->actingAs($user)->postJson("/api/vehiculos/{$vehiculo->id}/inspeccion/finalizar")
            ->assertOk()
            ->assertExactJson([
                'estado' => 'completa',
                'items_completados' => InspeccionChecklist::codes(),
            ]);

        $this->assertDatabaseHas('checklist_inspeccion', [
            'usuario_id' => $user->id,
            'vehiculo_id' => $vehiculo->id,
            'estado' => 'completa',
        ]);
        $this->assertSame(28, ItemInspeccionCompletado::count());
    }

    // TC-36 (scenario 2)
    public function test_ticked_items_are_kept_when_the_user_comes_back(): void
    {
        $user = User::factory()->create();
        $vehiculo = $this->vehiculo();
        $this->tick($user, $vehiculo, 'motor_aceite');
        $this->tick($user, $vehiculo, 'papeles_vtv');

        $this->actingAs($user)->getJson("/api/vehiculos/{$vehiculo->id}/inspeccion")
            ->assertOk()
            ->assertJsonPath('estado', 'en_curso')
            ->assertJsonPath('items_completados', ['papeles_vtv', 'motor_aceite']);
    }

    // Scenario 3
    public function test_finishing_with_unticked_items_keeps_the_checklist_incomplete(): void
    {
        $user = User::factory()->create();
        $vehiculo = $this->vehiculo();
        $this->tick($user, $vehiculo, 'papeles_vtv');
        $this->tick($user, $vehiculo, 'manejo_frenos');

        $this->actingAs($user)->postJson("/api/vehiculos/{$vehiculo->id}/inspeccion/finalizar")
            ->assertOk()
            ->assertExactJson([
                'estado' => 'incompleta',
                'items_completados' => ['papeles_vtv', 'manejo_frenos'],
            ]);

        $this->assertDatabaseHas('checklist_inspeccion', [
            'usuario_id' => $user->id,
            'vehiculo_id' => $vehiculo->id,
            'estado' => 'incompleta',
        ]);
        $this->actingAs($user)->getJson("/api/vehiculos/{$vehiculo->id}/inspeccion")
            ->assertJsonPath('estado', 'incompleta');
    }

    // TC-37 (scenario 4), data support: the warning itself is shown by the frontend.
    public function test_finishing_with_a_critical_item_unticked_reports_it_as_pending(): void
    {
        $user = User::factory()->create();
        $vehiculo = $this->vehiculo();
        $criticalCodes = InspeccionChecklist::criticalCodes();

        foreach (InspeccionChecklist::codes() as $codigo) {
            if ($codigo !== 'motor_perdidas') {
                $this->tick($user, $vehiculo, $codigo);
            }
        }

        $response = $this->actingAs($user)->postJson("/api/vehiculos/{$vehiculo->id}/inspeccion/finalizar")
            ->assertOk()
            ->assertJsonPath('estado', 'incompleta')
            ->assertJsonCount(27, 'items_completados');

        $this->assertContains('motor_perdidas', $criticalCodes);
        $this->assertNotContains('motor_perdidas', $response->json('items_completados'));
    }

    public function test_reading_without_a_checklist_returns_the_catalog_and_creates_nothing(): void
    {
        $user = User::factory()->create();
        $vehiculo = $this->vehiculo();

        $response = $this->actingAs($user)->getJson("/api/vehiculos/{$vehiculo->id}/inspeccion")
            ->assertOk()
            ->assertJsonPath('vehiculo', [
                'id' => $vehiculo->id,
                'marca' => 'Toyota',
                'modelo' => 'Corolla',
                'version' => 'XEI',
                'anio' => 2021,
            ])
            ->assertJsonPath('estado', null)
            ->assertJsonPath('items_completados', [])
            ->assertJsonCount(5, 'pasos');

        $this->assertSame(InspeccionChecklist::steps(), $response->json('pasos'));
        $this->assertDatabaseCount('checklist_inspeccion', 0);
        $this->assertDatabaseCount('item_inspeccion_completado', 0);
    }

    public function test_completed_items_come_back_in_catalog_order(): void
    {
        $user = User::factory()->create();
        $vehiculo = $this->vehiculo();
        $this->tick($user, $vehiculo, 'manejo_ruidos');
        $this->tick($user, $vehiculo, 'papeles_titular');
        $this->tick($user, $vehiculo, 'motor_arranque');

        $this->actingAs($user)->getJson("/api/vehiculos/{$vehiculo->id}/inspeccion")
            ->assertJsonPath('items_completados', ['papeles_titular', 'motor_arranque', 'manejo_ruidos']);
    }

    public function test_first_tick_creates_the_checklist_in_progress(): void
    {
        $user = User::factory()->create();
        $vehiculo = $this->vehiculo();

        $this->actingAs($user)->putJson("/api/vehiculos/{$vehiculo->id}/inspeccion/items/papeles_vtv", ['completado' => true])
            ->assertOk()
            ->assertExactJson(['estado' => 'en_curso', 'items_completados' => ['papeles_vtv']]);

        $checklist = ChecklistInspeccion::where('usuario_id', $user->id)->firstOrFail();
        $this->assertSame($vehiculo->id, $checklist->vehiculo_id);
        $this->assertNotNull($checklist->actualizado_en);
        $this->assertNotNull(ItemInspeccionCompletado::firstOrFail()->completado_en);
    }

    public function test_ticking_twice_keeps_a_single_row(): void
    {
        $user = User::factory()->create();
        $vehiculo = $this->vehiculo();

        $this->tick($user, $vehiculo, 'papeles_vtv');
        $this->tick($user, $vehiculo, 'papeles_vtv');

        $this->assertDatabaseCount('checklist_inspeccion', 1);
        $this->assertDatabaseCount('item_inspeccion_completado', 1);
    }

    public function test_unticking_removes_the_item(): void
    {
        $user = User::factory()->create();
        $vehiculo = $this->vehiculo();
        $this->tick($user, $vehiculo, 'papeles_vtv');
        $this->tick($user, $vehiculo, 'motor_aceite');

        $this->actingAs($user)->putJson("/api/vehiculos/{$vehiculo->id}/inspeccion/items/papeles_vtv", ['completado' => false])
            ->assertOk()
            ->assertExactJson(['estado' => 'en_curso', 'items_completados' => ['motor_aceite']]);

        $this->assertDatabaseCount('item_inspeccion_completado', 1);
    }

    public function test_unticking_an_item_that_is_not_ticked_is_fine(): void
    {
        $user = User::factory()->create();
        $vehiculo = $this->vehiculo();
        $this->tick($user, $vehiculo, 'motor_aceite');

        $this->actingAs($user)->putJson("/api/vehiculos/{$vehiculo->id}/inspeccion/items/papeles_vtv", ['completado' => false])
            ->assertOk()
            ->assertExactJson(['estado' => 'en_curso', 'items_completados' => ['motor_aceite']]);
    }

    public function test_unticking_without_a_checklist_creates_nothing(): void
    {
        $user = User::factory()->create();
        $vehiculo = $this->vehiculo();

        $this->actingAs($user)->putJson("/api/vehiculos/{$vehiculo->id}/inspeccion/items/papeles_vtv", ['completado' => false])
            ->assertOk()
            ->assertExactJson(['estado' => null, 'items_completados' => []]);

        $this->assertDatabaseCount('checklist_inspeccion', 0);
    }

    public function test_ticking_after_finishing_puts_the_checklist_back_in_progress(): void
    {
        $user = User::factory()->create();
        $vehiculo = $this->vehiculo();
        $this->tick($user, $vehiculo, 'papeles_vtv');
        $this->actingAs($user)->postJson("/api/vehiculos/{$vehiculo->id}/inspeccion/finalizar")
            ->assertJsonPath('estado', 'incompleta');

        $this->tick($user, $vehiculo, 'motor_aceite');

        $this->actingAs($user)->getJson("/api/vehiculos/{$vehiculo->id}/inspeccion")
            ->assertJsonPath('estado', 'en_curso');
    }

    public function test_unticking_after_finishing_puts_the_checklist_back_in_progress(): void
    {
        $user = User::factory()->create();
        $vehiculo = $this->vehiculo();
        $this->tick($user, $vehiculo, 'papeles_vtv');
        $this->actingAs($user)->postJson("/api/vehiculos/{$vehiculo->id}/inspeccion/finalizar")->assertOk();

        $this->tick($user, $vehiculo, 'papeles_vtv', false);

        $this->actingAs($user)->getJson("/api/vehiculos/{$vehiculo->id}/inspeccion")
            ->assertJsonPath('estado', 'en_curso')
            ->assertJsonPath('items_completados', []);
    }

    public function test_changing_an_item_updates_actualizado_en(): void
    {
        $user = User::factory()->create();
        $vehiculo = $this->vehiculo();
        $this->tick($user, $vehiculo, 'papeles_vtv');
        DB::table('checklist_inspeccion')->update(['actualizado_en' => '2026-01-01 10:00:00']);

        $this->tick($user, $vehiculo, 'motor_aceite');

        $this->assertNotSame('2026-01-01 10:00:00', DB::table('checklist_inspeccion')->value('actualizado_en'));
    }

    public function test_finishing_without_a_checklist_stores_it_as_incomplete(): void
    {
        $user = User::factory()->create();
        $vehiculo = $this->vehiculo();

        $this->actingAs($user)->postJson("/api/vehiculos/{$vehiculo->id}/inspeccion/finalizar")
            ->assertOk()
            ->assertExactJson(['estado' => 'incompleta', 'items_completados' => []]);

        $this->assertDatabaseHas('checklist_inspeccion', [
            'usuario_id' => $user->id,
            'vehiculo_id' => $vehiculo->id,
            'estado' => 'incompleta',
        ]);
    }

    public function test_finishing_twice_keeps_a_single_checklist(): void
    {
        $user = User::factory()->create();
        $vehiculo = $this->vehiculo();

        $this->actingAs($user)->postJson("/api/vehiculos/{$vehiculo->id}/inspeccion/finalizar")->assertOk();
        $this->actingAs($user)->postJson("/api/vehiculos/{$vehiculo->id}/inspeccion/finalizar")->assertOk();

        $this->assertDatabaseCount('checklist_inspeccion', 1);
    }

    public function test_unknown_item_code_is_rejected_and_nothing_is_saved(): void
    {
        $user = User::factory()->create();
        $vehiculo = $this->vehiculo();

        $this->actingAs($user)->putJson("/api/vehiculos/{$vehiculo->id}/inspeccion/items/no_existe", ['completado' => true])
            ->assertUnprocessable()
            ->assertJsonPath('errors.codigo.0', 'El punto de la inspección no existe.');

        $this->assertDatabaseCount('checklist_inspeccion', 0);
        $this->assertDatabaseCount('item_inspeccion_completado', 0);
    }

    /**
     * @return array<string, array{0: array<string, mixed>}>
     */
    public static function invalidBodies(): array
    {
        return [
            'missing' => [[]],
            'string' => [['completado' => 'si']],
            'array' => [['completado' => [true]]],
            'null' => [['completado' => null]],
        ];
    }

    /**
     * @param  array<string, mixed>  $body
     */
    #[DataProvider('invalidBodies')]
    public function test_invalid_completado_is_rejected_and_nothing_is_saved(array $body): void
    {
        $user = User::factory()->create();
        $vehiculo = $this->vehiculo();

        $this->actingAs($user)->putJson("/api/vehiculos/{$vehiculo->id}/inspeccion/items/papeles_vtv", $body)
            ->assertUnprocessable()
            ->assertJsonPath('errors.completado.0', 'Indicá si el punto está revisado o no.');

        $this->assertDatabaseCount('checklist_inspeccion', 0);
    }

    public function test_unknown_vehicle_is_not_found(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)->getJson('/api/vehiculos/9999/inspeccion')->assertNotFound();
        $this->actingAs($user)->putJson('/api/vehiculos/9999/inspeccion/items/papeles_vtv', ['completado' => true])->assertNotFound();
        $this->actingAs($user)->postJson('/api/vehiculos/9999/inspeccion/finalizar')->assertNotFound();
    }

    public function test_guest_is_unauthorized(): void
    {
        $vehiculo = $this->vehiculo();

        $this->getJson("/api/vehiculos/{$vehiculo->id}/inspeccion")->assertUnauthorized();
        $this->putJson("/api/vehiculos/{$vehiculo->id}/inspeccion/items/papeles_vtv", ['completado' => true])->assertUnauthorized();
        $this->postJson("/api/vehiculos/{$vehiculo->id}/inspeccion/finalizar")->assertUnauthorized();
    }

    public function test_two_users_never_see_or_change_each_others_marks_on_the_same_vehicle(): void
    {
        $owner = User::factory()->create();
        $other = User::factory()->create();
        $vehiculo = $this->vehiculo();
        $this->tick($owner, $vehiculo, 'papeles_vtv');

        $this->actingAs($other)->getJson("/api/vehiculos/{$vehiculo->id}/inspeccion")
            ->assertOk()
            ->assertJsonPath('estado', null)
            ->assertJsonPath('items_completados', []);

        $this->tick($other, $vehiculo, 'motor_aceite');
        $this->tick($other, $vehiculo, 'papeles_vtv', false);
        $this->actingAs($other)->postJson("/api/vehiculos/{$vehiculo->id}/inspeccion/finalizar")->assertOk();

        $this->actingAs($owner)->getJson("/api/vehiculos/{$vehiculo->id}/inspeccion")
            ->assertJsonPath('estado', 'en_curso')
            ->assertJsonPath('items_completados', ['papeles_vtv']);
        $this->assertSame(2, ChecklistInspeccion::count());
    }

    public function test_the_same_user_keeps_separate_checklists_per_vehicle(): void
    {
        $user = User::factory()->create();
        $first = $this->vehiculo();
        $second = $this->vehiculo();
        $this->tick($user, $first, 'papeles_vtv');
        $this->tick($user, $second, 'motor_aceite');

        $this->actingAs($user)->getJson("/api/vehiculos/{$first->id}/inspeccion")
            ->assertJsonPath('items_completados', ['papeles_vtv']);
        $this->actingAs($user)->getJson("/api/vehiculos/{$second->id}/inspeccion")
            ->assertJsonPath('items_completados', ['motor_aceite']);
        $this->assertSame(2, ChecklistInspeccion::where('usuario_id', $user->id)->count());
    }
}
