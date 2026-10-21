<?php

namespace Tests\Feature\Admin;

use App\Models\ComprobantePago;
use App\Models\Concesionaria;
use App\Models\FotoVehiculo;
use App\Models\Suscripcion;
use App\Models\User;
use App\Models\Vehiculo;
use App\Models\VehiculoConcesionaria;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * UH28 (RF34, RF35, CU-26, TC-71, TC-72): the administrator deletes a dealer without a current
 * subscription, with its account, vehicles, leads, subscription and receipts.
 */
class AdminDealerDeletionTest extends TestCase
{
    use RefreshDatabase;

    private const BLOCKED_MESSAGE = 'No podés eliminar una concesionaria con la suscripción vigente.';

    /** Every table a dealer's data lives in; all must be empty after deleting the only dealer. */
    private const TABLES = [
        'users', 'concesionaria', 'suscripcion', 'comprobante_pago', 'vehiculo', 'vehiculo_concesionaria',
        'foto_vehiculo', 'lead', 'favorito', 'recomendacion', 'publicacion_externa', 'checklist_inspeccion',
        'item_inspeccion_completado', 'checklist_transferencia', 'etapa_transferencia_completada',
        'diagnostico', 'diagnostico_carroceria', 'personal_access_tokens', 'sessions',
    ];

    private string $photosDisk;

    private string $receiptsDisk;

    protected function setUp(): void
    {
        parent::setUp();

        $this->photosDisk = config('filesystems.vehicle_photos_disk');
        $this->receiptsDisk = config('filesystems.receipts_disk');
        Storage::fake($this->photosDisk);
        Storage::fake($this->receiptsDisk);
        $this->travelTo('2026-10-01 10:00:00');
    }

    private function admin(): User
    {
        return User::factory()->admin()->create();
    }

    /**
     * Subscription attributes for each effective state on 2026-10-01.
     *
     * @return array<string, array<string, mixed>>
     */
    private static function subscriptionStates(): array
    {
        return [
            'activa' => ['estado' => Suscripcion::ESTADO_ACTIVA, 'vigente_desde' => '2026-09-14', 'vigente_hasta' => '2026-10-14'],
            'gracia' => ['estado' => Suscripcion::ESTADO_ACTIVA, 'vigente_desde' => '2026-08-29', 'vigente_hasta' => '2026-09-29'],
            'inactiva' => ['estado' => Suscripcion::ESTADO_INACTIVA, 'vigente_desde' => '2026-07-01', 'vigente_hasta' => '2026-08-01'],
            'grace over, not persisted yet' => ['estado' => Suscripcion::ESTADO_ACTIVA, 'vigente_desde' => '2026-08-20', 'vigente_hasta' => '2026-09-20'],
            'pendiente' => ['estado' => Suscripcion::ESTADO_PENDIENTE, 'vigente_desde' => '2026-09-30', 'vigente_hasta' => null],
        ];
    }

    /**
     * A dealer with the given subscription (none when null), two receipts with stored files and
     * two vehicles with stored photos, each with buyer data hanging from it.
     */
    private function dealer(?string $state, string $plate = 'AB'): Concesionaria
    {
        $dealer = Concesionaria::factory()->active()->create();

        if ($state !== null) {
            $subscription = Suscripcion::factory()->create([
                'concesionaria_id' => $dealer->id,
                ...self::subscriptionStates()[$state],
            ]);
            foreach (range(1, 2) as $n) {
                $receipt = ComprobantePago::factory()->create(['suscripcion_id' => $subscription->id]);
                Storage::disk($this->receiptsDisk)->put($receipt->archivo_url, 'pdf');
            }
        }

        foreach (range(1, 2) as $n) {
            $this->vehicleOf($dealer, "{$plate}{$n}00CD");
        }

        return $dealer;
    }

