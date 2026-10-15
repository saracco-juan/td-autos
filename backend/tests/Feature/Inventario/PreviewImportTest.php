<?php

namespace Tests\Feature\Inventario;

use App\Http\Middleware\EnsureDealerIsActive;
use App\Models\Concesionaria;
use App\Models\FotoVehiculo;
use App\Models\User;
use App\Models\Vehiculo;
use App\Models\VehiculoConcesionaria;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Testing\TestResponse;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * UH22 (RF21, RF23, RF24, RF25, CU-20): the dry run of the CSV import. It validates the whole
 * batch, counts new and updated vehicles and lists every error, without writing anything.
 */
class PreviewImportTest extends TestCase
{
    use InteractsWithImportCsv;
    use InteractsWithVehiculos;
    use RefreshDatabase;

    private const URL = '/api/concesionaria/vehiculos/importar/vista-previa';

    private function preview(User $user, UploadedFile $file): TestResponse
    {
        return $this->actingAs($user)->post(self::URL, ['archivo' => $file], ['Accept' => 'application/json']);
    }

    /**
     * @param  list<array<string, string>>  $rows
     */
    private function previewRows(User $user, array $rows, string $separator = ';'): TestResponse
    {
        return $this->preview($user, $this->csvFile($this->csvContent($rows, $separator)));
    }

    /**
     * @return list<array{fila: int, patente: ?string, mensajes: list<string>}>
     */
    private function errorsOf(TestResponse $response): array
    {
        $response->assertUnprocessable()
            ->assertJsonPath('message', 'El archivo tiene errores. No se aplicó ningún cambio.');

        return $response->json('errores');
    }

    public function test_valid_batch_counts_new_and_updated_vehicles_and_persists_nothing(): void
    {
        $user = $this->dealer();
        $this->vehicleOf($user->concesionaria, 7, 'XY987ZW');
        $vehicles = Vehiculo::query()->count();
        $photos = FotoVehiculo::query()->count();

        $this->previewRows($user, [
            $this->csvRow(['patente' => 'xy-987-zw']),
            $this->csvRow(['patente' => 'AB123CD']),
            $this->csvRow(['patente' => 'ABC123']),
        ])->assertOk()->assertExactJson(['nuevos' => 2, 'actualizaciones' => 1]);

        $this->assertSame($vehicles, Vehiculo::query()->count());
        $this->assertSame($photos, FotoVehiculo::query()->count());
        $this->assertSame(1, VehiculoConcesionaria::query()->count());
    }

    /**
     * @return array<string, array{string, bool}>
     */
    public static function formats(): array
    {
        return [
            'semicolon' => [';', false],
            'comma' => [',', false],
            'semicolon with BOM' => [';', true],
            'comma with BOM' => [',', true],
        ];
    }

    #[DataProvider('formats')]
    public function test_reads_both_separators_with_or_without_bom(string $separator, bool $bom): void
    {
        $content = $this->csvContent([$this->csvRow(), $this->csvRow(['patente' => 'ABC123'])], $separator, $bom);

        $this->preview($this->dealer(), $this->csvFile($content))
            ->assertOk()->assertExactJson(['nuevos' => 2, 'actualizaciones' => 0]);
    }

    public function test_headers_may_come_in_any_order_and_case_and_optional_columns_may_be_absent(): void
    {
        $headers = ['FOTOS', ' Carroceria ', 'Patente', 'precio', 'KILOMETRAJE', 'anio', 'combustible', 'transmision', 'marca', 'modelo', 'ubicacion'];
        $content = $this->csvContent([$this->csvRow()], ';', false, $headers);

        $this->preview($this->dealer(), $this->csvFile($content))
            ->assertOk()->assertExactJson(['nuevos' => 1, 'actualizaciones' => 0]);
    }

    public function test_optional_cells_may_be_empty_and_the_body_type_ignores_case_and_accents(): void
    {
        $this->previewRows($this->dealer(), [
            $this->csvRow(['version' => '', 'descripcion' => '', 'carroceria' => 'SEDAN']),
        ])->assertOk()->assertExactJson(['nuevos' => 1, 'actualizaciones' => 0]);
    }

    public function test_tc59_fewer_than_seven_photo_urls_reject_the_batch(): void
    {
        $errors = $this->errorsOf($this->previewRows($this->dealer(), [
            $this->csvRow(),
            $this->csvRow(['patente' => 'ABC123', 'fotos' => $this->photoCell(6)]),
        ]));

        $this->assertSame([['fila' => 3, 'patente' => 'ABC123', 'mensajes' => ['Cargá al menos siete fotos.']]], $errors);
    }

