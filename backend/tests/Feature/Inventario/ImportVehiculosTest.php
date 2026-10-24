<?php

namespace Tests\Feature\Inventario;

use App\Http\Middleware\EnsureDealerIsActive;
use App\Models\Concesionaria;
use App\Models\FotoVehiculo;
use App\Models\User;
use App\Models\Vehiculo;
use App\Models\VehiculoConcesionaria;
use App\Support\VehiculoFields;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

/**
 * UH22 (RF21, RF23, RF24, RF25, CU-20, RNF12): applying the CSV import. The whole file is
 * validated again and then written in one transaction, or nothing is written.
 */
class ImportVehiculosTest extends TestCase
{
    use InteractsWithImportCsv;
    use InteractsWithVehiculos;
    use RefreshDatabase;

    private const URL = '/api/concesionaria/vehiculos/importar';

    protected function tearDown(): void
    {
        // Model listeners registered by a test must not leak into the next one.
        Vehiculo::flushEventListeners();
        VehiculoConcesionaria::flushEventListeners();

        parent::tearDown();
    }

    /**
     * @param  list<array<string, string>>  $rows
     */
    private function import(User $user, array $rows): TestResponse
    {
        return $this->actingAs($user)->post(
            self::URL,
            ['archivo' => $this->csvFile($this->csvContent($rows))],
            ['Accept' => 'application/json'],
        );
    }

    private function plateOwner(string $plate): ?VehiculoConcesionaria
    {
        return VehiculoConcesionaria::query()->where('patente_normalizada', $plate)->first();
    }

    private function assertNothingChanged(Vehiculo $existing): void
    {
        $this->assertSame(1, Vehiculo::query()->count());
        $this->assertCount(7, $existing->fotos()->get());
        $this->assertSame($existing->marca, $existing->fresh()->marca);
        $this->assertNull($this->plateOwner('AB123CD'));
    }

    public function test_import_preserves_an_unchanged_catalog_link_and_clears_it_when_identity_changes(): void
    {
        $user = $this->dealer();
        $vehicle = $this->vehicleOf($user->concesionaria, 7, 'AB123CD');
        $id = 'acara:'.str_repeat('a', 64);
        $vehicle->update(['marca' => 'Toyota', 'modelo' => 'Corolla', 'version' => 'XEI 2.0 CVT', 'acara_version_id' => $id]);
        $this->import($user, [$this->csvRow(['precio' => '12345'])])->assertOk()
            ->assertExactJson(['nuevos' => 0, 'actualizaciones' => 1]);
        $this->assertSame($id, $vehicle->fresh()->acara_version_id);
        $this->import($user, [$this->csvRow(['marca' => 'Ford', 'modelo' => 'Focus', 'version' => 'Trend'])])->assertOk()
            ->assertExactJson(['nuevos' => 0, 'actualizaciones' => 1]);
        $this->assertSame('Focus', $vehicle->fresh()->modelo);
        $this->assertNull($vehicle->fresh()->acara_version_id);
        $this->assertDatabaseCount('vehiculo', 1);
    }

    public function test_tc58_creates_new_overwrites_matching_and_keeps_absent_vehicles(): void
    {
        $user = $this->dealer();
        $dealer = $user->concesionaria;
        $matching = $this->vehicleOf($dealer, 7, 'XY987ZW');
        $matching->propiedad()->update(['visible' => false]);
        $absent = $this->vehicleOf($dealer, 7, 'ZZ111AA');
        $other = $this->vehicleOf(Concesionaria::factory()->active()->create(), 7, 'OT123ER');
        $oldPhotos = $matching->fotos->modelKeys();
        $absentMarca = $absent->marca;

        $this->import($user, [
            $this->csvRow(['patente' => 'xy-987-zw', 'marca' => 'Ford', 'version' => '', 'precio' => '1000', 'fotos' => $this->photoCell(8)]),
            $this->csvRow(['patente' => 'AB123CD']),
        ])->assertOk()->assertExactJson(['nuevos' => 1, 'actualizaciones' => 1]);

        $created = $this->plateOwner('AB123CD');
        $this->assertSame($dealer->id, $created->concesionaria_id);
        $this->assertTrue($created->visible);
        $vehicle = Vehiculo::query()->findOrFail($created->vehiculo_id);
        $this->assertSame('concesionaria', $vehicle->origen);
        $this->assertSame('ARS', $vehicle->moneda);
        $this->assertSame('Toyota', $vehicle->marca);
        $photos = $vehicle->fotos()->get();
        $this->assertSame([1, 2, 3, 4, 5, 6, 7], $photos->pluck('orden')->all());
        $this->assertSame('https://cdn.example.com/autos/1.jpg', $photos->first()->ubicacion_archivo);
        $this->assertSame('https://cdn.example.com/autos/7.jpg', $photos->last()->ubicacion_archivo);

        $matching->refresh();
        $this->assertSame('Ford', $matching->marca);
        $this->assertNull($matching->version);
        $this->assertEquals(1000, $matching->precio);
        $this->assertFalse($this->plateOwner('XY987ZW')->visible);
        $this->assertSame($dealer->id, $this->plateOwner('XY987ZW')->concesionaria_id);
        $this->assertCount(8, $matching->fotos);
        $this->assertSame([], array_intersect($oldPhotos, $matching->fotos->modelKeys()));
        $this->assertStringStartsWith('https://', $matching->fotos->first()->ubicacion_archivo);

        $this->assertCount(7, $absent->fotos()->get());
        $this->assertSame($absentMarca, $absent->fresh()->marca);
        $this->assertCount(7, $other->fotos()->get());
        $this->assertSame('ZZ111AA', $absent->propiedad->patente_normalizada);
        $this->assertSame('OT123ER', $other->propiedad->patente_normalizada);
        $this->assertSame(4, Vehiculo::query()->count());
    }