    private function vehicleOf(Concesionaria $dealer, string $plate): Vehiculo
    {
        $vehiculo = Vehiculo::factory()->create(['combustible' => 'nafta', 'transmision' => 'manual']);
        VehiculoConcesionaria::factory()->create([
            'vehiculo_id' => $vehiculo->id,
            'concesionaria_id' => $dealer->id,
            'patente_normalizada' => $plate,
        ]);

        foreach (range(1, 2) as $n) {
            $path = "vehiculos/{$vehiculo->id}/{$n}.png";
            Storage::disk($this->photosDisk)->put($path, 'png');
            FotoVehiculo::factory()->create(['vehiculo_id' => $vehiculo->id, 'ubicacion_archivo' => $path, 'orden' => $n]);
        }

        $buyer = User::factory()->create();
        $now = now();
        DB::table('lead')->insert(['comprador_usuario_id' => $buyer->id, 'vehiculo_concesionaria_id' => $vehiculo->id, 'generado_en' => $now]);
        DB::table('favorito')->insert(['usuario_id' => $buyer->id, 'vehiculo_id' => $vehiculo->id, 'fecha_guardado' => $now]);
        DB::table('recomendacion')->insert(['vehiculo_id' => $vehiculo->id, 'posicion' => 1, 'puntaje_total' => 0.5, 'generada_en' => $now]);
        $inspection = DB::table('checklist_inspeccion')->insertGetId([
            'usuario_id' => $buyer->id, 'vehiculo_id' => $vehiculo->id, 'estado' => 'en_curso', 'actualizado_en' => $now,
        ]);
        DB::table('item_inspeccion_completado')->insert(['checklist_id' => $inspection, 'item_codigo' => 'frenos', 'completado_en' => $now]);

        return $vehiculo;
    }

    /**
     * Rows that point to the dealer's own account as if it had also used the buyer side, plus an
     * API token and a session: none of them may block deleting the account.
     */
    private function accountRowsFor(User $user, Vehiculo $vehiculo): void
    {
        $now = now();
        $diagnosis = DB::table('diagnostico')->insertGetId(['usuario_id' => $user->id, 'estado' => 'completo']);
        DB::table('diagnostico_carroceria')->insert(['diagnostico_id' => $diagnosis, 'tipo_carroceria_id' => DB::table('tipo_carroceria')->value('id')]);
        DB::table('recomendacion')->insert(['diagnostico_id' => $diagnosis, 'vehiculo_id' => $vehiculo->id, 'posicion' => 2, 'puntaje_total' => 0.4, 'generada_en' => $now]);
        DB::table('favorito')->insert(['usuario_id' => $user->id, 'vehiculo_id' => $vehiculo->id, 'fecha_guardado' => $now]);
        DB::table('lead')->insert(['comprador_usuario_id' => $user->id, 'vehiculo_concesionaria_id' => $vehiculo->id, 'generado_en' => $now]);
        $transfer = DB::table('checklist_transferencia')->insertGetId([
            'usuario_id' => $user->id, 'vehiculo_id' => $vehiculo->id, 'estado' => 'en_curso', 'actualizado_en' => $now,
        ]);
        DB::table('etapa_transferencia_completada')->insert(['seguimiento_id' => $transfer, 'etapa_codigo' => 'formulario_08', 'completada_en' => $now]);
        $user->createToken('mobile');
        DB::table('sessions')->insert(['id' => 'dealer-session', 'user_id' => $user->id, 'payload' => '', 'last_activity' => $now->timestamp]);
    }

    /**
     * @return array<string, int>
     */
    private function counts(): array
    {
        return array_combine(self::TABLES, array_map(fn (string $table) => DB::table($table)->count(), self::TABLES));
    }

    /**
     * @return list<string>
     */
    private function files(): array
    {
        return [...Storage::disk($this->photosDisk)->allFiles(), ...Storage::disk($this->receiptsDisk)->allFiles()];
    }

    private function url(Concesionaria|int $dealer): string
    {
        return '/api/admin/concesionarias/'.($dealer instanceof Concesionaria ? $dealer->id : $dealer);
    }

    /**
     * @return array<string, array{string}>
     */
    public static function currentStates(): array
    {
        return ['activa' => ['activa'], 'gracia' => ['gracia']];
    }

