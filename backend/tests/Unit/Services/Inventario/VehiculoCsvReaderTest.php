<?php

namespace Tests\Unit\Services\Inventario;

use App\Services\Inventario\ImportFileException;
use App\Services\Inventario\VehiculoCsvReader;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

class VehiculoCsvReaderTest extends TestCase
{
    private const HEADER = 'patente;marca;modelo;anio;kilometraje;precio;transmision;combustible;carroceria;ubicacion;fotos';

    private const ROW = 'AB123CD;Toyota;Corolla;2021;45000;25000000;manual;nafta;Sedán;Córdoba;http://a/1.jpg';

    private function reader(): VehiculoCsvReader
    {
        return new VehiculoCsvReader;
    }

    /**
     * @return array<string, array{string}>
     */
    public static function separators(): array
    {
        return ['semicolon' => [';'], 'comma' => [',']];
    }

    #[DataProvider('separators')]
    public function test_detects_the_separator_from_the_header_line(string $separator): void
    {
        $content = str_replace(';', $separator, self::HEADER."\n".self::ROW."\n");

        $rows = $this->reader()->read($content);

        $this->assertCount(1, $rows);
        $this->assertSame('Toyota', $rows[0]['data']['marca']);
        $this->assertSame('Córdoba', $rows[0]['data']['ubicacion']);
    }

    public function test_strips_a_utf8_bom_and_trims_and_lowercases_headers(): void
    {
        $content = "\xEF\xBB\xBF".'  PATENTE ; Marca;MODELO;Anio;kilometraje;precio;transmision;combustible;carroceria;ubicacion;fotos'."\n".self::ROW."\n";

        $rows = $this->reader()->read($content);

        $this->assertSame('AB123CD', $rows[0]['data']['patente']);
        $this->assertSame('2021', $rows[0]['data']['anio']);
    }

    public function test_row_number_is_the_physical_line_with_the_header_as_row_one(): void
    {
        $content = self::HEADER."\r\n".self::ROW."\r\n\r\n   \r\n;;;;;;;;;;\r\n".self::ROW."\r\n";

        $rows = $this->reader()->read($content);

        $this->assertSame([2, 6], array_column($rows, 'fila'));
    }

    public function test_quoted_cells_keep_the_separator_and_count_embedded_line_breaks(): void
    {
        $content = self::HEADER."\n\"AB123CD\";\"Toyota; Hilux\";\"Multi\nline\";2021;1;1;manual;nafta;Sedán;X;u\n".self::ROW."\n";

        $rows = $this->reader()->read($content);

        $this->assertSame('Toyota; Hilux', $rows[0]['data']['marca']);
        $this->assertSame("Multi\nline", $rows[0]['data']['modelo']);
        $this->assertSame([2, 4], array_column($rows, 'fila'));
    }

    public function test_optional_and_unknown_columns_are_handled(): void
    {
        $rows = $this->reader()->read(self::HEADER.";extra\n".self::ROW.";x\n");

        $this->assertArrayNotHasKey('version', $rows[0]['data']);
        $this->assertArrayNotHasKey('extra', $rows[0]['data']);
    }

    public function test_short_rows_fill_missing_cells_with_empty_strings(): void
    {
        $rows = $this->reader()->read(self::HEADER."\nAB123CD;Toyota\n");

        $this->assertSame('', $rows[0]['data']['fotos']);
    }

    /**
     * @return array<string, array{string, string}>
     */
    public static function invalidFiles(): array
    {
        return [
            'empty' => ['', 'El archivo está vacío.'],
            'only blanks' => ["\r\n  \r\n", 'El archivo está vacío.'],
            'header only' => [self::HEADER."\n", 'El archivo no tiene filas para importar.'],
            'header and blank lines' => [self::HEADER."\n\n\n", 'El archivo no tiene filas para importar.'],
            'missing headers' => ["patente;marca;fotos\nAB123CD;Toyota;x\n", 'Faltan las columnas obligatorias: modelo, anio, kilometraje, precio, transmision, combustible, carroceria, ubicacion.'],
            'not utf-8' => [self::HEADER."\n".mb_convert_encoding(self::ROW, 'ISO-8859-1', 'UTF-8')."\n", 'El archivo tiene que estar codificado en UTF-8.'],
        ];
    }

    #[DataProvider('invalidFiles')]
    public function test_rejects_a_file_that_cannot_be_read(string $content, string $message): void
    {
        $this->expectException(ImportFileException::class);
        $this->expectExceptionMessage($message);

        $this->reader()->read($content);
    }

    public function test_accepts_exactly_the_row_limit_and_rejects_one_more(): void
    {
        $limit = VehiculoCsvReader::MAX_ROWS;
        $content = self::HEADER."\n".str_repeat(self::ROW."\n", $limit);

        $this->assertCount($limit, $this->reader()->read($content));

        $this->expectException(ImportFileException::class);
        $this->expectExceptionMessage("El archivo supera el máximo de {$limit} filas.");

        $this->reader()->read($content.self::ROW."\n");
    }
}