    public function test_tc59_row_with_fewer_than_seven_photos_rejects_the_batch_and_persists_nothing(): void
    {
        $user = $this->dealer();
        $existing = $this->vehicleOf($user->concesionaria, 7, 'XY987ZW');

        $response = $this->import($user, [
            $this->csvRow(['patente' => 'XY987ZW', 'marca' => 'Ford']),
            $this->csvRow(['patente' => 'AB123CD', 'fotos' => $this->photoCell(6)]),
        ]);

        $response->assertUnprocessable()
            ->assertJsonPath('message', 'El archivo tiene errores. No se aplicó ningún cambio.')
            ->assertJsonPath('errores.0.fila', 3)
            ->assertJsonPath('errores.0.patente', 'AB123CD');
        $this->assertNothingChanged($existing);
    }

    public function test_tc60_repeated_plate_rejects_the_batch_and_persists_nothing(): void
    {
        $user = $this->dealer();

        $response = $this->import($user, [
            $this->csvRow(['patente' => 'AB123CD']),
            $this->csvRow(['patente' => 'ab-123-cd']),
        ]);

        $response->assertUnprocessable()->assertJsonPath('errores.0.patente', 'AB123CD');
        $this->assertSame(0, Vehiculo::query()->count());
        $this->assertSame(0, VehiculoConcesionaria::query()->count());
    }

    public function test_tc82_plate_of_another_dealer_rejects_the_batch_without_naming_it(): void
    {
        $user = $this->dealer();
        $other = $this->vehicleOf(Concesionaria::factory()->active()->create(), 7, 'OT123ER');

        $response = $this->import($user, [
            $this->csvRow(['patente' => 'AB123CD']),
            $this->csvRow(['patente' => 'OT123ER', 'marca' => 'Ford']),
        ]);

        $response->assertUnprocessable()
            ->assertJsonPath('errores.0.fila', 3)
            ->assertJsonPath('errores.0.mensajes.0', VehiculoFields::PATENTE_TAKEN_MESSAGE);
        $this->assertNull($this->plateOwner('AB123CD'));
        $this->assertSame($other->marca, $other->fresh()->marca);
    }

    public function test_plate_taken_between_preview_and_import_answers_422_and_rolls_everything_back(): void
    {
        $user = $this->dealer();
        $existing = $this->vehicleOf($user->concesionaria, 7, 'XY987ZW');
        $rival = Concesionaria::factory()->active()->create();

        // The rival claims the plate right before the importer inserts it, as a concurrent request would.
        VehiculoConcesionaria::creating(function (VehiculoConcesionaria $row) use ($rival) {
            if ($row->patente_normalizada === 'AB123CD') {
                DB::table('vehiculo_concesionaria')->insert([
                    'vehiculo_id' => Vehiculo::factory()->create()->id,
                    'concesionaria_id' => $rival->id,
                    'patente_normalizada' => 'AB123CD',
                    'visible' => true,
                ]);
            }
        });

        $response = $this->import($user, [
            $this->csvRow(['patente' => 'XY987ZW', 'marca' => 'Ford']),
            $this->csvRow(['patente' => 'AB123CD']),
        ]);

        $response->assertUnprocessable()
            ->assertJsonPath('message', 'El archivo tiene errores. No se aplicó ningún cambio.')
            ->assertJsonPath('errores.0.fila', 3)
            ->assertJsonPath('errores.0.patente', 'AB123CD')
            ->assertJsonPath('errores.0.mensajes.0', VehiculoFields::PATENTE_TAKEN_MESSAGE);
        // The rival's claim lived inside the rolled-back transaction, so the plate is free again.
        $this->assertNull($this->plateOwner('AB123CD'));
        $this->assertSame(1, Vehiculo::query()->count());
        $this->assertSame($existing->marca, $existing->fresh()->marca);
        $this->assertCount(7, $existing->fotos()->get());
    }

