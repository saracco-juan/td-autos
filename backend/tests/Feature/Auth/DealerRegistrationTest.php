<?php

namespace Tests\Feature\Auth;

use App\Models\Concesionaria;
use App\Models\User;
use App\Rules\StrongPassword;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use RuntimeException;
use Tests\TestCase;

/**
 * UH17 — dealer self-registration (RF15, RF16, CU-15).
 */
class DealerRegistrationTest extends TestCase
{
    use RefreshDatabase;

    /**
     * @param  array<string, mixed>  $overrides
     * @return array<string, mixed>
     */
    private function payload(array $overrides = []): array
    {
        return array_merge([
            'nombre_concesionaria' => 'Autos del Centro',
            'name' => 'Laura',
            'apellido' => 'Gómez',
            'responsable_dni' => '30123456',
            'telefono_publico' => '351 400-1000',
            'telefono_responsable' => '351 155-200300',
            'email' => 'laura@autosdelcentro.com',
            'direccion' => 'Av. Colón 1234',
            'localidad' => 'Córdoba',
            'provincia' => 'Córdoba',
            'password' => 'Abcdef12',
            'password_confirmation' => 'Abcdef12',
        ], $overrides);
    }

    /**
     * TC-44: a valid request creates the account with the dealer role and a pending dealer.
     */
    public function test_tc44_dealer_registers_with_pending_state_and_is_authenticated(): void
    {
        $response = $this->postJson('/register/concesionaria', $this->payload());

        $user = User::where('email', 'laura@autosdelcentro.com')->firstOrFail();
        $dealer = Concesionaria::where('usuario_id', $user->id)->firstOrFail();

        $response->assertCreated()
            ->assertJsonPath('email', 'laura@autosdelcentro.com')
            ->assertJsonPath('name', 'Laura')
            ->assertJsonPath('apellido', 'Gómez')
            ->assertJsonPath('rol', 'concesionaria')
            ->assertJsonPath('concesionaria', [
                'id' => $dealer->id,
                'nombre' => 'Autos del Centro',
                'estado_alta' => 'pendiente',
            ])
            ->assertJsonMissingPath('password')
            ->assertJsonMissingPath('remember_token')
            ->assertJsonMissingPath('auth_subject');

        $this->assertAuthenticatedAs($user);
        $this->assertSame('concesionaria', $user->rol);
        $this->assertNull($user->telefono);
        $this->assertDatabaseHas('concesionaria', [
            'usuario_id' => $user->id,
            'nombre' => 'Autos del Centro',
            'responsable_dni' => '30123456',
            'telefono_publico' => '351 400-1000',
            'telefono_responsable' => '351 155-200300',
            'direccion' => 'Av. Colón 1234',
            'localidad' => 'Córdoba',
            'provincia' => 'Córdoba',
            'estado_alta' => 'pendiente',
        ]);
        $this->assertNotNull($dealer->creada_en);
    }

    /**
     * @return array<string, array{string}>
     */
    public static function requiredFields(): array
    {
        return [
            'nombre_concesionaria' => ['nombre_concesionaria'],
            'name' => ['name'],
            'apellido' => ['apellido'],
            'responsable_dni' => ['responsable_dni'],
            'telefono_publico' => ['telefono_publico'],
            'telefono_responsable' => ['telefono_responsable'],
            'email' => ['email'],
            'direccion' => ['direccion'],
            'localidad' => ['localidad'],
            'provincia' => ['provincia'],
            'password' => ['password'],
        ];
    }

    /**
     * TC-80: every field is required and reports its own error.
     */
    #[DataProvider('requiredFields')]
    public function test_tc80_missing_required_field_is_rejected_on_that_field(string $field): void
    {
        $this->postJson('/register/concesionaria', $this->payload([$field => '']))
            ->assertUnprocessable()
            ->assertOnlyJsonValidationErrors([$field]);

        $this->assertNothingPersisted();
    }

