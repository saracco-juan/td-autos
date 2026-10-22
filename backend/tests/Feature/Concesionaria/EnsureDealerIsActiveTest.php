<?php

namespace Tests\Feature\Concesionaria;

use App\Http\Middleware\EnsureDealerIsActive;
use App\Models\Concesionaria;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Route;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * UH17 scenario 3 (RF16): inventory management is reserved for approved dealers.
 */
class EnsureDealerIsActiveTest extends TestCase
{
    use RefreshDatabase;

    private const PROBE = '/api/_test/inventario';

    protected function setUp(): void
    {
        parent::setUp();

        // Inventory routes arrive with UH21; the gate is exercised through a probe route.
        Route::middleware(['api', 'auth:sanctum', 'dealer.active'])
            ->get(self::PROBE, fn () => response()->json(['ok' => true]));
    }

    /**
     * TC-45: a dealer waiting for approval cannot manage inventory.
     */
    public function test_tc45_pending_dealer_is_forbidden_with_the_pending_message(): void
    {
        $dealer = Concesionaria::factory()->create();

        $this->actingAs($dealer->usuario)
            ->getJson(self::PROBE)
            ->assertForbidden()
            ->assertExactJson(['message' => EnsureDealerIsActive::MESSAGE_PENDING]);
    }

    /**
     * @return array<string, array{?string}>
     */
    public static function nonPendingInactiveStates(): array
    {
        return [
            'unknown state' => ['suspendida'],
            'no state' => [null],
        ];
    }

    #[DataProvider('nonPendingInactiveStates')]
    public function test_inactive_dealer_that_is_not_pending_is_forbidden_with_the_generic_message(?string $state): void
    {
        $dealer = Concesionaria::factory()->create(['estado_alta' => $state]);

        $this->actingAs($dealer->usuario)
            ->getJson(self::PROBE)
            ->assertForbidden()
            ->assertExactJson(['message' => EnsureDealerIsActive::MESSAGE_FORBIDDEN]);
    }

    public function test_active_dealer_passes(): void
    {
        $dealer = Concesionaria::factory()->active()->create();

        $this->actingAs($dealer->usuario)
            ->getJson(self::PROBE)
            ->assertOk()
            ->assertExactJson(['ok' => true]);
    }

    public function test_buyer_is_forbidden_with_the_generic_message(): void
    {
        $this->actingAs(User::factory()->create()->fresh())
            ->getJson(self::PROBE)
            ->assertForbidden()
            ->assertExactJson(['message' => EnsureDealerIsActive::MESSAGE_FORBIDDEN]);
    }

    public function test_dealer_user_without_a_dealer_row_is_forbidden(): void
    {
        $this->actingAs(User::factory()->dealer()->create())
            ->getJson(self::PROBE)
            ->assertForbidden()
            ->assertExactJson(['message' => EnsureDealerIsActive::MESSAGE_FORBIDDEN]);
    }

    public function test_guest_is_unauthenticated(): void
    {
        $this->getJson(self::PROBE)->assertUnauthorized();
    }

    public function test_messages_are_distinct_spanish_copy(): void
    {
        $this->assertSame(
            'Tu cuenta está pendiente de aprobación. Todavía no podés gestionar el inventario.',
            EnsureDealerIsActive::MESSAGE_PENDING,
        );
        $this->assertSame('No tenés permiso para realizar esta acción.', EnsureDealerIsActive::MESSAGE_FORBIDDEN);
    }
}
