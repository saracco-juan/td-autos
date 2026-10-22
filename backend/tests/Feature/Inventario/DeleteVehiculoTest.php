<?php

namespace Tests\Feature\Inventario;

use App\Http\Middleware\EnsureDealerIsActive;
use App\Models\Concesionaria;
use App\Models\FotoVehiculo;
use App\Models\User;
use App\Models\Vehiculo;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * UH21 (RF22, D4): a dealer permanently deletes one of its vehicles with everything that hangs from it.
 */
class DeleteVehiculoTest extends TestCase
{
    use InteractsWithVehiculos;
    use RefreshDatabase;

    private const URL = '/api/concesionaria/vehiculos';

    /** Tables that point to a vehicle, by the column that holds its id. */
    private const DEPENDENTS = [
        'checklist_inspeccion' => 'vehiculo_id',
        'checklist_transferencia' => 'vehiculo_id',
        'favorito' => 'vehiculo_id',
        'recomendacion' => 'vehiculo_id',
        'publicacion_externa' => 'vehiculo_id',
        'lead' => 'vehiculo_concesionaria_id',
    ];

    /**
     * Rows of every table that references the vehicle (directly or through a checklist) for one buyer.
     */
    private function buyerRowsFor(Vehiculo $vehiculo, User $buyer): void
    {
        $now = now();
        $inspection = DB::table('checklist_inspeccion')->insertGetId([
            'usuario_id' => $buyer->id, 'vehiculo_id' => $vehiculo->id, 'estado' => 'en_curso', 'actualizado_en' => $now,
        ]);
        DB::table('item_inspeccion_completado')->insert([
            'checklist_id' => $inspection, 'item_codigo' => 'frenos', 'completado_en' => $now,
        ]);
        $transfer = DB::table('checklist_transferencia')->insertGetId([
            'usuario_id' => $buyer->id, 'vehiculo_id' => $vehiculo->id, 'estado' => 'en_curso', 'actualizado_en' => $now,
        ]);
        DB::table('etapa_transferencia_completada')->insert([
            'seguimiento_id' => $transfer, 'etapa_codigo' => 'formulario_08', 'completada_en' => $now,
        ]);
        DB::table('favorito')->insert(['usuario_id' => $buyer->id, 'vehiculo_id' => $vehiculo->id, 'fecha_guardado' => $now]);
        DB::table('recomendacion')->insert([
            'vehiculo_id' => $vehiculo->id, 'posicion' => 1, 'puntaje_total' => 0.5, 'generada_en' => $now,
        ]);
        DB::table('lead')->insert([
            'comprador_usuario_id' => $buyer->id, 'vehiculo_concesionaria_id' => $vehiculo->id, 'generado_en' => $now,
        ]);
    }

    /**
     * @return array<string, int>
     */
    private function counts(): array
    {
        $tables = [...array_keys(self::DEPENDENTS), 'item_inspeccion_completado', 'etapa_transferencia_completada',
            'foto_vehiculo', 'vehiculo_concesionaria', 'vehiculo'];

        return array_combine($tables, array_map(fn (string $table) => DB::table($table)->count(), $tables));
    }

    public function test_dealer_deletes_its_vehicle_with_photos_files_and_buyer_data(): void
    {
        $dealer = Concesionaria::factory()->active()->create();
        $vehiculo = $this->vehicleOf($dealer, 7);
        $paths = FotoVehiculo::query()->pluck('ubicacion_archivo')->all();
        $this->buyerRowsFor($vehiculo, User::factory()->create());

        $this->actingAs($dealer->usuario)
            ->deleteJson(self::URL.'/'.$vehiculo->id)
            ->assertNoContent();

        $this->assertSame(array_fill_keys(array_keys($this->counts()), 0), $this->counts());
        foreach ($paths as $path) {
            Storage::disk($this->disk)->assertMissing($path);
        }
    }

    public function test_other_vehicles_and_their_data_stay_untouched(): void
    {
        $dealer = Concesionaria::factory()->active()->create();
        $mine = $this->vehicleOf($dealer, 7, 'AB123CD');
        $theirs = $this->vehicleOf(Concesionaria::factory()->active()->create(), 7, 'ZZ999ZZ');
        $buyer = User::factory()->create();
        $this->buyerRowsFor($theirs, $buyer);
        $before = $this->counts();

        $this->actingAs($dealer->usuario)->deleteJson(self::URL.'/'.$mine->id)->assertNoContent();

        $after = $this->counts();
        $this->assertSame(1, $after['vehiculo']);
        $this->assertSame(1, $after['vehiculo_concesionaria']);
        $this->assertSame(7, $after['foto_vehiculo']);
        foreach (['checklist_inspeccion', 'checklist_transferencia', 'favorito', 'recomendacion', 'lead',
            'item_inspeccion_completado', 'etapa_transferencia_completada'] as $table) {
            $this->assertSame($before[$table], $after[$table], $table);
        }
        $this->assertDatabaseHas('vehiculo', ['id' => $theirs->id]);
        $this->assertCount(7, Storage::disk($this->disk)->allFiles("vehiculos/{$theirs->id}"));
    }

    /**
     * TC-57: deleting a vehicle of another dealer is denied and it stays.
     */
    public function test_tc57_vehicle_of_another_dealer_is_not_found_and_stays(): void
    {
        $vehiculo = $this->vehicleOf(Concesionaria::factory()->active()->create(), 7);
        $this->buyerRowsFor($vehiculo, User::factory()->create());
        $before = $this->counts();

        $this->actingAs($this->dealer())
            ->deleteJson(self::URL.'/'.$vehiculo->id)
            ->assertNotFound();

        $this->assertSame($before, $this->counts());
        $this->assertCount(7, Storage::disk($this->disk)->allFiles());
    }

    public function test_unknown_vehicle_is_not_found(): void
    {
        $this->actingAs($this->dealer())->deleteJson(self::URL.'/999999')->assertNotFound();
    }

    public function test_files_are_kept_when_the_deletion_fails(): void
    {
        $dealer = Concesionaria::factory()->active()->create();
        $vehiculo = $this->vehicleOf($dealer, 7);

        Vehiculo::deleting(function () {
            throw new \RuntimeException('forced failure');
        });

        $this->withoutExceptionHandling()->expectException(\RuntimeException::class);

        try {
            $this->actingAs($dealer->usuario)->deleteJson(self::URL.'/'.$vehiculo->id);
        } finally {
            $this->assertCount(7, Storage::disk($this->disk)->allFiles());
            $this->assertSame(7, FotoVehiculo::query()->count());
            $this->assertSame(1, Vehiculo::query()->count());
        }
    }

    /**
     * TC-45: only approved dealers manage inventory.
     */
    public function test_tc45_pending_dealer_is_forbidden_with_the_pending_message(): void
    {
        $this->actingAs(Concesionaria::factory()->create()->usuario)
            ->deleteJson(self::URL.'/1')
            ->assertForbidden()
            ->assertExactJson(['message' => EnsureDealerIsActive::MESSAGE_PENDING]);
    }

    public function test_buyer_is_forbidden(): void
    {
        $this->actingAs(User::factory()->create()->fresh())->deleteJson(self::URL.'/1')->assertForbidden();
    }

    public function test_guest_is_unauthenticated(): void
    {
        $this->deleteJson(self::URL.'/1')->assertUnauthorized();
    }
}
