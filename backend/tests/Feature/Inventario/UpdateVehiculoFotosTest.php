<?php

namespace Tests\Feature\Inventario;

use App\Models\Concesionaria;
use App\Models\FotoVehiculo;
use App\Models\User;
use App\Models\Vehiculo;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

/**
 * UH21 (RF22, CU-19 step 3): a dealer adds and removes photos of its vehicle and the final
 * count stays between seven and twenty.
 */
class UpdateVehiculoFotosTest extends TestCase
{
    use InteractsWithVehiculos;
    use RefreshDatabase;

    private const URL = '/api/concesionaria/vehiculos';

    private Concesionaria $dealer;

    protected function setUp(): void
    {
        parent::setUp();

        $this->dealer = Concesionaria::factory()->active()->create();
    }

    /**
     * @param  array<string, mixed>  $extra
     */
    private function update(Vehiculo $vehiculo, array $extra): TestResponse
    {
        $linkedId = 'acara:existing-photo-test-vehicle';
        if ($vehiculo->acara_version_id === null) {
            $vehiculo->update(['acara_version_id' => $linkedId]);
        }
        $fields = $this->payload([...$vehiculo->only(['marca', 'modelo', 'version']), 'acara_version_id' => $vehiculo->acara_version_id]);
        unset($fields['fotos']);

        return $this->actingAs($this->dealer->usuario)
            ->post(self::URL.'/'.$vehiculo->id, [...$fields, 'patente' => 'XY987ZW', ...$extra], ['Accept' => 'application/json']);
    }

    /**
     * @return list<int>
     */
    private function photoIds(Vehiculo $vehiculo, int ...$orders): array
    {
        return FotoVehiculo::query()->where('vehiculo_id', $vehiculo->id)->whereIn('orden', $orders)->pluck('id')->all();
    }

    public function test_new_photos_are_added_after_the_existing_ones(): void
    {
        $vehiculo = $this->vehicleOf($this->dealer, 7);

        $response = $this->update($vehiculo, ['fotos' => $this->photos(2)])->assertOk()->assertJsonCount(9, 'vehiculo.fotos');

        $photos = FotoVehiculo::query()->where('vehiculo_id', $vehiculo->id)->orderBy('orden')->get();
        $this->assertSame(range(1, 9), $photos->pluck('orden')->all());
        $this->assertSame($photos->pluck('id')->all(), array_column($response->json('vehiculo.fotos'), 'id'));
        foreach ($photos as $photo) {
            Storage::disk($this->disk)->assertExists($photo->ubicacion_archivo);
        }
        $this->assertStringNotContainsString('/old', $photos[7]->ubicacion_archivo);
    }

    public function test_removed_photos_leave_no_row_or_file_and_the_rest_is_renumbered(): void
    {
        $vehiculo = $this->vehicleOf($this->dealer, 9);
        $removed = FotoVehiculo::query()->where('vehiculo_id', $vehiculo->id)->whereIn('orden', [2, 5])->get();

        $this->update($vehiculo, ['fotos_eliminar' => $removed->pluck('id')->all()])
            ->assertOk()
            ->assertJsonCount(7, 'vehiculo.fotos');

        $remaining = FotoVehiculo::query()->where('vehiculo_id', $vehiculo->id)->orderBy('orden')->get();
        $this->assertSame(range(1, 7), $remaining->pluck('orden')->all());
        $this->assertSame(
            ['old1.png', 'old3.png', 'old4.png', 'old6.png', 'old7.png', 'old8.png', 'old9.png'],
            $remaining->map(fn ($photo) => basename($photo->ubicacion_archivo))->all(),
        );
        foreach ($removed as $photo) {
            $this->assertDatabaseMissing('foto_vehiculo', ['id' => $photo->id]);
            Storage::disk($this->disk)->assertMissing($photo->ubicacion_archivo);
        }
        foreach ($remaining as $photo) {
            Storage::disk($this->disk)->assertExists($photo->ubicacion_archivo);
        }
    }

    public function test_photos_can_be_removed_and_added_in_one_request(): void
    {
        $vehiculo = $this->vehicleOf($this->dealer, 7);
        $first = FotoVehiculo::query()->where('vehiculo_id', $vehiculo->id)->where('orden', 1)->firstOrFail();

        $this->update($vehiculo, ['fotos_eliminar' => [$first->id], 'fotos' => $this->photos(1)])
            ->assertOk()
            ->assertJsonCount(7, 'vehiculo.fotos');

        $orders = FotoVehiculo::query()->where('vehiculo_id', $vehiculo->id)->orderBy('orden')->get();
        $this->assertSame(range(1, 7), $orders->pluck('orden')->all());
        $this->assertStringNotContainsString('/old', $orders->last()->ubicacion_archivo);
        Storage::disk($this->disk)->assertMissing($first->ubicacion_archivo);
    }

