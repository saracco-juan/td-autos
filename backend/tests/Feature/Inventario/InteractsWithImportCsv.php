<?php

namespace Tests\Feature\Inventario;

use App\Models\TipoCarroceria;
use Illuminate\Http\UploadedFile;

/**
 * Fixtures for the CSV import tests: build a CSV file from row arrays, in any separator,
 * with or without a BOM, and the URL list of a vehicle's photos.
 */
trait InteractsWithImportCsv
{
    /** @var list<string> */
    private const CSV_HEADERS = [
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
     * A valid CSV row keyed by header name.
     *
     * @param  array<string, string>  $overrides
     * @return array<string, string>
     */
    private function csvRow(array $overrides = []): array
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
     * CSV text for the given rows (each keyed by header name).
     *
     * @param  list<array<string, string>>  $rows
     * @param  list<string>|null  $headers  Header names and order; defaults to the canonical ones.
     */
    private function csvContent(array $rows, string $separator = ';', bool $bom = false, ?array $headers = null): string
    {
        $headers ??= self::CSV_HEADERS;
        $lines = [implode($separator, $headers)];

        foreach ($rows as $row) {
            $lines[] = implode($separator, array_map(fn (string $header) => $this->csvCell($row[strtolower(trim($header))] ?? '', $separator), $headers));
        }

        return ($bom ? "\xEF\xBB\xBF" : '').implode("\r\n", $lines)."\r\n";
    }

    private function csvCell(string $value, string $separator): string
    {
        return str_contains($value, $separator) || str_contains($value, '"')
            ? '"'.str_replace('"', '""', $value).'"'
            : $value;
    }

    private function csvFile(string $content, string $name = 'stock.csv'): UploadedFile
    {
        return UploadedFile::fake()->createWithContent($name, $content);
    }
}
