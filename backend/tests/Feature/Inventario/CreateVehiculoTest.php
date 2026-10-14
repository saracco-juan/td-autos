<?php

namespace Tests\Feature\Inventario;

use App\Http\Middleware\EnsureDealerIsActive;
use App\Models\Concesionaria;
use App\Models\FotoVehiculo;
use App\Models\TipoCarroceria;
use App\Models\User;
use App\Models\Vehiculo;
use App\Models\VehiculoConcesionaria;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * UH21 (RF22, RF25, CU-19): an active dealer loads a vehicle with at least seven photos.
 */
class CreateVehiculoTest extends TestCase
{
    use RefreshDatabase;

    private const URL = '/api/concesionaria/vehiculos';

    /** 1x1 transparent PNG; real image bytes so the `image` rule passes without GD. */
    private const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

    private string $disk;

    protected function setUp(): void
    {
        parent::setUp();

        $this->disk = config('filesystems.vehicle_photos_disk');
        Storage::fake($this->disk);
    }

    /**
     * @return list<UploadedFile>
     */
    private function photos(int $count): array
    {
        return array_map(
            fn (int $n) => UploadedFile::fake()->createWithContent("foto{$n}.png", base64_decode(self::PNG)),
            range(1, $count),
        );
    }

    /**
     * @param  array<string, mixed>  $overrides
     * @return array<string, mixed>
     */
    private function payload(array $overrides = []): array
    {
        return [
            'patente' => 'AB123CD',
            'marca' => 'Toyota',
            'modelo' => 'Corolla',
            'version' => 'XEI 2.0 CVT',
            'anio' => 2021,
            'kilometraje' => 45000,
            'precio' => 25000000,
            'transmision' => 'automatica',
            'combustible' => 'nafta',
            'carroceria_id' => TipoCarroceria::query()->value('id'),
            'ubicacion' => 'Córdoba',
            'descripcion' => 'Único dueño.',
            'fotos' => $this->photos(7),
            ...$overrides,
        ];
    }

    private function dealer(): User
    {
        return Concesionaria::factory()->active()->create()->usuario;
    }

    /**
     * TC-55: an active dealer saves a vehicle with seven photos.
     */
    public function test_tc55_active_dealer_creates_a_vehicle_with_seven_photos(): void
    {
        $user = $this->dealer();

        $response = $this->actingAs($user)->post(self::URL, $this->payload(), ['Accept' => 'application/json']);

        $response->assertCreated()
            ->assertJsonPath('vehiculo.patente', 'AB123CD')
            ->assertJsonPath('vehiculo.marca', 'Toyota')
            ->assertJsonPath('vehiculo.modelo', 'Corolla')
            ->assertJsonPath('vehiculo.version', 'XEI 2.0 CVT')
            ->assertJsonPath('vehiculo.anio', 2021)
            ->assertJsonPath('vehiculo.kilometraje', 45000)
            ->assertJsonPath('vehiculo.precio', 25000000)
            ->assertJsonPath('vehiculo.moneda', 'ARS')
            ->assertJsonPath('vehiculo.transmision', 'automatica')
            ->assertJsonPath('vehiculo.combustible', 'nafta')
            ->assertJsonPath('vehiculo.carroceria.id', TipoCarroceria::query()->value('id'))
            ->assertJsonPath('vehiculo.ubicacion', 'Córdoba')
            ->assertJsonPath('vehiculo.descripcion', 'Único dueño.')
            ->assertJsonCount(7, 'vehiculo.fotos')
            ->assertJsonPath('vehiculo.fotos.0.orden', 1)
            ->assertJsonPath('vehiculo.fotos.6.orden', 7);

        $vehiculo = Vehiculo::query()->firstOrFail();
        $this->assertSame('concesionaria', $vehiculo->origen);
        $this->assertSame('ARS', $vehiculo->moneda);
        $this->assertSame($vehiculo->id, $response->json('vehiculo.id'));

        $ownership = VehiculoConcesionaria::query()->firstOrFail();
        $this->assertSame($vehiculo->id, $ownership->vehiculo_id);
        $this->assertSame($user->concesionaria->id, $ownership->concesionaria_id);
        $this->assertSame('AB123CD', $ownership->patente_normalizada);
        $this->assertTrue($ownership->visible);

        $photos = FotoVehiculo::query()->orderBy('orden')->get();
        $this->assertSame(range(1, 7), $photos->pluck('orden')->all());
        foreach ($photos as $photo) {
            $this->assertStringStartsWith("vehiculos/{$vehiculo->id}/", $photo->ubicacion_archivo);
            Storage::disk($this->disk)->assertExists($photo->ubicacion_archivo);
        }
        $this->assertSame(
            Storage::disk($this->disk)->url($photos[0]->ubicacion_archivo),
            $response->json('vehiculo.fotos.0.url'),
        );
    }

