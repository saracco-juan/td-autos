<?php

namespace Tests\Feature\Profile;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class UpdateProfileTest extends TestCase
{
    use RefreshDatabase;

    public function test_buyer_can_clear_optional_surname_with_mobile_token(): void
    {
        $user = User::factory()->state(['rol' => User::ROL_COMPRADOR])->create(['apellido' => 'Perez']);
        $this->withToken($user->createToken('mobile')->plainTextToken)
            ->putJson('/api/user', ['name' => 'Ana', 'apellido' => '   '])
            ->assertOk()->assertJsonPath('apellido', null)->assertJsonPath('perfil_completo', true);
        $this->assertDatabaseHas('users', ['id' => $user->id, 'apellido' => null]);
    }

    public function test_omitted_surname_preserves_saved_value(): void
    {
        $user = User::factory()->state(['rol' => User::ROL_COMPRADOR])->create(['apellido' => 'Perez']);
        $this->actingAs($user)->putJson('/api/user', ['name' => 'Ana'])
            ->assertOk()->assertJsonPath('apellido', 'Perez');
        $this->assertDatabaseHas('users', ['id' => $user->id, 'apellido' => 'Perez']);
    }

    public function test_nonbuyers_still_require_surname_and_cannot_override_their_role(): void
    {
        foreach ([User::ROL_CONCESIONARIA, User::ROL_ADMINISTRADOR] as $role) {
            $user = User::factory()->state(['rol' => User::ROL_COMPRADOR])->create(['rol' => $role, 'apellido' => null]);
            $this->actingAs($user)->getJson('/api/user')->assertJsonPath('perfil_completo', false);
            $this->putJson('/api/user', ['name' => 'Changed', 'apellido' => '', 'rol' => User::ROL_COMPRADOR])
                ->assertUnprocessable()->assertJsonValidationErrors('apellido');
            $this->assertDatabaseHas('users', ['id' => $user->id, 'name' => $user->name, 'rol' => $role]);
        }
    }

    // TC-09
    public function test_incomplete_profile_is_completed(): void
    {
        $user = User::factory()->state(['rol' => User::ROL_COMPRADOR])->create(['name' => '', 'apellido' => null]);

        $this->actingAs($user)->getJson('/api/user')
            ->assertOk()
            ->assertJsonPath('perfil_completo', false);

        $this->actingAs($user)->putJson('/api/user', ['name' => 'Juan', 'apellido' => 'Pérez'])
            ->assertOk()
            ->assertJsonPath('apellido', 'Pérez')
            ->assertJsonPath('perfil_completo', true);

        $this->assertDatabaseHas('users', ['id' => $user->id, 'name' => 'Juan', 'apellido' => 'Pérez']);
    }

    // TC-10
    public function test_existing_data_is_updated_and_returned_by_the_session_endpoint(): void
    {
        $user = User::factory()->state(['rol' => User::ROL_COMPRADOR])->create(['name' => 'Ana', 'apellido' => 'Gómez']);

        $this->actingAs($user)->putJson('/api/user', ['name' => 'Ana María', 'apellido' => 'Gómez Ruiz'])
            ->assertOk()
            ->assertJsonPath('name', 'Ana María')
            ->assertJsonPath('apellido', 'Gómez Ruiz')
            ->assertJsonPath('perfil_completo', true);

        $this->actingAs($user->fresh())->getJson('/api/user')
            ->assertOk()
            ->assertJsonPath('name', 'Ana María')
            ->assertJsonPath('apellido', 'Gómez Ruiz');
    }

    public function test_values_are_trimmed_before_saving(): void
    {
        $user = User::factory()->state(['rol' => User::ROL_COMPRADOR])->create();

        $this->actingAs($user)->putJson('/api/user', ['name' => '  Juan  ', 'apellido' => ' Pérez '])->assertOk();

        $this->assertDatabaseHas('users', ['id' => $user->id, 'name' => 'Juan', 'apellido' => 'Pérez']);
    }

    // TC-11
    public function test_empty_name_is_rejected(): void
    {
        $user = User::factory()->state(['rol' => User::ROL_COMPRADOR])->create(['name' => 'Ana', 'apellido' => 'Gómez']);

        $this->actingAs($user)->putJson('/api/user', ['name' => '', 'apellido' => 'Pérez'])
            ->assertUnprocessable()
            ->assertJsonPath('errors.name.0', 'El nombre es obligatorio.')
            ->assertJsonMissingValidationErrors('apellido');

        $this->assertDatabaseHas('users', ['id' => $user->id, 'name' => 'Ana', 'apellido' => 'Gómez']);
    }

