<?php

namespace Tests\Feature\Vehiculo;

use App\Models\Vehiculo;
use Illuminate\Database\PostgresConnection;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/** UH-5/S2: persist declared facts without inferring unknown equipment or capacity. */
class VehiculoMatchingFactsTest extends TestCase
{
    use RefreshDatabase;

    private const EQUIPMENT = [
        'control_estabilidad',
        'frenos_abs',
        'airbags_frontales',
        'airbags_laterales',
        'airbags_cortina',
        'isofix',
        'frenado_autonomo',
        'asistencia_carril',
        'punto_ciego',
        'recordatorio_cinturon',
        'asistencia_velocidad',
        'monitoreo_conductor',
        'volante_regulable',
        'climatizador_bizona',
        'butacas_calefaccionadas',
        'android_auto_apple_carplay',
        'sensores_estacionamiento',
        'velocidad_crucero',
        'camara_retroceso',
        'aire_acondicionado',
    ];

    private const NEW_FIELDS = [
        'plazas', 'turbo', 'potencia_unidad', 'consumo_urbano', 'consumo_ruta',
        ...self::EQUIPMENT,
    ];

    #[DataProvider('equipmentStates')]
    public function test_uh05_declared_facts_round_trip_with_their_types(bool $present): void
    {
        $facts = [
            'plazas' => 5,
            'turbo' => $present,
            'potencia_unidad' => 'CV',
            'consumo_urbano' => '8.25',
            'consumo_ruta' => '5.50',
            ...array_fill_keys(self::EQUIPMENT, $present),
        ];
        $existing = ['motor' => '1.4', 'potencia' => 150, 'moneda' => 'USD'];

        $vehicle = Vehiculo::create(['origen' => 'concesionaria', ...$existing, ...$facts])->fresh();

        $this->assertFalse(Schema::hasColumn('vehiculo', 'android_auto'));
        $this->assertFalse(Schema::hasColumn('vehiculo', 'apple_carplay'));
        foreach ([...$existing, ...$facts] as $field => $value) {
            $this->assertSame($value, $vehicle->getAttribute($field), $field);
        }
        $this->assertDatabaseHas('vehiculo', ['id' => $vehicle->id, ...$existing, ...$facts]);
    }

    public static function equipmentStates(): array
    {
        return ['present' => [true], 'explicitly absent' => [false]];
    }

    public function test_uh05_unspecified_facts_remain_unknown_not_false_or_inferred(): void
    {
        $vehicle = Vehiculo::create(['origen' => 'concesionaria', 'modelo' => 'Corolla'])->fresh();

        foreach (self::NEW_FIELDS as $field) {
            $this->assertArrayHasKey($field, $vehicle->getAttributes());
            $this->assertNull($vehicle->getAttribute($field), $field);
        }
    }

    public function test_uh05_migration_and_rollback_preserve_existing_vehicle_data(): void
    {
        $paths = glob(database_path('migrations/*_add_matching_facts_to_vehiculo_table.php'));
        $this->assertCount(1, $paths);
        $migration = require $paths[0];
        $migration->down();

        $id = DB::table('vehiculo')->insertGetId([
            'origen' => 'concesionaria', 'marca' => 'Toyota', 'modelo' => 'Corolla',
            'moneda' => 'ARS', 'precio' => 25000000, 'motor' => '2.0', 'potencia' => 170,
        ]);
        $before = (array) DB::table('vehiculo')->find($id);

        $migration->up();

        $after = (array) DB::table('vehiculo')->find($id);
        $this->assertSame($before, array_intersect_key($after, $before));
        foreach (self::NEW_FIELDS as $field) {
            $this->assertArrayHasKey($field, $after);
            $this->assertNull($after[$field], $field);
        }

        Vehiculo::findOrFail($id)->update(['plazas' => 5, 'turbo' => false]);
        $migration->down();

        $this->assertSame($before, (array) DB::table('vehiculo')->find($id));
        foreach (self::NEW_FIELDS as $field) {
            $this->assertFalse(Schema::hasColumn('vehiculo', $field), $field);
        }
        $this->assertSame(1, DB::table('vehiculo')->count());

        $migration->up();
    }

    public function test_uh05_postgresql_schema_compiles_without_connecting(): void
    {
        $connection = new PostgresConnection(function () {
            throw new \LogicException('This test must never open a database connection.');
        });
        $originalSchema = Schema::getFacadeRoot();
        Schema::swap($connection->getSchemaBuilder());

        try {
            $paths = glob(database_path('migrations/*_add_matching_facts_to_vehiculo_table.php'));
            $migration = require $paths[0];
            $queries = $connection->pretend(fn () => $migration->up());
            $sql = implode("\n", array_column($queries, 'query'));
            foreach ([
                'plazas' => 'smallint', 'turbo' => 'boolean', 'potencia_unidad' => 'varchar(10)',
                'consumo_urbano' => 'decimal(6, 2)', 'consumo_ruta' => 'decimal(6, 2)',
                ...array_fill_keys(self::EQUIPMENT, 'boolean'),
            ] as $field => $type) {
                $this->assertStringContainsString('"'.$field.'" '.$type.' null', $sql);
            }
            $this->assertStringNotContainsString('default', $sql);

            $queries = $connection->pretend(fn () => $migration->down());
            $sql = implode("\n", array_column($queries, 'query'));
            foreach (self::NEW_FIELDS as $field) {
                $this->assertStringContainsString('drop column "'.$field.'"', $sql);
            }
        } finally {
            Schema::swap($originalSchema);
        }
    }
}