    public function test_tc80_empty_request_reports_every_required_field(): void
    {
        $this->postJson('/register/concesionaria', [])
            ->assertUnprocessable()
            ->assertOnlyJsonValidationErrors(array_keys(self::requiredFields()))
            ->assertJsonPath('errors.nombre_concesionaria.0', 'El nombre de la concesionaria es obligatorio.')
            ->assertJsonPath('errors.name.0', 'El nombre es obligatorio.')
            ->assertJsonPath('errors.email.0', 'El email es obligatorio.')
            ->assertJsonPath('errors.password.0', 'La contraseña es obligatoria.');

        $this->assertNothingPersisted();
    }

    public function test_duplicate_email_is_rejected(): void
    {
        User::factory()->create(['email' => 'laura@autosdelcentro.com']);

        $this->postJson('/register/concesionaria', $this->payload(['email' => '  Laura@AutosDelCentro.com ']))
            ->assertUnprocessable()
            ->assertJsonPath('errors.email.0', 'El email ya está en uso.');

        $this->assertSame(1, User::count());
        $this->assertSame(0, Concesionaria::count());
    }

    public function test_email_is_normalized_before_storage(): void
    {
        $this->postJson('/register/concesionaria', $this->payload(['email' => '  Laura@AutosDelCentro.com ']))
            ->assertCreated();

        $this->assertDatabaseHas('users', ['email' => 'laura@autosdelcentro.com']);
    }

    public function test_weak_password_lists_every_unmet_requirement(): void
    {
        $this->postJson('/register/concesionaria', $this->payload(['password' => 'abc', 'password_confirmation' => 'abc']))
            ->assertUnprocessable()
            ->assertJsonPath('errors.password', [
                StrongPassword::MESSAGE_MIN_LENGTH,
                StrongPassword::MESSAGE_UPPERCASE,
                StrongPassword::MESSAGE_NUMBER,
            ]);

        $this->assertNothingPersisted();
    }

    public function test_password_confirmation_mismatch_is_rejected(): void
    {
        $this->postJson('/register/concesionaria', $this->payload(['password_confirmation' => 'Different12']))
            ->assertUnprocessable()
            ->assertJsonPath('errors.password.0', 'Las contraseñas no coinciden.');

        $this->assertNothingPersisted();
    }

    public function test_fields_over_their_maximum_length_are_rejected(): void
    {
        $this->postJson('/register/concesionaria', $this->payload([
            'nombre_concesionaria' => str_repeat('a', 151),
            'responsable_dni' => str_repeat('1', 21),
            'telefono_publico' => str_repeat('1', 31),
        ]))
            ->assertUnprocessable()
            ->assertOnlyJsonValidationErrors(['nombre_concesionaria', 'responsable_dni', 'telefono_publico']);

        $this->assertNothingPersisted();
    }

    public function test_non_string_fields_are_rejected_with_spanish_messages(): void
    {
        $this->postJson('/register/concesionaria', $this->payload([
            'responsable_dni' => 30123456,
            'telefono_publico' => 3514001000,
        ]))
            ->assertUnprocessable()
            ->assertOnlyJsonValidationErrors(['responsable_dni', 'telefono_publico'])
            ->assertJsonPath('errors.responsable_dni', ['El DNI debe ser un texto.'])
            ->assertJsonPath('errors.telefono_publico', ['El teléfono de la concesionaria debe ser un texto.']);

        $this->assertNothingPersisted();
    }

    /**
     * @return array<string, array{string, string}>
     */
    public static function stringMessages(): array
    {
        return [
            'nombre_concesionaria' => ['nombre_concesionaria', 'El nombre de la concesionaria debe ser un texto.'],
            'name' => ['name', 'El nombre debe ser un texto.'],
            'apellido' => ['apellido', 'El apellido debe ser un texto.'],
            'responsable_dni' => ['responsable_dni', 'El DNI debe ser un texto.'],
            'telefono_publico' => ['telefono_publico', 'El teléfono de la concesionaria debe ser un texto.'],
            'telefono_responsable' => ['telefono_responsable', 'El teléfono del responsable debe ser un texto.'],
            'email' => ['email', 'El email debe ser un texto.'],
            'direccion' => ['direccion', 'La dirección debe ser un texto.'],
            'localidad' => ['localidad', 'La localidad debe ser un texto.'],
            'provincia' => ['provincia', 'La provincia debe ser un texto.'],
            'password' => ['password', 'La contraseña debe ser un texto.'],
        ];
    }

