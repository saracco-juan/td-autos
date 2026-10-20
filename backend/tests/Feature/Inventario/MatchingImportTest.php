<?php

namespace Tests\Feature\Inventario;

use App\Models\Vehiculo;
use App\Services\Inventario\VehiculoCsvReader;
use App\Support\VehiculoFields;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/** UH-5 S3: complete declared facts through the existing preview/confirm contract. */
class MatchingImportTest extends TestCase
{
    use InteractsWithImportCsv;
    use InteractsWithVehiculos;
    use RefreshDatabase;

    private const URL = '/api/concesionaria/vehiculos/importar';

    public function test_complete_facts_survive_preview_create_and_overwrite(): void
    {
        $user = $this->dealer();
        $existing = $this->vehicleOf($user->concesionaria, 7, 'ABC123');
        $row = $this->csvRow(['moneda' => 'USD', 'turbo' => ' Sí ', 'potencia_unidad' => 'HP', 'consumo_urbano' => '8.50', 'consumo_ruta' => '6.20']);
        foreach (self::EQUIPMENT_FIELDS as $index => $field) {
            $row[$field] = $index % 2 === 0 ? 'SÍ' : 'No';
        }
        $rows = [$row, [...$row, 'patente' => 'ABC123']];
        $before = $existing->fresh()->getAttributes();
        $this->actingAs($user)->postJson(self::URL.'/vista-previa', [
            'archivo' => $this->csvFile($this->csvContent($rows)),
        ])->assertOk()->assertExactJson(['nuevos' => 1, 'actualizaciones' => 1]);
        $this->assertSame($before, $existing->fresh()->getAttributes());
        $this->assertDatabaseCount('vehiculo', 1);

        $this->postJson(self::URL, ['archivo' => $this->csvFile($this->csvContent($rows))])
            ->assertOk()->assertExactJson(['nuevos' => 1, 'actualizaciones' => 1]);
        foreach (Vehiculo::all() as $vehicle) {
            foreach (['moneda', 'plazas', 'motor', 'potencia', 'potencia_unidad', 'consumo_urbano', 'consumo_ruta'] as $field) {
                $this->assertEquals($row[$field], $vehicle->$field, $field);
            }
            $this->assertTrue($vehicle->turbo);
            foreach (self::EQUIPMENT_FIELDS as $index => $field) {
                $this->assertSame($index % 2 === 0, $vehicle->$field, $field);
            }
        }
    }

    public static function invalidFacts(): iterable
    {
        foreach (['moneda', 'plazas', 'motor', 'turbo', 'potencia', 'potencia_unidad', 'consumo_urbano', 'consumo_ruta', ...self::EQUIPMENT_FIELDS] as $field) {
            yield "missing $field" => [$field, '', ''];
        }
        foreach (['turbo', ...self::EQUIPMENT_FIELDS] as $field) {
            yield "invalid $field" => [$field, 'tal vez', ''];
        }
        yield 'invalid seats' => ['plazas', '0', ''];
        yield 'invalid currency' => ['moneda', 'EUR', ''];
        yield 'invalid power' => ['potencia', '0', ''];
        yield 'invalid unit' => ['potencia_unidad', 'watts', ''];
        yield 'numeric boolean is not a declared yes/no' => ['turbo', '1', ''];
        yield 'invalid urban' => ['consumo_urbano', '0', ''];
        yield 'invalid road' => ['consumo_ruta', '-1', ''];
        yield 'preview rejects missing equipment' => ['frenos_abs', '', '/vista-previa'];
    }

    #[DataProvider('invalidFacts')]
    public function test_invalid_fact_reports_row_and_field_without_partial_writes(string $field, string $value, string $suffix): void
    {
        $user = $this->dealer();
        $existing = $this->vehicleOf($user->concesionaria, 7, 'ABC123');
        $before = $existing->fresh()->getAttributes();
        $response = $this->actingAs($user)->postJson(self::URL.$suffix, ['archivo' => $this->csvFile($this->csvContent([
            $this->csvRow(),
            $this->csvRow(['patente' => 'ABC123', $field => $value]),
        ]))])->assertUnprocessable()->assertJsonPath('errores.0.fila', 3);
        $messages = VehiculoFields::messages();
        $expected = $messages["$field.required"] ?? $messages["$field.required_if"];
        $this->assertContains($expected, $response->json('errores.0.mensajes'));
        $this->assertSame($before, $existing->fresh()->getAttributes());
        $this->assertDatabaseCount('vehiculo', 1);
        $this->assertDatabaseCount('foto_vehiculo', 7);
    }

    public function test_old_template_requires_download_instead_of_invented_facts(): void
    {
        $headers = array_slice(self::CSV_HEADERS, 0, 13);
        $this->actingAs($this->dealer())->postJson(self::URL.'/vista-previa', [
            'archivo' => $this->csvFile($this->csvContent([$this->csvRow()], headers: $headers)),
        ])->assertUnprocessable()->assertJsonValidationErrors('archivo')
            ->assertJsonPath('message', fn (string $message) => str_ends_with($message, 'Descargá la plantilla actualizada.'));
        $this->assertDatabaseCount('vehiculo', 0);
    }

    public function test_gnc_blank_consumptions_clear_previous_values_on_overwrite(): void
    {
        $user = $this->dealer();
        $existing = $this->vehicleOf($user->concesionaria, 7, 'ABC123');
        $existing->update(['consumo_urbano' => 9, 'consumo_ruta' => 7]);
        $row = $this->csvRow(['patente' => 'ABC123', 'combustible' => 'gnc', 'consumo_urbano' => '', 'consumo_ruta' => '']);
        $this->actingAs($user)->postJson(self::URL, ['archivo' => $this->csvFile($this->csvContent([$row]))])->assertOk();
        $this->assertNull($existing->fresh()->consumo_urbano);
        $this->assertNull($existing->fresh()->consumo_ruta);
    }

    public function test_template_declares_every_matching_column(): void
    {
        $rows = (new VehiculoCsvReader)->read(file_get_contents(base_path('../frontend/web/public/plantilla-inventario.csv')));
        foreach (self::CSV_HEADERS as $field) {
            $this->assertArrayHasKey($field, $rows[0]['data']);
        }
    }
}