    public function test_a_final_count_below_seven_is_rejected_and_nothing_changes(): void
    {
        $vehiculo = $this->vehicleOf($this->dealer, 7);
        $files = Storage::disk($this->disk)->allFiles();
        $first = $this->photoIds($vehiculo, 1);

        $this->update($vehiculo, ['fotos_eliminar' => $first, 'fotos' => []])
            ->assertUnprocessable()
            ->assertJsonPath('errors.fotos.0', 'Cargá al menos siete fotos.');

        $this->assertSame(7, FotoVehiculo::query()->where('vehiculo_id', $vehiculo->id)->count());
        $this->assertSame($files, Storage::disk($this->disk)->allFiles());
    }

    public function test_removing_and_adding_that_ends_below_seven_is_rejected(): void
    {
        $vehiculo = $this->vehicleOf($this->dealer, 7);
        $files = Storage::disk($this->disk)->allFiles();

        $this->update($vehiculo, ['fotos_eliminar' => $this->photoIds($vehiculo, 1, 2, 3), 'fotos' => $this->photos(2)])
            ->assertUnprocessable()
            ->assertJsonPath('errors.fotos.0', 'Cargá al menos siete fotos.');

        $this->assertSame($files, Storage::disk($this->disk)->allFiles());
    }

    public function test_a_final_count_above_twenty_is_rejected_and_nothing_changes(): void
    {
        $vehiculo = $this->vehicleOf($this->dealer, 19);
        $files = Storage::disk($this->disk)->allFiles();

        $this->update($vehiculo, ['fotos' => $this->photos(2)])
            ->assertUnprocessable()
            ->assertJsonPath('errors.fotos.0', 'Podés cargar hasta 20 fotos.');

        $this->assertSame(19, FotoVehiculo::query()->where('vehiculo_id', $vehiculo->id)->count());
        $this->assertSame($files, Storage::disk($this->disk)->allFiles());
    }

    public function test_exactly_twenty_photos_are_accepted(): void
    {
        $vehiculo = $this->vehicleOf($this->dealer, 19);

        $this->update($vehiculo, ['fotos' => $this->photos(1)])->assertOk()->assertJsonCount(20, 'vehiculo.fotos');
    }

    public function test_a_photo_of_another_vehicle_cannot_be_removed(): void
    {
        $vehiculo = $this->vehicleOf($this->dealer, 8);
        $foreign = $this->vehicleOf(Concesionaria::factory()->active()->create(), 7, 'ZZ999ZZ');
        $foreignPhoto = FotoVehiculo::query()->where('vehiculo_id', $foreign->id)->firstOrFail();

        $this->update($vehiculo, ['fotos_eliminar' => [$foreignPhoto->id]])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['fotos_eliminar.0' => 'Una de las fotos a eliminar no pertenece a este vehículo.']);

        $this->assertDatabaseHas('foto_vehiculo', ['id' => $foreignPhoto->id]);
        Storage::disk($this->disk)->assertExists($foreignPhoto->ubicacion_archivo);
        $this->assertSame(8, FotoVehiculo::query()->where('vehiculo_id', $vehiculo->id)->count());
    }

    public function test_a_new_file_that_is_not_an_image_is_rejected(): void
    {
        $vehiculo = $this->vehicleOf($this->dealer, 7);

        $this->update($vehiculo, ['fotos' => [UploadedFile::fake()->createWithContent('doc.pdf', '%PDF-1.4 not an image')]])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['fotos.0' => 'Cada foto tiene que ser una imagen JPG, PNG o WebP.']);
    }

    public function test_tc57_photos_of_another_dealers_vehicle_cannot_be_touched(): void
    {
        $vehiculo = $this->vehicleOf(Concesionaria::factory()->active()->create(), 9, 'ZZ999ZZ');
        $files = Storage::disk($this->disk)->allFiles();

        $this->update($vehiculo, ['fotos_eliminar' => $this->photoIds($vehiculo, 1), 'fotos' => $this->photos(1)])
            ->assertNotFound();

        $this->assertSame(9, FotoVehiculo::query()->where('vehiculo_id', $vehiculo->id)->count());
        $this->assertSame($files, Storage::disk($this->disk)->allFiles());
    }

    public function test_new_files_are_removed_and_old_ones_kept_when_persistence_fails(): void
    {
        $vehiculo = $this->vehicleOf($this->dealer, 7);
        $files = Storage::disk($this->disk)->allFiles();
        $first = $this->photoIds($vehiculo, 1);

        // The new photo row is inserted right after its file was stored.
        FotoVehiculo::creating(function () {
            throw new \RuntimeException('forced failure');
        });

        $this->withoutExceptionHandling()->expectException(\RuntimeException::class);

        try {
            $this->update($vehiculo, ['fotos_eliminar' => $first, 'fotos' => $this->photos(1)]);
        } finally {
            $this->assertSame($files, Storage::disk($this->disk)->allFiles());
            $this->assertSame(7, FotoVehiculo::query()->where('vehiculo_id', $vehiculo->id)->count());
        }
    }

    public function test_buyer_and_guest_cannot_change_photos(): void
    {
        $vehiculo = $this->vehicleOf($this->dealer, 7);

        $this->actingAs(User::factory()->create()->fresh())
            ->post(self::URL.'/'.$vehiculo->id, ['fotos' => $this->photos(1)], ['Accept' => 'application/json'])
            ->assertForbidden();
    }
}