    public function test_stored_files_of_an_overwritten_vehicle_are_deleted_after_commit(): void
    {
        $user = $this->dealer();
        $vehicle = $this->vehicleOf($user->concesionaria, 7, 'XY987ZW');
        $paths = $vehicle->fotos->pluck('ubicacion_archivo')->all();

        $this->import($user, [$this->csvRow(['patente' => 'XY987ZW'])])->assertOk();

        foreach ($paths as $path) {
            Storage::disk($this->disk)->assertMissing($path);
        }
    }

    public function test_stored_files_are_kept_when_the_transaction_fails(): void
    {
        $user = $this->dealer();
        $vehicle = $this->vehicleOf($user->concesionaria, 7, 'XY987ZW');
        $paths = $vehicle->fotos->pluck('ubicacion_archivo')->all();

        Vehiculo::creating(fn () => throw new \RuntimeException('boom'));

        $this->import($user, [
            $this->csvRow(['patente' => 'XY987ZW', 'marca' => 'Ford']),
            $this->csvRow(['patente' => 'AB123CD']),
        ])->assertStatus(500);

        foreach ($paths as $path) {
            Storage::disk($this->disk)->assertExists($path);
        }
        $this->assertCount(7, $vehicle->fotos()->get());
        $this->assertSame($vehicle->marca, $vehicle->fresh()->marca);
        $this->assertNull($this->plateOwner('AB123CD'));
    }

    public function test_dealer_endpoints_return_external_photo_urls_as_they_are(): void
    {
        $user = $this->dealer();
        $this->import($user, [$this->csvRow()])->assertOk();
        $id = $this->plateOwner('AB123CD')->vehiculo_id;

        $show = $this->actingAs($user)->getJson("/api/concesionaria/vehiculos/{$id}")->assertOk();
        $list = $this->actingAs($user)->getJson('/api/concesionaria/vehiculos')->assertOk();

        $this->assertSame('https://cdn.example.com/autos/1.jpg', $show->json('vehiculo.fotos.0.url'));
        $this->assertSame('https://cdn.example.com/autos/7.jpg', $show->json('vehiculo.fotos.6.url'));
        $this->assertSame('https://cdn.example.com/autos/1.jpg', $list->json('vehiculos.0.fotos.0.url'));
    }

    public function test_hu21_edit_can_remove_url_photos_without_touching_the_disk(): void
    {
        $user = $this->dealer();
        $this->import($user, [$this->csvRow(['fotos' => $this->photoCell(9)])])->assertOk();
        $vehicle = Vehiculo::query()->findOrFail($this->plateOwner('AB123CD')->vehiculo_id);
        Storage::disk($this->disk)->put('vehiculos/keep.png', 'x');
        $removed = $vehicle->fotos->take(2)->modelKeys();

        $this->actingAs($user)->post("/api/concesionaria/vehiculos/{$vehicle->id}", [
            ...$this->payload(['fotos' => []]),
            'fotos_eliminar' => $removed,
        ], ['Accept' => 'application/json'])->assertOk();

        $this->assertSame([1, 2, 3, 4, 5, 6, 7], $vehicle->fotos()->pluck('orden')->all());
        Storage::disk($this->disk)->assertExists('vehiculos/keep.png');
    }

    public function test_hu21_delete_works_with_url_photos(): void
    {
        $user = $this->dealer();
        $this->import($user, [$this->csvRow()])->assertOk();
        $id = $this->plateOwner('AB123CD')->vehiculo_id;
        Storage::disk($this->disk)->put('vehiculos/keep.png', 'x');

        $this->actingAs($user)->deleteJson("/api/concesionaria/vehiculos/{$id}")->assertNoContent();

        $this->assertNull(Vehiculo::query()->find($id));
        $this->assertSame(0, FotoVehiculo::query()->count());
        Storage::disk($this->disk)->assertExists('vehiculos/keep.png');
    }

    public function test_tc45_pending_dealer_is_forbidden_with_the_pending_message(): void
    {
        $user = Concesionaria::factory()->create()->usuario;

        $this->import($user, [$this->csvRow()])
            ->assertForbidden()
            ->assertExactJson(['message' => EnsureDealerIsActive::MESSAGE_PENDING]);
        $this->assertSame(0, Vehiculo::query()->count());
    }

    public function test_buyer_is_forbidden(): void
    {
        $this->import(User::factory()->create()->fresh(), [$this->csvRow()])->assertForbidden();
    }

    public function test_guest_is_unauthenticated(): void
    {
        $this->postJson(self::URL, [])->assertUnauthorized();
    }
}