    public function test_optional_fields_can_be_omitted(): void
    {
        $this->actingAs($this->dealer())
            ->post(self::URL, $this->payload(['version' => null, 'descripcion' => null]), ['Accept' => 'application/json'])
            ->assertCreated()
            ->assertJsonPath('vehiculo.version', null)
            ->assertJsonPath('vehiculo.descripcion', null);
    }

    /**
     * TC-56: fewer than seven photos is rejected and nothing is stored.
     */
    public function test_tc56_fewer_than_seven_photos_is_rejected_and_nothing_is_persisted(): void
    {
        $this->actingAs($this->dealer())
            ->post(self::URL, $this->payload(['fotos' => $this->photos(6)]), ['Accept' => 'application/json'])
            ->assertUnprocessable()
            ->assertJsonPath('errors.fotos.0', 'Cargá al menos siete fotos.');

        $this->assertSame(0, Vehiculo::query()->count());
        $this->assertSame(0, FotoVehiculo::query()->count());
        $this->assertSame([], Storage::disk($this->disk)->allFiles());
    }

    public function test_tc56_no_photos_is_rejected_with_the_minimum_message(): void
    {
        $payload = $this->payload();
        unset($payload['fotos']);

        $this->actingAs($this->dealer())
            ->post(self::URL, $payload, ['Accept' => 'application/json'])
            ->assertUnprocessable()
            ->assertJsonPath('errors.fotos.0', 'Cargá al menos siete fotos.');
    }

    public function test_more_than_twenty_photos_is_rejected(): void
    {
        $this->actingAs($this->dealer())
            ->post(self::URL, $this->payload(['fotos' => $this->photos(21)]), ['Accept' => 'application/json'])
            ->assertUnprocessable()
            ->assertJsonPath('errors.fotos.0', 'Podés cargar hasta 20 fotos.');

        $this->assertSame(0, Vehiculo::query()->count());
    }