    /**
     * TC-71: a dealer whose subscription is valid or in grace cannot be deleted; nothing changes.
     */
    #[DataProvider('currentStates')]
    public function test_tc71_dealer_with_a_current_subscription_is_not_deleted(string $state): void
    {
        $dealer = $this->dealer($state);
        $admin = $this->admin();
        $before = $this->counts();
        $files = $this->files();

        $this->actingAs($admin)->deleteJson($this->url($dealer))
            ->assertConflict()
            ->assertExactJson(['message' => self::BLOCKED_MESSAGE]);

        $this->assertSame($before, $this->counts());
        $this->assertEqualsCanonicalizing($files, $this->files());
        $this->assertCount(6, $files); // Four photos and two receipts.
    }

    /**
     * @return array<string, array{?string}>
     */
    public static function removableStates(): array
    {
        return [
            'inactiva' => ['inactiva'],
            'pendiente' => ['pendiente'],
            'grace over, not persisted yet' => ['grace over, not persisted yet'],
            'no subscription' => [null],
        ];
    }

    /**
     * TC-72: without a current subscription the dealer goes with its account, vehicles and their
     * buyer data, leads, subscription, receipts and every stored file.
     */
    #[DataProvider('removableStates')]
    public function test_tc72_dealer_without_a_current_subscription_is_deleted_with_all_its_data(?string $state): void
    {
        $dealer = $this->dealer($state);
        $this->accountRowsFor($dealer->usuario, Vehiculo::query()->firstOrFail());
        $admin = $this->admin();

        $this->actingAs($admin)->deleteJson($this->url($dealer))->assertNoContent();

        $remaining = array_filter($this->counts());
        // Only the admin and the two buyers of the dealer's vehicles keep an account.
        $this->assertSame(['users' => 3], $remaining);
        $this->assertDatabaseMissing('users', ['id' => $dealer->usuario_id]);
        $this->assertDatabaseHas('users', ['id' => $admin->id]);
        $this->assertSame([], $this->files());
    }

    /**
     * TC-72: other dealers keep all their data and files.
     */
    public function test_tc72_other_dealers_stay_untouched(): void
    {
        $other = $this->dealer('activa', 'ZZ');
        $before = $this->counts();
        $otherFiles = $this->files();
        $dealer = $this->dealer('inactiva');

        $this->actingAs($this->admin())->deleteJson($this->url($dealer))->assertNoContent();

        $after = $this->counts();
        // The admin and the two buyers of the deleted dealer's vehicles were created after the snapshot.
        $after['users'] -= 3;
        $this->assertSame($before, $after);
        $this->assertEqualsCanonicalizing($otherFiles, $this->files());
        $this->assertDatabaseHas('concesionaria', ['id' => $other->id]);
        $this->assertDatabaseHas('users', ['id' => $other->usuario_id]);
    }

    public function test_tc72_detail_tells_whether_the_dealer_can_be_deleted(): void
    {
        $admin = $this->admin();

        foreach (['activa' => false, 'gracia' => false, 'inactiva' => true, 'pendiente' => true] as $state => $removable) {
            $this->actingAs($admin)->getJson($this->url($this->dealer($state, strtoupper(substr($state, 0, 2)))))
                ->assertOk()
                ->assertJsonPath('puede_eliminarse', $removable);
        }
    }

    public function test_unknown_dealer_answers_404_with_a_spanish_message(): void
    {
        $this->actingAs($this->admin())->deleteJson($this->url(9999))
            ->assertNotFound()
            ->assertJsonPath('message', 'No encontramos la concesionaria.');
    }

    public function test_guests_are_unauthenticated_and_nothing_changes(): void
    {
        $dealer = $this->dealer(null);
        $before = $this->counts();

        $this->deleteJson($this->url($dealer))->assertUnauthorized();

        $this->assertSame($before, $this->counts());
    }

    public function test_buyers_and_dealers_are_forbidden_and_nothing_changes(): void
    {
        $dealer = $this->dealer(null);
        $buyer = User::factory()->create();
        $before = $this->counts();

        foreach ([$this->url($dealer), $this->url(9999)] as $url) {
            $this->actingAs($buyer)->deleteJson($url)->assertForbidden();
            $this->actingAs($dealer->usuario)->deleteJson($url)->assertForbidden();
        }

        $this->assertSame($before, $this->counts());
    }
}
