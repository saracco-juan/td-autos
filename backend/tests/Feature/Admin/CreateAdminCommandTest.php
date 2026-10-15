<?php

namespace Tests\Feature\Admin;

use App\Models\User;
use App\Rules\StrongPassword;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

/**
 * UH19: administrator accounts are created from the console, never through a public endpoint.
 */
class CreateAdminCommandTest extends TestCase
{
    use RefreshDatabase;

    private const PASSWORD = 'Secreta123';

    public function test_creates_a_verified_administrator_from_options(): void
    {
        $this->artisan('admin:create', [
            '--name' => 'Ana',
            '--email' => '  Ana.Admin@TDAutos.test ',
            '--password' => self::PASSWORD,
        ])->assertSuccessful();

        $admin = User::where('email', 'ana.admin@tdautos.test')->firstOrFail();

        $this->assertSame(User::ROL_ADMINISTRADOR, $admin->rol);
        $this->assertSame('Ana', $admin->name);
        $this->assertNotNull($admin->email_verified_at);
        $this->assertTrue(Hash::check(self::PASSWORD, $admin->password));
    }

    public function test_asks_for_missing_values(): void
    {
        $this->artisan('admin:create')
            ->expectsQuestion('Nombre', 'Ana')
            ->expectsQuestion('Email', 'ana@tdautos.test')
            ->expectsQuestion('Contraseña', self::PASSWORD)
            ->assertSuccessful();

        $this->assertSame(User::ROL_ADMINISTRADOR, User::where('email', 'ana@tdautos.test')->value('rol'));
    }

    public function test_rejects_a_weak_password(): void
    {
        $this->artisan('admin:create', [
            '--name' => 'Ana',
            '--email' => 'ana@tdautos.test',
            '--password' => 'corta',
        ])
            ->expectsOutputToContain(StrongPassword::MESSAGE_MIN_LENGTH)
            ->assertFailed();

        $this->assertDatabaseMissing('users', ['email' => 'ana@tdautos.test']);
    }

    public function test_rejects_an_email_already_in_use(): void
    {
        $existing = User::factory()->create(['email' => 'ana@tdautos.test']);

        $this->artisan('admin:create', [
            '--name' => 'Ana',
            '--email' => 'ANA@tdautos.test',
            '--password' => self::PASSWORD,
        ])
            ->expectsOutputToContain('El email ya está en uso.')
            ->assertFailed();

        $this->assertSame(1, User::count());
        $this->assertNotSame(User::ROL_ADMINISTRADOR, $existing->fresh()->rol);
    }

    public function test_rejects_a_missing_name_and_invalid_email(): void
    {
        $this->artisan('admin:create', [
            '--name' => ' ',
            '--email' => 'no-es-un-email',
            '--password' => self::PASSWORD,
        ])
            ->expectsOutputToContain('El nombre es obligatorio.')
            ->expectsOutputToContain('El email no tiene un formato válido.')
            ->assertFailed();

        $this->assertSame(0, User::count());
    }
}
