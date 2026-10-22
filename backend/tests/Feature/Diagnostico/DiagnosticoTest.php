<?php

namespace Tests\Feature\Diagnostico;

use App\Models\Diagnostico;
use App\Models\TipoCarroceria;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class DiagnosticoTest extends TestCase
{
    use RefreshDatabase;

    /**
     * @param  array<string, mixed>  $overrides
     * @return array<string, mixed>
     */
    private function answers(array $overrides = []): array
    {
        return array_merge([
            'presupuesto' => '15m_25m',
            'uso_principal' => 'mixto',
            'pasajeros' => '3_4',
            'kilometros_mensuales' => '500_1500',
            'transmision' => 'automatica',
            'prioridad' => 'consumo',
            'carrocerias' => [1, 3],
        ], $overrides);
    }

    // TC-12
    public function test_complete_questionnaire_is_saved(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)->putJson('/api/diagnostico', $this->answers())
            ->assertOk()
            ->assertExactJson(['diagnostico' => $this->answers()]);

        $this->assertDatabaseHas('diagnostico', [
            'usuario_id' => $user->id,
            'presupuesto_maximo' => 25000000,
            'uso_principal' => 'mixto',
            'pasajeros' => 4,
            'kilometros_mensuales' => '500_1500',
            'transmision_preferida' => 'automatica',
            'prioridad_comprador' => 'consumo',
            'estado' => 'completo',
        ]);
        $diagnostico = Diagnostico::where('usuario_id', $user->id)->firstOrFail();
        $this->assertNotNull($diagnostico->actualizado_en);
        $this->assertNull($diagnostico->calculado_en);
        $this->assertNull($diagnostico->estado_fuente_externa);
        $this->assertEqualsCanonicalizing([1, 3], $diagnostico->carrocerias()->pluck('tipo_carroceria.id')->all());
    }

    // TC-13
    public function test_missing_answer_is_rejected_and_nothing_is_saved(): void
    {
        $user = User::factory()->create();
        $payload = $this->answers();
        unset($payload['kilometros_mensuales']);

        $this->actingAs($user)->putJson('/api/diagnostico', $payload)
            ->assertUnprocessable()
            ->assertJsonPath('errors.kilometros_mensuales.0', 'Elegí una opción.')
            ->assertJsonMissingValidationErrors('presupuesto');

        $this->assertDatabaseCount('diagnostico', 0);
        $this->assertDatabaseCount('diagnostico_carroceria', 0);
    }

    // TC-13
    public function test_empty_body_reports_every_field(): void
    {
        $this->actingAs(User::factory()->create())->putJson('/api/diagnostico', [])
            ->assertUnprocessable()
            ->assertJsonPath('errors.presupuesto.0', 'Elegí una opción.')
            ->assertJsonPath('errors.uso_principal.0', 'Elegí una opción.')
            ->assertJsonPath('errors.pasajeros.0', 'Elegí una opción.')
            ->assertJsonPath('errors.kilometros_mensuales.0', 'Elegí una opción.')
            ->assertJsonPath('errors.transmision.0', 'Elegí una opción.')
            ->assertJsonPath('errors.prioridad.0', 'Elegí una opción.')
            ->assertJsonPath('errors.carrocerias.0', 'Elegí al menos un tipo de carrocería.');
    }

    // TC-14
    public function test_saving_again_keeps_the_changed_answers_in_a_single_row(): void
    {
        $user = User::factory()->create();
        $this->actingAs($user)->putJson('/api/diagnostico', $this->answers())->assertOk();

        $changed = $this->answers([
            'presupuesto' => 'mas_40m',
            'pasajeros' => '5_mas',
            'prioridad' => 'reventa',
            'carrocerias' => [2],
        ]);
        $this->actingAs($user)->putJson('/api/diagnostico', $changed)
            ->assertOk()
            ->assertExactJson(['diagnostico' => $changed]);

        $this->assertSame(1, Diagnostico::where('usuario_id', $user->id)->count());
        $this->actingAs($user)->getJson('/api/diagnostico')
            ->assertOk()
            ->assertJsonPath('diagnostico', $changed);
    }

    public function test_body_type_links_are_replaced_on_re_save(): void
    {
        $user = User::factory()->create();
        $this->actingAs($user)->putJson('/api/diagnostico', $this->answers(['carrocerias' => [1, 2]]))->assertOk();
        $this->actingAs($user)->putJson('/api/diagnostico', $this->answers(['carrocerias' => [2, 4]]))->assertOk();

        $this->assertEqualsCanonicalizing([2, 4], DB::table('diagnostico_carroceria')->pluck('tipo_carroceria_id')->all());
    }

    public function test_re_save_updates_actualizado_en_and_leaves_calculado_en_untouched(): void
    {
        $user = User::factory()->create();
        $this->actingAs($user)->putJson('/api/diagnostico', $this->answers())->assertOk();
        DB::table('diagnostico')->where('usuario_id', $user->id)->update([
            'calculado_en' => '2026-01-01 10:00:00',
            'estado_fuente_externa' => 'ok',
            'actualizado_en' => '2026-01-01 10:00:00',
        ]);

        $this->actingAs($user)->putJson('/api/diagnostico', $this->answers(['uso_principal' => 'ruta']))->assertOk();

        $row = DB::table('diagnostico')->where('usuario_id', $user->id)->first();
        $this->assertSame('2026-01-01 10:00:00', $row->calculado_en);
        $this->assertSame('ok', $row->estado_fuente_externa);
        $this->assertNotSame('2026-01-01 10:00:00', $row->actualizado_en);
    }

    public function test_get_without_a_diagnosis_returns_null_and_the_catalog(): void
    {
        $this->actingAs(User::factory()->create())->getJson('/api/diagnostico')
            ->assertOk()
            ->assertExactJson([
                'diagnostico' => null,
                'carrocerias' => [
                    ['id' => 1, 'nombre' => 'Sedán'],
                    ['id' => 2, 'nombre' => 'Hatchback'],
                    ['id' => 3, 'nombre' => 'SUV'],
                    ['id' => 4, 'nombre' => 'Pickup'],
                    ['id' => 5, 'nombre' => 'Furgón'],
                    ['id' => 6, 'nombre' => 'Rural / familiar'],
                ],
            ]);
    }

    public function test_get_after_save_returns_the_same_codes(): void
    {
        $user = User::factory()->create();

        foreach (['mas_40m' => '1_2', 'hasta_15m' => '3_4', '25m_40m' => '5_mas'] as $presupuesto => $pasajeros) {
            $answers = $this->answers(['presupuesto' => $presupuesto, 'pasajeros' => $pasajeros]);
            $this->actingAs($user)->putJson('/api/diagnostico', $answers)->assertOk();

            $this->actingAs($user)->getJson('/api/diagnostico')
                ->assertOk()
                ->assertJsonPath('diagnostico', $answers)
                ->assertJsonCount(6, 'carrocerias');
        }
    }

    public function test_a_user_never_sees_another_users_diagnosis(): void
    {
        $owner = User::factory()->create();
        $other = User::factory()->create();
        $this->actingAs($owner)->putJson('/api/diagnostico', $this->answers())->assertOk();

        $this->actingAs($other)->getJson('/api/diagnostico')
            ->assertOk()
            ->assertJsonPath('diagnostico', null);

        $this->actingAs($other)->putJson('/api/diagnostico', $this->answers(['uso_principal' => 'trabajo', 'carrocerias' => [4]]))->assertOk();

        $this->actingAs($owner)->getJson('/api/diagnostico')->assertJsonPath('diagnostico', $this->answers());
        $this->assertSame(2, Diagnostico::count());
    }

    public function test_request_cannot_target_another_users_row(): void
    {
        $owner = User::factory()->create();
        $other = User::factory()->create();
        $this->actingAs($owner)->putJson('/api/diagnostico', $this->answers())->assertOk();

        $this->actingAs($other)->putJson('/api/diagnostico', $this->answers(['uso_principal' => 'trabajo']) + ['usuario_id' => $owner->id, 'id' => 1])->assertOk();

        $this->assertSame('mixto', Diagnostico::where('usuario_id', $owner->id)->value('uso_principal'));
    }

    public function test_guest_is_unauthorized(): void
    {
        $this->getJson('/api/diagnostico')->assertUnauthorized();
        $this->putJson('/api/diagnostico', $this->answers())->assertUnauthorized();
    }

    /**
     * @return array<string, array{0: string, 1: mixed}>
     */
    public static function invalidScalars(): array
    {
        return [
            'presupuesto' => ['presupuesto', 'gratis'],
            'uso_principal' => ['uso_principal', 'carreras'],
            'pasajeros' => ['pasajeros', '9'],
            'kilometros_mensuales' => ['kilometros_mensuales', 'infinitos'],
            'transmision' => ['transmision', 'cvt'],
            'prioridad' => ['prioridad', 'color'],
            'array instead of code' => ['presupuesto', ['hasta_15m']],
        ];
    }

    #[DataProvider('invalidScalars')]
    public function test_invalid_option_code_is_rejected(string $field, mixed $value): void
    {
        $this->actingAs(User::factory()->create())->putJson('/api/diagnostico', $this->answers([$field => $value]))
            ->assertUnprocessable()
            ->assertJsonPath("errors.$field.0", 'Elegí una opción.');

        $this->assertDatabaseCount('diagnostico', 0);
    }

    public function test_zero_body_types_are_rejected(): void
    {
        $this->actingAs(User::factory()->create())->putJson('/api/diagnostico', $this->answers(['carrocerias' => []]))
            ->assertUnprocessable()
            ->assertJsonPath('errors.carrocerias.0', 'Elegí al menos un tipo de carrocería.');

        $this->assertDatabaseCount('diagnostico', 0);
    }

    public function test_more_than_two_body_types_are_rejected(): void
    {
        $this->actingAs(User::factory()->create())->putJson('/api/diagnostico', $this->answers(['carrocerias' => [1, 2, 3]]))
            ->assertUnprocessable()
            ->assertJsonPath('errors.carrocerias.0', 'Podés elegir hasta dos tipos de carrocería.');

        $this->assertDatabaseCount('diagnostico', 0);
    }

    public function test_duplicated_body_types_are_rejected(): void
    {
        $this->actingAs(User::factory()->create())->putJson('/api/diagnostico', $this->answers(['carrocerias' => [2, 2]]))
            ->assertUnprocessable()
            ->assertJsonPath('errors.carrocerias.0', 'El tipo de carrocería elegido no es válido.');

        $this->assertDatabaseCount('diagnostico', 0);
    }

    public function test_non_existent_body_type_is_rejected(): void
    {
        $this->actingAs(User::factory()->create())->putJson('/api/diagnostico', $this->answers(['carrocerias' => [1, 999]]))
            ->assertUnprocessable()
            ->assertJsonPath('errors.carrocerias.0', 'El tipo de carrocería elegido no es válido.');

        $this->assertDatabaseCount('diagnostico', 0);
    }

    public function test_invalid_re_save_keeps_the_previous_diagnosis(): void
    {
        $user = User::factory()->create();
        $this->actingAs($user)->putJson('/api/diagnostico', $this->answers())->assertOk();

        $this->actingAs($user)->putJson('/api/diagnostico', $this->answers(['uso_principal' => 'ruta', 'carrocerias' => [1, 2, 3]]))
            ->assertUnprocessable();

        $this->actingAs($user)->getJson('/api/diagnostico')->assertJsonPath('diagnostico', $this->answers());
    }

    public function test_body_types_are_available_as_data_without_seeding(): void
    {
        $this->assertSame(
            ['Sedán', 'Hatchback', 'SUV', 'Pickup', 'Furgón', 'Rural / familiar'],
            TipoCarroceria::orderBy('id')->pluck('nombre')->all(),
        );
    }
}
