<?php

namespace Tests\Feature\Transferencia;

use App\Models\ChecklistTransferencia;
use App\Models\EtapaTransferenciaCompletada;
use App\Models\User;
use App\Support\TransferenciaChecklist;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class TransferenciaTest extends TestCase
{
    use RefreshDatabase;

    private function tick(User $user, string $codigo, bool $completado = true): void
    {
        $this->actingAs($user)
            ->putJson("/api/transferencia/items/$codigo", ['completado' => $completado])
            ->assertOk();
    }

    // TC-38 (scenario 1)
    public function test_reading_without_a_checklist_returns_the_stages_and_creates_nothing(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->getJson('/api/transferencia')
            ->assertOk()
            ->assertJsonPath('estado', null)
            ->assertJsonPath('items_completados', [])
            ->assertJsonCount(4, 'etapas');

        $etapas = $response->json('etapas');
        $this->assertSame(TransferenciaChecklist::stages(), $etapas);
        $this->assertSame([1, 2, 3, 4], array_column($etapas, 'numero'));
        $items = array_merge(...array_column($etapas, 'items'));
        $this->assertCount(15, $items);
        $this->assertCount(8, array_filter($items, fn (array $item) => $item['obligatorio']));
        $this->assertDatabaseCount('checklist_transferencia', 0);
        $this->assertDatabaseCount('etapa_transferencia_completada', 0);
    }

    // TC-38: exact shape for a new user without advisor
    public function test_reading_has_the_documented_keys(): void
    {
        $user = User::factory()->create();
        config(['services.transfer_advisor.whatsapp' => '']);

        $this->actingAs($user)->getJson('/api/transferencia')
            ->assertOk()
            ->assertExactJson([
                'etapas' => TransferenciaChecklist::stages(),
                'estado' => null,
                'items_completados' => [],
                'asesor_whatsapp' => null,
            ]);
    }

    // TC-39 (scenario 2)
    public function test_first_tick_creates_the_checklist_in_progress_without_a_vehicle(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)->putJson('/api/transferencia/items/documentacion_dni', ['completado' => true])
            ->assertOk()
            ->assertExactJson(['estado' => 'en_curso', 'items_completados' => ['documentacion_dni']]);

        $checklist = ChecklistTransferencia::where('usuario_id', $user->id)->firstOrFail();
        $this->assertNull($checklist->vehiculo_id);
        $this->assertNotNull($checklist->actualizado_en);
        $this->assertDatabaseHas('etapa_transferencia_completada', [
            'seguimiento_id' => $checklist->id,
            'etapa_codigo' => 'documentacion_dni',
        ]);
        $this->assertNotNull(EtapaTransferenciaCompletada::firstOrFail()->completada_en);
    }

    // TC-39: progress survives a new request
    public function test_ticked_items_are_kept_when_the_user_comes_back(): void
    {
        $user = User::factory()->create();
        $this->tick($user, 'despues_seguro');
        $this->tick($user, 'antes_titular');

        $this->actingAs($user)->getJson('/api/transferencia')
            ->assertOk()
            ->assertJsonPath('estado', 'en_curso')
            ->assertJsonPath('items_completados', ['antes_titular', 'despues_seguro']);
    }

    // TC-39: catalog order
    public function test_completed_items_come_back_in_catalog_order(): void
    {
        $user = User::factory()->create();
        $this->tick($user, 'tramite_turno');
        $this->tick($user, 'documentacion_cedula');
        $this->tick($user, 'antes_deudas');

        $this->actingAs($user)->getJson('/api/transferencia')
            ->assertJsonPath('items_completados', ['antes_deudas', 'documentacion_cedula', 'tramite_turno']);
    }

    // TC-39: idempotent
    public function test_ticking_twice_keeps_a_single_row(): void
    {
        $user = User::factory()->create();

        $this->tick($user, 'documentacion_dni');
        $this->tick($user, 'documentacion_dni');

        $this->assertDatabaseCount('checklist_transferencia', 1);
        $this->assertDatabaseCount('etapa_transferencia_completada', 1);
    }

    // TC-39: unticking
    public function test_unticking_removes_the_item(): void
    {
        $user = User::factory()->create();
        $this->tick($user, 'documentacion_dni');
        $this->tick($user, 'antes_titular');

        $this->actingAs($user)->putJson('/api/transferencia/items/documentacion_dni', ['completado' => false])
            ->assertOk()
            ->assertExactJson(['estado' => 'en_curso', 'items_completados' => ['antes_titular']]);

        $this->assertDatabaseCount('etapa_transferencia_completada', 1);
    }

    public function test_unticking_an_item_that_is_not_ticked_is_fine(): void
    {
        $user = User::factory()->create();
        $this->tick($user, 'antes_titular');

        $this->actingAs($user)->putJson('/api/transferencia/items/documentacion_dni', ['completado' => false])
            ->assertOk()
            ->assertExactJson(['estado' => 'en_curso', 'items_completados' => ['antes_titular']]);
    }

    public function test_unticking_without_a_checklist_creates_nothing(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)->putJson('/api/transferencia/items/documentacion_dni', ['completado' => false])
            ->assertOk()
            ->assertExactJson(['estado' => null, 'items_completados' => []]);

        $this->assertDatabaseCount('checklist_transferencia', 0);
    }

    public function test_changing_an_item_updates_actualizado_en(): void
    {
        $user = User::factory()->create();
        $this->tick($user, 'documentacion_dni');
        DB::table('checklist_transferencia')->update(['actualizado_en' => '2026-01-01 10:00:00']);

        $this->tick($user, 'antes_titular');

        $this->assertNotSame('2026-01-01 10:00:00', DB::table('checklist_transferencia')->value('actualizado_en'));
    }

    // TC-79 (scenario 3) and TC-85 (scenario 4), data support: the alert itself is shown by the frontend.
    public function test_finishing_with_pending_items_including_a_mandatory_one_is_incomplete(): void
    {
        $user = User::factory()->create();
        $this->tick($user, 'antes_titular');
        $this->tick($user, 'documentacion_dni');

        $this->actingAs($user)->postJson('/api/transferencia/finalizar')
            ->assertOk()
            ->assertExactJson([
                'estado' => 'incompleta',
                'items_completados' => ['antes_titular', 'documentacion_dni'],
            ]);

        $this->assertDatabaseHas('checklist_transferencia', ['usuario_id' => $user->id, 'estado' => 'incompleta']);
        $this->assertDatabaseCount('etapa_transferencia_completada', 2);
        $this->actingAs($user)->getJson('/api/transferencia')->assertJsonPath('estado', 'incompleta');
    }

    // TC-85: a pending mandatory item is visible as missing from the ticked list
    public function test_finishing_with_only_a_mandatory_item_pending_is_incomplete(): void
    {
        $user = User::factory()->create();

        foreach (TransferenciaChecklist::codes() as $codigo) {
            if ($codigo !== 'tramite_formulario_08') {
                $this->tick($user, $codigo);
            }
        }

        $response = $this->actingAs($user)->postJson('/api/transferencia/finalizar')
            ->assertOk()
            ->assertJsonPath('estado', 'incompleta')
            ->assertJsonCount(14, 'items_completados');

        $this->assertContains('tramite_formulario_08', TransferenciaChecklist::mandatoryCodes());
        $this->assertNotContains('tramite_formulario_08', $response->json('items_completados'));
    }

    // TC-79
    public function test_finishing_with_every_item_ticked_completes_the_checklist(): void
    {
        $user = User::factory()->create();

        foreach (TransferenciaChecklist::codes() as $codigo) {
            $this->tick($user, $codigo);
        }

        $this->actingAs($user)->postJson('/api/transferencia/finalizar')
            ->assertOk()
            ->assertExactJson([
                'estado' => 'completa',
                'items_completados' => TransferenciaChecklist::codes(),
            ]);

        $this->assertDatabaseHas('checklist_transferencia', ['usuario_id' => $user->id, 'estado' => 'completa']);
        $this->assertSame(15, EtapaTransferenciaCompletada::count());
    }

    public function test_toggling_after_finishing_puts_the_checklist_back_in_progress(): void
    {
        $user = User::factory()->create();
        $this->tick($user, 'antes_titular');
        $this->actingAs($user)->postJson('/api/transferencia/finalizar')->assertJsonPath('estado', 'incompleta');

        $this->tick($user, 'documentacion_dni');
        $this->actingAs($user)->getJson('/api/transferencia')->assertJsonPath('estado', 'en_curso');

        $this->actingAs($user)->postJson('/api/transferencia/finalizar')->assertOk();
        $this->tick($user, 'documentacion_dni', false);
        $this->actingAs($user)->getJson('/api/transferencia')
            ->assertJsonPath('estado', 'en_curso')
            ->assertJsonPath('items_completados', ['antes_titular']);
    }

    public function test_finishing_without_a_checklist_stores_it_as_incomplete(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)->postJson('/api/transferencia/finalizar')
            ->assertOk()
            ->assertExactJson(['estado' => 'incompleta', 'items_completados' => []]);

        $this->assertDatabaseHas('checklist_transferencia', [
            'usuario_id' => $user->id,
            'vehiculo_id' => null,
            'estado' => 'incompleta',
        ]);
    }

    public function test_finishing_twice_keeps_a_single_checklist(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)->postJson('/api/transferencia/finalizar')->assertOk();
        $this->actingAs($user)->postJson('/api/transferencia/finalizar')->assertOk();

        $this->assertDatabaseCount('checklist_transferencia', 1);
    }

    // TC-86 / RF36 (scenario 5)
    public function test_advisor_is_null_when_not_configured(): void
    {
        $user = User::factory()->create();
        config(['services.transfer_advisor.whatsapp' => '']);

        $this->actingAs($user)->getJson('/api/transferencia')->assertJsonPath('asesor_whatsapp', null);
    }

    // TC-86 / RF36 (scenario 5)
    public function test_advisor_number_is_reduced_to_digits(): void
    {
        $user = User::factory()->create();
        config(['services.transfer_advisor.whatsapp' => '+54 9 (11) 2233-4455']);

        $this->actingAs($user)->getJson('/api/transferencia')->assertJsonPath('asesor_whatsapp', '5491122334455');
    }

    public function test_advisor_without_any_digit_is_null(): void
    {
        $user = User::factory()->create();
        config(['services.transfer_advisor.whatsapp' => '+ - ()']);

        $this->actingAs($user)->getJson('/api/transferencia')->assertJsonPath('asesor_whatsapp', null);
    }

    public function test_unknown_item_code_is_rejected_and_nothing_is_saved(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)->putJson('/api/transferencia/items/no_existe', ['completado' => true])
            ->assertUnprocessable()
            ->assertJsonPath('errors.codigo.0', 'El paso del trámite no existe.');

        $this->assertDatabaseCount('checklist_transferencia', 0);
        $this->assertDatabaseCount('etapa_transferencia_completada', 0);
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

        $this->actingAs($user)->putJson('/api/transferencia/items/documentacion_dni', $body)
            ->assertUnprocessable()
            ->assertJsonPath('errors.completado.0', 'Indicá si el paso está completado o no.');

        $this->assertDatabaseCount('checklist_transferencia', 0);
    }

    public function test_guest_is_unauthorized(): void
    {
        $this->getJson('/api/transferencia')->assertUnauthorized();
        $this->putJson('/api/transferencia/items/documentacion_dni', ['completado' => true])->assertUnauthorized();
        $this->postJson('/api/transferencia/finalizar')->assertUnauthorized();
    }

    public function test_two_users_never_see_or_change_each_others_marks(): void
    {
        $owner = User::factory()->create();
        $other = User::factory()->create();
        $this->tick($owner, 'documentacion_dni');

        $this->actingAs($other)->getJson('/api/transferencia')
            ->assertOk()
            ->assertJsonPath('estado', null)
            ->assertJsonPath('items_completados', []);

        $this->tick($other, 'antes_titular');
        $this->tick($other, 'documentacion_dni', false);
        $this->actingAs($other)->postJson('/api/transferencia/finalizar')->assertOk();

        $this->actingAs($owner)->getJson('/api/transferencia')
            ->assertJsonPath('estado', 'en_curso')
            ->assertJsonPath('items_completados', ['documentacion_dni']);
        $this->assertSame(2, ChecklistTransferencia::count());
    }

    // HU13-MOBILE: the app authenticates with a Sanctum bearer token, not the session cookie.
    public function test_the_mobile_app_reads_the_checklist_with_a_bearer_token(): void
    {
        $user = User::factory()->create();
        config(['services.transfer_advisor.whatsapp' => '5491155550000']);
        $token = $user->createToken('Pixel 8')->plainTextToken;

        $this->withToken($token)->getJson('/api/transferencia')
            ->assertOk()
            ->assertExactJson([
                'etapas' => TransferenciaChecklist::stages(),
                'estado' => null,
                'items_completados' => [],
                'asesor_whatsapp' => '5491155550000',
            ]);
    }
}
