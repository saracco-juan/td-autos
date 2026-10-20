<?php

namespace Tests\Feature\Inventario;

use App\Models\TipoCarroceria;
use App\Models\Vehiculo;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/** UH-5: safety and comfort are explicit declarations, including absent equipment. */
class EquipmentApiTest extends TestCase
{
    use InteractsWithVehiculos;
    use RefreshDatabase;

    private const URL = '/api/concesionaria/vehiculos';

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpInteractsWithVehiculos();
        TipoCarroceria::query()->firstOrCreate(['nombre' => 'Sedán']);
    }

    #[DataProvider('booleanInputs')]
    public function test_uh5_equipment_round_trips_with_boolean_types(mixed $input, bool $expected): void
    {
        $facts = array_fill_keys(self::EQUIPMENT_FIELDS, $input);
        $payload = $this->payload($facts);
        $created = $this->actingAs($this->dealer())->post(self::URL, $payload, ['Accept' => 'application/json']);
        $created->assertCreated()->assertJsonCount(7, 'vehiculo.fotos');
        $id = $created->json('vehiculo.id');
        $this->assertEquipment($created->json('vehiculo'), $expected);
        $this->assertEquipment(Vehiculo::findOrFail($id)->toArray(), $expected);
        $this->assertEquipment($this->getJson(self::URL.'/'.$id)->assertOk()->json('vehiculo'), $expected);
        $this->assertEquipment($this->getJson(self::URL)->assertOk()->json('vehiculos.0'), $expected);

        unset($payload['fotos']);
        $payload = array_replace($payload, array_fill_keys(self::EQUIPMENT_FIELDS, ! $expected));
        $updated = $this->postJson(self::URL.'/'.$id, $payload)->assertOk()->assertJsonCount(7, 'vehiculo.fotos');
        $this->assertEquipment($updated->json('vehiculo'), ! $expected);
        $this->assertEquipment(Vehiculo::findOrFail($id)->toArray(), ! $expected);
        $this->assertEquipment($this->getJson(self::URL.'/'.$id)->assertOk()->json('vehiculo'), ! $expected);
        $this->assertEquipment($this->getJson(self::URL)->assertOk()->json('vehiculos.0'), ! $expected);
    }

    public static function booleanInputs(): iterable
    {
        foreach ([true, false, 1, 0, '1', '0'] as $index => $value) {
            yield "boolean representation {$index}" => [$value, (bool) $value];
        }
    }

    public function test_uh5_mixed_declarations_are_not_swapped_or_inferred(): void
    {
        $facts = [];
        foreach (self::EQUIPMENT_FIELDS as $index => $field) {
            $facts[$field] = $index % 2 === 0;
        }
        $payload = $this->payload($facts);
        $created = $this->actingAs($this->dealer())->post(self::URL, $payload, ['Accept' => 'application/json'])->assertCreated();
        $id = $created->json('vehiculo.id');
        $this->assertSame($facts, array_intersect_key($created->json('vehiculo'), $facts));
        unset($payload['fotos']);
        $facts = array_map(fn (bool $value) => ! $value, $facts);
        $updated = $this->postJson(self::URL.'/'.$id, array_replace($payload, $facts))->assertOk();
        $this->assertSame($facts, array_intersect_key($updated->json('vehiculo'), $facts));
        $this->assertDatabaseHas('vehiculo', ['id' => $id, ...$facts]);
    }

    #[DataProvider('invalidEquipment')]
    public function test_uh5_invalid_or_missing_equipment_rejects_both_writes(string $field, mixed $value, bool $omit): void
    {
        $user = $this->dealer();
        $vehicle = $this->vehicleOf($user->concesionaria);
        $before = $this->inventorySnapshot();
        $payload = $this->payload([$field => $value]);
        if ($omit) {
            unset($payload[$field]);
        }

        $this->actingAs($user);
        foreach ([self::URL, self::URL.'/'.$vehicle->id] as $url) {
            $response = $this->post($url, $payload, ['Accept' => 'application/json']);
            $response->assertUnprocessable()->assertJsonValidationErrors($field);
            $this->assertStringStartsWith('Indicá si tiene ', $response->json("errors.{$field}.0"));
            $this->assertSame($before, $this->inventorySnapshot());
        }
    }

    public static function invalidEquipment(): iterable
    {
        foreach (self::EQUIPMENT_FIELDS as $field) {
            yield "missing {$field}" => [$field, null, true];
            yield "unknown {$field}" => [$field, null, false];
            yield "empty {$field}" => [$field, '', false];
            yield "invalid {$field}" => [$field, 'yes', false];
        }
    }

    public function test_uh5_all_missing_equipment_fields_are_reported_together(): void
    {
        $payload = array_diff_key($this->payload(), array_flip(self::EQUIPMENT_FIELDS));
        $response = $this->actingAs($this->dealer())->post(self::URL, $payload, ['Accept' => 'application/json']);
        $response->assertUnprocessable()->assertJsonValidationErrors(self::EQUIPMENT_FIELDS)
            ->assertJsonCount(count(self::EQUIPMENT_FIELDS), 'errors')
            ->assertJsonPath('errors.android_auto_apple_carplay.0', 'Indicá si tiene Android Auto o Apple CarPlay (sí o no).');
        $this->assertDatabaseCount('vehiculo', 0);
        $this->assertSame([], Storage::disk($this->disk)->allFiles());
    }

    public function test_uh5_legacy_reads_preserve_unknown_equipment_without_writes(): void
    {
        $user = $this->dealer();
        $vehicle = $this->vehicleOf($user->concesionaria);
        $before = $this->inventorySnapshot();
        $this->actingAs($user);
        $this->assertEquipment($this->getJson(self::URL.'/'.$vehicle->id)->assertOk()->json('vehiculo'), null);
        $this->assertEquipment($this->getJson(self::URL)->assertOk()->json('vehiculos.0'), null);
        $this->assertSame($before, $this->inventorySnapshot());
    }

    private function assertEquipment(array $actual, ?bool $expected): void
    {
        foreach (self::EQUIPMENT_FIELDS as $field) {
            $this->assertArrayHasKey($field, $actual);
            $this->assertSame($expected, $actual[$field], $field);
        }
        $this->assertArrayNotHasKey('android_auto', $actual);
        $this->assertArrayNotHasKey('apple_carplay', $actual);
    }

    private function inventorySnapshot(): string
    {
        $state = [];
        foreach (['vehiculo', 'vehiculo_concesionaria', 'foto_vehiculo'] as $table) {
            $state[$table] = DB::table($table)->orderBy('id')->get()->toJson();
        }
        foreach (Storage::disk($this->disk)->allFiles() as $path) {
            $state[$path] = hash('sha256', Storage::disk($this->disk)->get($path));
        }

        return hash('sha256', serialize($state));
    }
}
