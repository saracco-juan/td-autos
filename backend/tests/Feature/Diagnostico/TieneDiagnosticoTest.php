<?php

namespace Tests\Feature\Diagnostico;

use App\Models\Diagnostico;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TieneDiagnosticoTest extends TestCase
{
    use RefreshDatabase;

    public function test_new_user_has_no_diagnosis(): void
    {
        $user = User::factory()->create();

        $this->assertFalse($user->tiene_diagnostico);
        $this->actingAs($user)->getJson('/api/user')
            ->assertOk()
            ->assertJsonPath('tiene_diagnostico', false);
    }

    public function test_saving_the_diagnosis_turns_the_flag_on_in_the_session_endpoint(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)->putJson('/api/diagnostico', [
            'presupuesto' => '15m_25m',
            'uso_principal' => 'mixto',
            'pasajeros' => '3_4',
            'kilometros_mensuales' => '500_1500',
            'transmision' => 'automatica',
            'prioridad' => 'consumo',
            'carrocerias' => [1],
        ])->assertOk();

        $this->actingAs($user->fresh())->getJson('/api/user')
            ->assertOk()
            ->assertJsonPath('tiene_diagnostico', true);
    }

    public function test_the_flag_is_true_only_for_the_owner_of_the_diagnosis(): void
    {
        $owner = User::factory()->create();
        $other = User::factory()->create();
        Diagnostico::create(['usuario_id' => $owner->id, 'estado' => 'completo']);

        $this->assertTrue($owner->tiene_diagnostico);
        $this->assertFalse($other->tiene_diagnostico);
    }

    public function test_profile_update_response_carries_the_flag(): void
    {
        $user = User::factory()->create();
        Diagnostico::create(['usuario_id' => $user->id, 'estado' => 'completo']);

        $this->actingAs($user)->putJson('/api/user', ['name' => 'Juan', 'apellido' => 'Pérez'])
            ->assertOk()
            ->assertJsonPath('tiene_diagnostico', true);
    }
}