    public function test_a_file_that_is_not_an_image_is_rejected(): void
    {
        $photos = $this->photos(6);
        $photos[] = UploadedFile::fake()->createWithContent('doc.pdf', '%PDF-1.4 not an image');

        $this->actingAs($this->dealer())
            ->post(self::URL, $this->payload(['fotos' => $photos]), ['Accept' => 'application/json'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['fotos.6' => 'Cada foto tiene que ser una imagen JPG, PNG o WebP.']);

        $this->assertSame(0, Vehiculo::query()->count());
    }

    public function test_a_photo_over_the_size_limit_is_rejected(): void
    {
        $photos = $this->photos(6);
        $photos[] = UploadedFile::fake()->create('grande.png', 5121, 'image/png');

        $this->actingAs($this->dealer())
            ->post(self::URL, $this->payload(['fotos' => $photos]), ['Accept' => 'application/json'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['fotos.6']);
    }

    public function test_plate_is_normalized_before_it_is_stored(): void
    {
        $this->actingAs($this->dealer())
            ->post(self::URL, $this->payload(['patente' => 'ab-123 cd']), ['Accept' => 'application/json'])
            ->assertCreated()
            ->assertJsonPath('vehiculo.patente', 'AB123CD');

        $this->assertSame('AB123CD', VehiculoConcesionaria::query()->value('patente_normalizada'));
    }

    public function test_invalid_plate_is_rejected(): void
    {
        $this->actingAs($this->dealer())
            ->post(self::URL, $this->payload(['patente' => '1234']), ['Accept' => 'application/json'])
            ->assertUnprocessable()
            ->assertJsonPath('errors.patente.0', 'Ingresá una patente válida, por ejemplo AB123CD o ABC123.');
    }

    public function test_plate_owned_by_another_dealer_is_rejected(): void
    {
        VehiculoConcesionaria::factory()->create([
            'concesionaria_id' => Concesionaria::factory()->active()->create()->id,
            'patente_normalizada' => 'AB123CD',
        ]);

        $this->actingAs($this->dealer())
            ->post(self::URL, $this->payload(['patente' => 'ab 123 cd']), ['Accept' => 'application/json'])
            ->assertUnprocessable()
            ->assertJsonPath('errors.patente.0', 'Esa patente ya está cargada en la plataforma.');

        $this->assertSame(0, FotoVehiculo::query()->count());
    }

    public function test_required_fields_are_listed_when_missing(): void
    {
        $this->actingAs($this->dealer())
            ->post(self::URL, [], ['Accept' => 'application/json'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors([
                'patente', 'marca', 'modelo', 'anio', 'kilometraje', 'precio',
                'transmision', 'combustible', 'carroceria_id', 'ubicacion', 'fotos',
            ])
            ->assertJsonPath('errors.patente.0', 'Indicá la patente.')
            ->assertJsonPath('errors.marca.0', 'Indicá la marca.');
    }

    /**
     * @return array<string, array{string, mixed}>
     */
    public static function invalidValues(): array
    {
        return [
            'transmision' => ['transmision', 'semiautomatica'],
            'combustible' => ['combustible', 'vapor'],
            'carroceria' => ['carroceria_id', 9999],
            'year too old' => ['anio', 1949],
            'year too far' => ['anio', 2999],
            'negative mileage' => ['kilometraje', -1],
            'zero price' => ['precio', 0],
        ];
    }

    #[DataProvider('invalidValues')]
    public function test_invalid_values_are_rejected(string $field, mixed $value): void
    {
        $this->actingAs($this->dealer())
            ->post(self::URL, $this->payload([$field => $value]), ['Accept' => 'application/json'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors([$field]);

        $this->assertSame(0, Vehiculo::query()->count());
    }

    public function test_files_are_removed_when_persistence_fails_after_they_were_stored(): void
    {
        $user = $this->dealer();

        // The first photo row is inserted right after its file was stored.
        FotoVehiculo::creating(function () {
            throw new \RuntimeException('forced failure');
        });

        $this->withoutExceptionHandling()->expectException(\RuntimeException::class);

        try {
            $this->actingAs($user)->post(self::URL, $this->payload(), ['Accept' => 'application/json']);
        } finally {
            $this->assertSame([], Storage::disk($this->disk)->allFiles());
            $this->assertSame(0, Vehiculo::query()->count());
        }
    }

    /**
     * TC-45: only approved dealers manage inventory.
     */
    public function test_tc45_pending_dealer_is_forbidden_with_the_pending_message(): void
    {
        $user = Concesionaria::factory()->create()->usuario;

        $this->actingAs($user)
            ->post(self::URL, $this->payload(), ['Accept' => 'application/json'])
            ->assertForbidden()
            ->assertExactJson(['message' => EnsureDealerIsActive::MESSAGE_PENDING]);

        $this->assertSame(0, Vehiculo::query()->count());
    }

    public function test_buyer_is_forbidden(): void
    {
        $this->actingAs(User::factory()->create()->fresh())
            ->post(self::URL, $this->payload(), ['Accept' => 'application/json'])
            ->assertForbidden();
    }

    public function test_guest_is_unauthenticated(): void
    {
        $this->postJson(self::URL, [])->assertUnauthorized();
    }
}