    #[DataProvider('stringMessages')]
    public function test_every_string_field_reports_a_spanish_type_error(string $field, string $message): void
    {
        $this->postJson('/register/concesionaria', $this->payload([$field => 12345678]))
            ->assertUnprocessable()
            ->assertJsonPath("errors.$field.0", $message);

        $this->assertNothingPersisted();
    }

    /**
     * The user and the dealer are created together or not at all.
     */
    public function test_user_is_not_persisted_when_the_dealer_insert_fails(): void
    {
        Concesionaria::creating(function (): void {
            throw new RuntimeException('dealer insert failed');
        });

        try {
            $this->postJson('/register/concesionaria', $this->payload())->assertStatus(500);
        } finally {
            Concesionaria::flushEventListeners();
        }

        $this->assertNothingPersisted();
        $this->assertGuest();
    }

    public function test_privileged_fields_in_payload_are_ignored(): void
    {
        $this->postJson('/register/concesionaria', $this->payload([
            'rol' => 'admin',
            'estado_alta' => 'activa',
            'auth_subject' => 'google:x',
        ]))->assertCreated();

        $user = User::where('email', 'laura@autosdelcentro.com')->firstOrFail();
        $this->assertSame('concesionaria', $user->rol);
        $this->assertNull($user->auth_subject);
        $this->assertSame('pendiente', $user->concesionaria->estado_alta);
    }

    public function test_authenticated_users_cannot_register_a_dealer(): void
    {
        $this->actingAs(User::factory()->create());

        $this->postJson('/register/concesionaria', $this->payload())
            ->assertStatus(409)
            ->assertExactJson(['message' => 'Ya existe una sesión iniciada.']);

        $this->assertSame(1, User::count());
        $this->assertSame(0, Concesionaria::count());
    }

    public function test_api_user_returns_the_dealer_for_a_dealer_user(): void
    {
        $dealer = Concesionaria::factory()->create(['nombre' => 'Autos del Centro']);

        $this->actingAs($dealer->usuario)
            ->getJson('/api/user')
            ->assertOk()
            ->assertJsonPath('rol', 'concesionaria')
            ->assertJsonPath('concesionaria', [
                'id' => $dealer->id,
                'nombre' => 'Autos del Centro',
                'estado_alta' => 'pendiente',
            ]);
    }

    public function test_api_user_does_not_return_a_dealer_for_a_buyer(): void
    {
        // fresh() loads the column defaults (rol) the factory instance does not carry.
        $this->actingAs(User::factory()->create()->fresh())
            ->getJson('/api/user')
            ->assertOk()
            ->assertJsonPath('rol', 'comprador')
            ->assertJsonMissingPath('concesionaria');
    }

    /**
     * HU17 scenario 2: the account can be used while the request is pending.
     */
    public function test_pending_dealer_can_log_in(): void
    {
        $this->postJson('/register/concesionaria', $this->payload())->assertCreated();
        $this->postJson('/logout')->assertNoContent();
        $this->assertGuest();

        $this->postJson('/login', ['email' => 'laura@autosdelcentro.com', 'password' => 'Abcdef12'])
            ->assertSuccessful();

        $this->assertAuthenticated();
        $this->getJson('/api/user')
            ->assertOk()
            ->assertJsonPath('concesionaria.estado_alta', 'pendiente');
    }

    public function test_buyer_registration_is_unchanged(): void
    {
        $this->postJson('/register', [
            'name' => 'Test User',
            'email' => 'test@example.com',
            'password' => 'Abcdef12',
            'password_confirmation' => 'Abcdef12',
        ])
            ->assertCreated()
            ->assertJsonPath('rol', 'comprador')
            ->assertJsonMissingPath('concesionaria');

        $this->assertSame(0, Concesionaria::count());
    }

    private function assertNothingPersisted(): void
    {
        $this->assertSame(0, User::count());
        $this->assertSame(0, Concesionaria::count());
    }
}
