<?php

namespace Tests\Feature\Profile;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class UpdateProfileTest extends TestCase
{
    use RefreshDatabase;

    // TC-09
    public function test_incomplete_profile_is_completed(): void
    {
        $user = User::factory()->create(['apellido' => null]);

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
        $user = User::factory()->create(['name' => 'Ana', 'apellido' => 'Gómez']);

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
        $user = User::factory()->create();

        $this->actingAs($user)->putJson('/api/user', ['name' => '  Juan  ', 'apellido' => ' Pérez '])->assertOk();

        $this->assertDatabaseHas('users', ['id' => $user->id, 'name' => 'Juan', 'apellido' => 'Pérez']);
    }

    // TC-11
    public function test_empty_name_is_rejected(): void
    {
        $user = User::factory()->create(['name' => 'Ana', 'apellido' => 'Gómez']);

        $this->actingAs($user)->putJson('/api/user', ['name' => '', 'apellido' => 'Pérez'])
            ->assertUnprocessable()
            ->assertJsonPath('errors.name.0', 'El nombre es obligatorio.')
            ->assertJsonMissingValidationErrors('apellido');

        $this->assertDatabaseHas('users', ['id' => $user->id, 'name' => 'Ana', 'apellido' => 'Gómez']);
    }

    // TC-11
    public function test_empty_apellido_is_rejected(): void
    {
        $user = User::factory()->create(['name' => 'Ana', 'apellido' => 'Gómez']);

        $this->actingAs($user)->putJson('/api/user', ['name' => 'Juan', 'apellido' => ''])
            ->assertUnprocessable()
            ->assertJsonPath('errors.apellido.0', 'El apellido es obligatorio.')
            ->assertJsonMissingValidationErrors('name');

        $this->assertDatabaseHas('users', ['id' => $user->id, 'name' => 'Ana', 'apellido' => 'Gómez']);
    }

    public function test_missing_fields_are_rejected(): void
    {
        $this->actingAs(User::factory()->create())->putJson('/api/user', [])
            ->assertUnprocessable()
            ->assertJsonPath('errors.name.0', 'El nombre es obligatorio.')
            ->assertJsonPath('errors.apellido.0', 'El apellido es obligatorio.');
    }

    public function test_whitespace_only_values_are_rejected_as_missing(): void
    {
        $user = User::factory()->create(['name' => 'Ana', 'apellido' => 'Gómez']);

        $this->actingAs($user)->putJson('/api/user', ['name' => '   ', 'apellido' => "\t "])
            ->assertUnprocessable()
            ->assertJsonPath('errors.name.0', 'El nombre es obligatorio.')
            ->assertJsonPath('errors.apellido.0', 'El apellido es obligatorio.');

        $this->assertDatabaseHas('users', ['id' => $user->id, 'name' => 'Ana', 'apellido' => 'Gómez']);
    }

    public function test_values_over_the_length_limits_are_rejected(): void
    {
        $user = User::factory()->create(['name' => 'Ana', 'apellido' => 'Gómez']);

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
        $this->actingAs(User::factory()->create())->putJson('/api/user', [
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
        $user = User::factory()->create(['name' => 'Ana', 'apellido' => 'Gómez'])->fresh();

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

    public function test_perfil_completo_is_false_when_apellido_is_missing(): void
    {
        $this->actingAs(User::factory()->create(['apellido' => null]))->getJson('/api/user')
            ->assertOk()
            ->assertJsonPath('perfil_completo', false);
    }

    public function test_perfil_completo_is_true_when_both_names_are_filled(): void
    {
        $this->actingAs(User::factory()->create(['apellido' => 'Gómez']))->getJson('/api/user')
            ->assertOk()
            ->assertJsonPath('perfil_completo', true);
    }
}
