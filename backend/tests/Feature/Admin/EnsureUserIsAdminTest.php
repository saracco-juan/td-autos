<?php

namespace Tests\Feature\Admin;

use App\Http\Middleware\EnsureUserIsAdmin;
use App\Models\Concesionaria;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Route;
use Tests\TestCase;

/**
 * UH19 (RF19, CU-17): the administration area is reserved for administrator accounts.
 */
class EnsureUserIsAdminTest extends TestCase
{
    use RefreshDatabase;

    private const PROBE = '/api/_test/admin';

    protected function setUp(): void
    {
        parent::setUp();

        Route::middleware(['api', 'auth:sanctum', 'admin'])
            ->get(self::PROBE, fn () => response()->json(['ok' => true]));
    }

    public function test_guest_is_unauthenticated(): void
    {
        $this->getJson(self::PROBE)->assertUnauthorized();
    }

    public function test_buyer_is_forbidden(): void
    {
        $this->actingAs(User::factory()->create())
            ->getJson(self::PROBE)
            ->assertForbidden()
            ->assertExactJson(['message' => EnsureUserIsAdmin::MESSAGE_FORBIDDEN]);
    }

    public function test_dealer_is_forbidden_even_when_active(): void
    {
        $dealer = Concesionaria::factory()->active()->create();

        $this->actingAs($dealer->usuario)
            ->getJson(self::PROBE)
            ->assertForbidden()
            ->assertExactJson(['message' => EnsureUserIsAdmin::MESSAGE_FORBIDDEN]);
    }

    public function test_admin_passes(): void
    {
        $this->actingAs(User::factory()->admin()->create())
            ->getJson(self::PROBE)
            ->assertOk()
            ->assertExactJson(['ok' => true]);
    }

    public function test_admin_is_not_a_dealer_and_has_no_dealer_summary(): void
    {
        $admin = User::factory()->admin()->create();

        $this->assertTrue($admin->esAdministrador());
        $this->assertFalse($admin->esConcesionaria());

        $this->actingAs($admin)
            ->getJson('/api/user')
            ->assertOk()
            ->assertJsonPath('rol', User::ROL_ADMINISTRADOR)
            ->assertJsonMissingPath('concesionaria');
    }

    public function test_admin_cannot_reach_dealer_routes(): void
    {
        $this->actingAs(User::factory()->admin()->create())
            ->getJson('/api/concesionaria/suscripcion')
            ->assertForbidden();
    }
}
