<?php

namespace Tests\Feature\Inventario;

use App\Models\TipoCarroceria;
use avadim\FastExcelWriter\Excel;
use Illuminate\Http\UploadedFile;

/**
 * Real XLSX fixtures for the inventory API and a vehicle's public photo URLs.
 */
trait InteractsWithImportXlsx
{
    /** @var list<string> */
    private const WORKBOOK_HEADERS = [
        'patente', 'marca', 'modelo', 'version', 'anio', 'kilometraje', 'precio',
        'transmision', 'combustible', 'carroceria', 'ubicacion', 'descripcion', 'fotos',
        'moneda', 'plazas', 'motor', 'turbo', 'potencia', 'potencia_unidad',
        'consumo_urbano', 'consumo_ruta', ...self::EQUIPMENT_FIELDS,
    ];

    /**
     * The `fotos` cell: $count external URLs separated by `|`.
     */
    private function photoCell(int $count = 7): string
    {
        return implode('|', array_map(
            fn (int $n) => "https://cdn.example.com/autos/{$n}.jpg",
            range(1, max($count, 1)),
        ));
    }

    /**
     * A valid inventory row keyed by header name.
     *
     * @param  array<string, string>  $overrides
     * @return array<string, string>
     */
    private function workbookRow(array $overrides = []): array
    {
        return [
            'patente' => 'AB123CD',
            'marca' => 'Toyota',
            'modelo' => 'Corolla',
            'version' => 'XEI 2.0 CVT',
            'anio' => '2021',
            'kilometraje' => '45000',
            'precio' => '25000000',
            'transmision' => 'automatica',
            'combustible' => 'nafta',
            'carroceria' => TipoCarroceria::query()->orderBy('id')->value('nombre'),
            'ubicacion' => 'Córdoba',
            'descripcion' => 'Único dueño.',
            'fotos' => $this->photoCell(),
            'moneda' => 'ARS', 'plazas' => '5', 'motor' => '2.0', 'turbo' => 'no',
            'potencia' => '170', 'potencia_unidad' => 'CV',
            'consumo_urbano' => '8.5', 'consumo_ruta' => '6.2',
            ...array_fill_keys(self::EQUIPMENT_FIELDS, 'no'),
            ...$overrides,
        ];
    }

    /**
     * A native workbook for rows keyed by header name.
     *
     * @param  list<array<string, string>>  $rows
     * @param  list<string>|null  $headers  Header names and order; defaults to the canonical ones.
     */
    private function workbookContent(array $rows, ?array $headers = null): string
    {
        $headers ??= self::WORKBOOK_HEADERS;
        $path = tempnam(sys_get_temp_dir(), 'inventory-api-test-');
        try {
            $excel = Excel::create(['Inventario'], ['temp_dir' => sys_get_temp_dir()]);
            $excel->sheet()->writeRow($headers);
            foreach ($rows as $row) {
                $excel->sheet()->writeRow(array_map(fn (string $header) => $row[strtolower(trim($header))] ?? '', $headers));
            }
            $excel->save($path);

            return file_get_contents($path);
        } finally {
            unlink($path);
        }
    }

    private function workbookFile(string $content, string $name = 'stock.xlsx'): UploadedFile
    {
        return UploadedFile::fake()->createWithContent($name, $content);
    }
}