    public function test_missing_fields_are_rejected(): void
    {
        $this->actingAs(User::factory()->state(['rol' => User::ROL_COMPRADOR])->create())->putJson('/api/user', [])
            ->assertUnprocessable()
            ->assertJsonPath('errors.name.0', 'El nombre es obligatorio.')
            ->assertJsonMissingValidationErrors('apellido');
    }

    public function test_whitespace_only_values_are_rejected_as_missing(): void
    {
        $user = User::factory()->state(['rol' => User::ROL_COMPRADOR])->create(['name' => 'Ana', 'apellido' => 'Gómez']);

        $this->actingAs($user)->putJson('/api/user', ['name' => '   ', 'apellido' => "\t "])
            ->assertUnprocessable()
            ->assertJsonPath('errors.name.0', 'El nombre es obligatorio.')
            ->assertJsonMissingValidationErrors('apellido');

        $this->assertDatabaseHas('users', ['id' => $user->id, 'name' => 'Ana', 'apellido' => 'Gómez']);
    }

    public function test_values_over_the_length_limits_are_rejected(): void
    {
        $user = User::factory()->state(['rol' => User::ROL_COMPRADOR])->create(['name' => 'Ana', 'apellido' => 'Gómez']);

        $this->actingAs($user)->putJson('/api/user', [
            'name' => str_repeat('a', 256),
            'apellido' => str_repeat('b', 101),
        ])
            ->assertUnprocessable()
            ->assertJsonPath('errors.name.0', 'El nombre no puede superar los 255 caracteres.')
            ->assertJsonPath('errors.apellido.0', 'El apellido no puede superar los 100 caracteres.');

        $this->assertDatabaseHas('users', ['id' => $user->id, 'name' => 'Ana', 'apellido' => 'Gómez']);
    }

    public function test_values_at_the_length_limits_are_accepted(): void
    {
        $this->actingAs(User::factory()->state(['rol' => User::ROL_COMPRADOR])->create())->putJson('/api/user', [
            'name' => str_repeat('a', 255),
            'apellido' => str_repeat('b', 100),
        ])->assertOk();
    }

    public function test_guest_is_unauthorized(): void
    {
        $this->putJson('/api/user', ['name' => 'Juan', 'apellido' => 'Pérez'])->assertUnauthorized();
    }

    public function test_only_name_and_apellido_are_updated(): void
    {
        $user = User::factory()->state(['rol' => User::ROL_COMPRADOR])->create(['name' => 'Ana', 'apellido' => 'Gómez'])->fresh();

        $this->actingAs($user)->putJson('/api/user', [
            'name' => 'Juan',
            'apellido' => 'Pérez',
            'email' => 'otro@example.com',
            'rol' => 'admin',
            'activo' => false,
            'password' => 'Hacked-1234',
        ])->assertOk();

        $fresh = $user->fresh();
        $this->assertSame('Juan', $fresh->name);
        $this->assertSame($user->email, $fresh->email);
        $this->assertSame($user->rol, $fresh->rol);
        $this->assertTrue($fresh->activo);
        $this->assertSame($user->password, $fresh->password);
    }

    public function test_buyer_profile_is_complete_without_separate_surname(): void
    {
        $this->actingAs(User::factory()->state(['rol' => User::ROL_COMPRADOR])->create(['apellido' => null]))->getJson('/api/user')
            ->assertOk()
            ->assertJsonPath('perfil_completo', true);
    }

    public function test_perfil_completo_is_true_when_both_names_are_filled(): void
    {
        $this->actingAs(User::factory()->state(['rol' => User::ROL_COMPRADOR])->create(['apellido' => 'Gómez']))->getJson('/api/user')
            ->assertOk()
            ->assertJsonPath('perfil_completo', true);
    }

    // HU03-MOBILE: the app updates the profile with its Sanctum bearer token, no session.
    public function test_mobile_bearer_token_updates_the_profile(): void
    {
        $user = User::factory()->state(['rol' => User::ROL_COMPRADOR])->create(['apellido' => null]);
        $token = $user->createToken('Pixel 8')->plainTextToken;

        $this->withToken($token)->putJson('/api/user', ['name' => 'Juan', 'apellido' => 'Pérez'])
            ->assertOk()
            ->assertJsonPath('apellido', 'Pérez')
            ->assertJsonPath('perfil_completo', true);

        $this->assertGuest('web');
        $this->assertDatabaseHas('users', ['id' => $user->id, 'apellido' => 'Pérez']);
    }
}
