<?php

namespace Tests\Feature\Inventario;

use App\Models\TipoCarroceria;
use App\Models\Vehiculo;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/** UH-5: declared core matching facts survive the dealer API without inferred values. */
class MatchingFactsApiTest extends TestCase
{
    use InteractsWithVehiculos;
    use RefreshDatabase;

    private const URL = '/api/concesionaria/vehiculos';

    private const FIELDS = [
        'moneda', 'plazas', 'motor', 'turbo', 'potencia', 'potencia_unidad',
        'consumo_urbano', 'consumo_ruta',
    ];

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpInteractsWithVehiculos();
        TipoCarroceria::query()->firstOrCreate(['nombre' => 'Sedán']);
    }

    public function test_uh5_core_facts_round_trip_through_create_update_show_and_list(): void
    {
        $user = $this->dealer();
        $payload = $this->payload(['moneda' => 'USD']);
        $facts = array_intersect_key($payload, array_flip(self::FIELDS));
        $created = $this->actingAs($user)->post(self::URL, $payload, ['Accept' => 'application/json']);
        $created->assertCreated()->assertJsonCount(7, 'vehiculo.fotos');
        $id = $created->json('vehiculo.id');
        $shown = $this->getJson(self::URL.'/'.$id)->assertOk();
        $listed = $this->getJson(self::URL)->assertOk();

        foreach ($facts as $field => $value) {
            $created->assertJsonPath("vehiculo.{$field}", $value);
            $shown->assertJsonPath("vehiculo.{$field}", $value);
            $listed->assertJsonPath("vehiculos.0.{$field}", $value);
        }
        $this->assertDatabaseHas('vehiculo', ['id' => $id, ...$facts]);

        Vehiculo::findOrFail($id)->update(['android_auto_apple_carplay' => true]);
        $edited = $this->payload([
            'moneda' => 'ARS', 'plazas' => 7, 'motor' => '2.0T', 'turbo' => '1',
            'potencia' => 140, 'potencia_unidad' => 'kW',
            'consumo_urbano' => 9.75, 'consumo_ruta' => 6.25,
        ]);
        unset($edited['fotos']);
        $facts = array_intersect_key($edited, array_flip(self::FIELDS));
        $facts['turbo'] = true;
        $updated = $this->post(self::URL.'/'.$id, $edited, ['Accept' => 'application/json']);
        $updated->assertOk()->assertJsonCount(7, 'vehiculo.fotos');
        $shown = $this->getJson(self::URL.'/'.$id)->assertOk();
        foreach ($facts as $field => $value) {
            $updated->assertJsonPath("vehiculo.{$field}", $value);
            $shown->assertJsonPath("vehiculo.{$field}", $value);
        }
        $this->assertDatabaseHas('vehiculo', ['id' => $id, ...$facts, 'android_auto_apple_carplay' => true]);
    }

    #[DataProvider('invalidFacts')]
    public function test_uh5_invalid_facts_reject_create_and_update_without_writes(string $field, mixed $value, string $fuel = 'nafta'): void
    {
        $user = $this->dealer();
        $vehicle = $this->vehicleOf($user->concesionaria);
        $before = $vehicle->fresh()->getRawOriginal();
        $files = Storage::disk($this->disk)->allFiles();
        $payload = $this->payload([$field => $value, 'combustible' => $fuel]);

        $this->actingAs($user)->post(self::URL, $payload, ['Accept' => 'application/json'])
            ->assertUnprocessable()->assertJsonValidationErrors($field);
        unset($payload['fotos']);
        $this->post(self::URL.'/'.$vehicle->id, $payload, ['Accept' => 'application/json'])
            ->assertUnprocessable()->assertJsonValidationErrors($field);

        $this->assertDatabaseCount('vehiculo', 1);
        $this->assertDatabaseCount('vehiculo_concesionaria', 1);
        $this->assertDatabaseCount('foto_vehiculo', 7);
        $this->assertSame($before, $vehicle->fresh()->getRawOriginal());
        $this->assertDatabaseHas('vehiculo_concesionaria', ['vehiculo_id' => $vehicle->id, 'patente_normalizada' => 'XY987ZW']);
        $this->assertSame($files, Storage::disk($this->disk)->allFiles());
    }

    public static function invalidFacts(): iterable
    {
        foreach (self::FIELDS as $field) {
            yield "required {$field}" => [$field, null];
        }
        yield 'currency' => ['moneda', 'EUR'];
        yield 'seats zero' => ['plazas', 0];
        yield 'seats fractional' => ['plazas', 4.5];
        yield 'seats storage overflow' => ['plazas', 32768];
        yield 'engine type' => ['motor', []];
        yield 'engine length' => ['motor', str_repeat('x', 101)];
        yield 'explicit turbo' => ['turbo', 'maybe'];
        yield 'power zero' => ['potencia', 0];
        yield 'power fractional' => ['potencia', 100.5];
        yield 'power storage overflow' => ['potencia', 2147483648];
        yield 'power unit' => ['potencia_unidad', 'watts'];
        foreach (['consumo_urbano', 'consumo_ruta'] as $field) {
            yield "diesel requires {$field}" => [$field, null, 'diesel'];
            yield "zero {$field}" => [$field, 0];
            yield "negative {$field}" => [$field, -1];
            yield "precision {$field}" => [$field, 8.125];
            yield "storage overflow {$field}" => [$field, 10000];
        }
    }

    #[DataProvider('optionalConsumptionFuels')]
    public function test_uh5_other_fuels_can_be_published_without_invented_consumption(string $fuel): void
    {
        $this->actingAs($this->dealer())->post(self::URL, $this->payload([
            'combustible' => $fuel, 'potencia_unidad' => 'HP', 'turbo' => '0',
            'consumo_urbano' => null, 'consumo_ruta' => null,
        ]), ['Accept' => 'application/json'])
            ->assertCreated()->assertJsonPath('vehiculo.turbo', false)
            ->assertJsonPath('vehiculo.potencia_unidad', 'HP')
            ->assertJsonPath('vehiculo.consumo_urbano', null)->assertJsonPath('vehiculo.consumo_ruta', null);
        $this->assertDatabaseHas('vehiculo', ['combustible' => $fuel, 'consumo_urbano' => null, 'consumo_ruta' => null]);
    }

    public static function optionalConsumptionFuels(): iterable
    {
        foreach (['gnc', 'hibrido', 'electrico'] as $fuel) {
            yield $fuel => [$fuel];
        }
    }

    public function test_uh5_reading_a_legacy_vehicle_keeps_unknown_facts_null(): void
    {
        $user = $this->dealer();
        $vehicle = $this->vehicleOf($user->concesionaria);
        $response = $this->actingAs($user)->getJson(self::URL.'/'.$vehicle->id)->assertOk();
        foreach (['plazas', 'turbo', 'potencia_unidad', 'consumo_urbano', 'consumo_ruta'] as $field) {
            $response->assertJsonStructure(['vehiculo' => [$field]])->assertJsonPath("vehiculo.{$field}", null);
        }
    }
}