    public function test_more_than_twenty_photo_urls_reject_the_batch(): void
    {
        $errors = $this->errorsOf($this->previewRows($this->dealer(), [$this->csvRow(['fotos' => $this->photoCell(21)])]));

        $this->assertSame(['Podés cargar hasta 20 fotos.'], $errors[0]['mensajes']);
    }

    public function test_photo_urls_ignore_spaces_and_empty_pieces(): void
    {
        $cell = ' '.str_replace('|', ' | ', $this->photoCell(7)).' || ';

        $this->previewRows($this->dealer(), [$this->csvRow(['fotos' => $cell])])
            ->assertOk()->assertExactJson(['nuevos' => 1, 'actualizaciones' => 0]);
    }

    public function test_photo_urls_must_be_http_or_https(): void
    {
        $cell = $this->photoCell(6).'|ftp://cdn.example.com/7.jpg|javascript:alert(1)';

        $errors = $this->errorsOf($this->previewRows($this->dealer(), [$this->csvRow(['fotos' => $cell])]));

        $this->assertSame([
            'La foto 7 no es una URL válida: tiene que empezar con http:// o https://.',
            'La foto 8 no es una URL válida: tiene que empezar con http:// o https://.',
        ], $errors[0]['mensajes']);
    }

    public function test_an_empty_photo_cell_asks_for_the_photos(): void
    {
        $errors = $this->errorsOf($this->previewRows($this->dealer(), [$this->csvRow(['fotos' => ''])]));

        $this->assertSame(['Cargá al menos siete fotos.'], $errors[0]['mensajes']);
    }

    public function test_tc60_a_plate_repeated_in_the_file_is_an_error_on_every_repeated_row(): void
    {
        $errors = $this->errorsOf($this->previewRows($this->dealer(), [
            $this->csvRow(['patente' => 'ab 123 cd']),
            $this->csvRow(['patente' => 'ABC123']),
            $this->csvRow(['patente' => 'AB-123-CD']),
        ]));

        $message = 'La patente AB123CD está repetida en el archivo.';
        $this->assertSame([
            ['fila' => 2, 'patente' => 'AB123CD', 'mensajes' => [$message]],
            ['fila' => 4, 'patente' => 'AB123CD', 'mensajes' => [$message]],
        ], $errors);
    }

    public function test_tc82_a_plate_of_another_dealership_is_an_error_that_does_not_name_it(): void
    {
        $other = Concesionaria::factory()->active()->create(['nombre' => 'Autos del Sur']);
        $this->vehicleOf($other, 7, 'AB123CD');

        $response = $this->previewRows($this->dealer(), [$this->csvRow()]);

        $errors = $this->errorsOf($response);
        $this->assertSame([['fila' => 2, 'patente' => 'AB123CD', 'mensajes' => ['Esa patente ya está cargada en la plataforma.']]], $errors);
        $this->assertStringNotContainsString('Autos del Sur', $response->getContent());
    }

    /**
     * @return array<string, array{array<string, string>, string}>
     */
    public static function invalidFields(): array
    {
        return [
            'plate missing' => [['patente' => ''], 'Indicá la patente.'],
            'plate format' => [['patente' => 'ZZ99'], 'Ingresá una patente válida, por ejemplo AB123CD o ABC123.'],
            'brand missing' => [['marca' => ''], 'Indicá la marca.'],
            'brand too long' => [['marca' => str_repeat('a', 101)], 'Revisá la marca: no puede superar los 100 caracteres.'],
            'year out of range' => [['anio' => '1900'], 'Revisá el año: está fuera del rango permitido.'],
            'year not a number' => [['anio' => 'dos mil'], 'Revisá el año: tiene que ser un número entero.'],
            'mileage negative' => [['kilometraje' => '-5'], 'Revisá el kilometraje: está fuera del rango permitido.'],
            'price not a number' => [['precio' => 'caro'], 'Revisá el precio: tiene que ser un número.'],
            'transmission unknown' => [['transmision' => 'cvt'], 'Elegí la transmisión de la lista.'],
            'fuel unknown' => [['combustible' => 'vapor'], 'Elegí el combustible de la lista.'],
            'body type unknown' => [['carroceria' => 'Zeppelin'], 'Elegí la carrocería de la lista.'],
            'body type missing' => [['carroceria' => ''], 'Elegí la carrocería.'],
            'location missing' => [['ubicacion' => ''], 'Indicá la ubicación.'],
        ];
    }

    /**
     * @param  array<string, string>  $override
     */
    #[DataProvider('invalidFields')]
    public function test_field_rules_are_the_ones_of_the_manual_form(array $override, string $message): void
    {
        $errors = $this->errorsOf($this->previewRows($this->dealer(), [$this->csvRow($override)]));

        $this->assertSame(2, $errors[0]['fila']);
        $this->assertContains($message, $errors[0]['mensajes']);
    }

