<?php

namespace Tests\Unit\Services\Inventario;

use App\Services\Inventario\ImportFileException;
use App\Services\Inventario\VehiculoImportColumns;
use App\Services\Inventario\VehiculoXlsxReader;
use avadim\FastExcelWriter\Excel;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use ZipArchive;

/** UH22: native XLSX parsing stays separate from vehicle and ownership validation. */
class VehiculoXlsxReaderTest extends TestCase
{
    public function test_reads_only_inventory_preserving_zero_blank_and_physical_rows(): void
    {
        $bytes = $this->workbook([['AB123CD', 'FIAT', 'Strada', 'Freedom', 2024, 0], [], ['AC123CD']]);
        $rows = (new VehiculoXlsxReader)->read($bytes);
        $this->assertSame([2, 4], array_column($rows, 'fila'));
        $this->assertSame('FIAT', $rows[0]['data']['marca']);
        $this->assertSame('0', $rows[0]['data']['kilometraje']);
        $this->assertSame('', $rows[0]['data']['precio']);
        $this->assertSame('AC123CD', $rows[1]['data']['patente']);
    }

    #[DataProvider('invalidFiles')]
    public function test_rejects_non_xlsx_even_when_named_like_a_workbook(string $bytes): void
    {
        $this->expectException(ImportFileException::class);
        (new VehiculoXlsxReader)->read($bytes);
    }

    public static function invalidFiles(): array
    {
        return [[''], ["patente;marca\nAB123CD;FIAT"], ['PK'.str_repeat('x', 40)]];
    }

    public function test_rejects_missing_and_duplicate_headers(): void
    {
        foreach ([['patente'], [...VehiculoImportColumns::headers(), 'marca']] as $headers) {
            try {
                (new VehiculoXlsxReader)->read($this->workbook([['AB123CD']], $headers));
                $this->fail('Invalid headers must be rejected.');
            } catch (ImportFileException $error) {
                $this->assertStringContainsString('columnas', $error->getMessage());
            }
        }
    }

    public function test_rejects_a_header_only_workbook(): void
    {
        $this->expectExceptionMessage('El archivo no tiene filas para importar.');
        (new VehiculoXlsxReader)->read($this->workbook([]));
    }

    public function test_rejects_uploads_larger_than_two_mebibytes(): void
    {
        $this->expectException(ImportFileException::class);
        (new VehiculoXlsxReader)->read('PK'.str_repeat('x', 2 * 1024 * 1024));
    }

    public function test_accepts_500_rows_and_rejects_501_without_truncating(): void
    {
        $rows = array_fill(0, 500, ['AB123CD']);
        $this->assertCount(500, (new VehiculoXlsxReader)->read($this->workbook($rows)));
        $this->expectExceptionMessage('El archivo supera el máximo de 500 filas.');
        (new VehiculoXlsxReader)->read($this->workbook([...$rows, ['AC123CD']]));
    }

    public function test_rejects_cell_formulas_instead_of_trusting_cached_results(): void
    {
        $this->expectExceptionMessage('No se admiten fórmulas en las celdas. Guardá los valores antes de importar.');
        (new VehiculoXlsxReader)->read($this->workbook([['=1+1']]));
    }

    public function test_rejects_excessive_expanded_size_before_parsing_xml(): void
    {
        $this->expectException(ImportFileException::class);
        (new VehiculoXlsxReader)->read($this->workbook([['AB123CD']], part: [
            'docProps/large.xml', str_repeat(' ', 20 * 1024 * 1024 + 1),
        ]));
    }

    #[DataProvider('unsafeParts')]
    public function test_rejects_unsafe_archive_parts_without_evaluating_them(array $part): void
    {
        $this->expectException(ImportFileException::class);
        (new VehiculoXlsxReader)->read($this->workbook([['AB123CD']], part: $part));
    }

    public static function unsafeParts(): array
    {
        return [
            [['docProps/extra.xml', '<!DOCTYPE data [<!ENTITY x SYSTEM "file:///not-read">]><data>&x;</data>']],
            [['xl/vbaProject.bin', 'not executed']],
            [['../unexpected.xml', '<data/>']],
            [['docProps/extra.xml', '<unclosed>']],
        ];
    }

    private function workbook(array $rows, ?array $headers = null, ?array $part = null): string
    {
        $path = tempnam(sys_get_temp_dir(), 'xlsx-reader-test-');
        try {
            $excel = Excel::create(['Inventario', 'Catalogo'], ['temp_dir' => sys_get_temp_dir()]);
            foreach ([$headers ?? VehiculoImportColumns::headers(), ...$rows] as $r => $cells) {
                foreach ($cells as $c => $value) {
                    $excel->sheet()->writeTo(Excel::cellAddress($r + 1, $c + 1), $value);
                }
            }
            $excel->getSheet('Catalogo')->writeTo('A1', 'Not an inventory row');
            $excel->save($path);
            if ($part !== null) {
                $zip = new ZipArchive;
                $zip->open($path);
                $zip->addFromString($part[0], $part[1]);
                $zip->close();
            }

            return file_get_contents($path);
        } finally {
            unlink($path);
        }
    }
}