    public function test_every_error_is_listed_ordered_by_physical_row(): void
    {
        $content = $this->csvContent([
            $this->csvRow(['anio' => '1900', 'transmision' => 'cvt']),
            $this->csvRow(['patente' => 'ABC123']),
            $this->csvRow(['patente' => 'DEF456', 'fotos' => $this->photoCell(2)]),
        ]);
        $lines = explode("\r\n", $content);
        array_splice($lines, 3, 0, ['', ';;;;;;;;;;;;']);

        $errors = $this->errorsOf($this->preview($this->dealer(), $this->csvFile(implode("\r\n", $lines))));

        $this->assertSame([
            ['fila' => 2, 'patente' => 'AB123CD', 'mensajes' => ['Revisá el año: está fuera del rango permitido.', 'Elegí la transmisión de la lista.']],
            ['fila' => 6, 'patente' => 'DEF456', 'mensajes' => ['Cargá al menos siete fotos.']],
        ], $errors);
    }

    public function test_a_dealer_can_repeat_the_import_of_its_own_plates(): void
    {
        $user = $this->dealer();
        $this->vehicleOf($user->concesionaria, 7, 'AB123CD');

        $this->previewRows($user, [$this->csvRow()])
            ->assertOk()->assertExactJson(['nuevos' => 0, 'actualizaciones' => 1]);
    }

    /**
     * @return array<string, array{string, string}>
     */
    public static function unreadableFiles(): array
    {
        $header = 'patente;marca;modelo;anio;kilometraje;precio;transmision;combustible;carroceria;ubicacion;fotos';

        return [
            'empty' => ['', 'El archivo está vacío.'],
            'header only' => [$header."\r\n", 'El archivo no tiene filas para importar.'],
            'missing headers' => ["patente;marca\r\nAB123CD;Toyota\r\n", 'Faltan las columnas obligatorias: modelo, anio, kilometraje, precio, transmision, combustible, carroceria, ubicacion, fotos.'],
        ];
    }

    #[DataProvider('unreadableFiles')]
    public function test_file_level_errors_use_the_standard_validation_shape(string $content, string $message): void
    {
        $this->preview($this->dealer(), $this->csvFile($content))
            ->assertUnprocessable()
            ->assertJsonPath('errors.archivo', [$message]);
    }

    public function test_more_than_five_hundred_rows_are_rejected(): void
    {
        $rows = array_map(fn (int $n) => $this->csvRow(['patente' => 'AB'.str_pad((string) $n, 3, '0', STR_PAD_LEFT).'CD']), range(1, 501));

        $this->preview($this->dealer(), $this->csvFile($this->csvContent($rows)))
            ->assertUnprocessable()
            ->assertJsonPath('errors.archivo', ['El archivo supera el máximo de 500 filas.']);
    }

    public function test_exactly_five_hundred_rows_are_accepted(): void
    {
        $rows = array_map(fn (int $n) => $this->csvRow(['patente' => 'AB'.str_pad((string) $n, 3, '0', STR_PAD_LEFT).'CD']), range(1, 500));

        $this->preview($this->dealer(), $this->csvFile($this->csvContent($rows)))
            ->assertOk()->assertExactJson(['nuevos' => 500, 'actualizaciones' => 0]);
    }

    public function test_the_file_must_be_present_a_csv_and_at_most_two_megabytes(): void
    {
        $user = $this->dealer();

        $this->actingAs($user)->post(self::URL, [], ['Accept' => 'application/json'])
            ->assertUnprocessable()->assertJsonPath('errors.archivo', ['Elegí un archivo CSV.']);

        $this->preview($user, UploadedFile::fake()->create('stock.pdf', 10, 'application/pdf'))
            ->assertUnprocessable()->assertJsonPath('errors.archivo', ['El archivo tiene que ser un CSV.']);

        $this->preview($user, UploadedFile::fake()->createWithContent('stock.csv', str_repeat('a', 2049 * 1024)))
            ->assertUnprocessable()->assertJsonPath('errors.archivo', ['El archivo puede pesar hasta 2 MB.']);
    }

    public function test_tc45_pending_dealer_is_forbidden_with_the_pending_message(): void
    {
        $user = Concesionaria::factory()->create()->usuario;

        $this->previewRows($user, [$this->csvRow()])
            ->assertForbidden()
            ->assertExactJson(['message' => EnsureDealerIsActive::MESSAGE_PENDING]);
    }

    public function test_buyer_is_forbidden(): void
    {
        $this->previewRows(User::factory()->create()->fresh(), [$this->csvRow()])->assertForbidden();
    }

    public function test_guest_is_unauthenticated(): void
    {
        $this->postJson(self::URL, [])->assertUnauthorized();
    }
}
