<?php

namespace App\Services\Inventario;

use App\Support\VehiculoFields;

/**
 * Reads the text of a dealer's inventory CSV into rows keyed by column name. It knows nothing
 * about vehicle rules: it only checks the file can be read (encoding, headers, size).
 */
class VehiculoCsvReader
{
    public const MAX_ROWS = 500;

    /** Columns that must be in the header; `version` and `descripcion` may be absent. */
    private const REQUIRED = [
        'patente', 'marca', 'modelo', 'anio', 'kilometraje', 'precio',
        'transmision', 'combustible', 'carroceria', 'ubicacion', 'fotos',
        'moneda', 'plazas', 'motor', 'turbo', 'potencia', 'potencia_unidad',
        'consumo_urbano', 'consumo_ruta',
    ];

    private const OPTIONAL = ['version', 'descripcion'];

    /**
     * @return list<array{fila: int, data: array<string, string>}> Non-blank rows; `fila` is the
     *                                                             physical line with the header as row 1.
     *
     * @throws ImportFileException
     */
    public function read(string $contents): array
    {
        $contents = preg_replace('/\A\xEF\xBB\xBF/', '', $contents);

        if (trim($contents) === '') {
            throw new ImportFileException('El archivo está vacío.');
        }

        if (! mb_check_encoding($contents, 'UTF-8')) {
            throw new ImportFileException('El archivo tiene que estar codificado en UTF-8.');
        }

        $stream = fopen('php://temp', 'r+');
        fwrite($stream, $contents);
        rewind($stream);

        try {
            return $this->parse($stream, $contents, $this->separator($contents));
        } finally {
            fclose($stream);
        }
    }

    /**
     * The separator is the more frequent of `;` and `,` in the header line.
     */
    private function separator(string $contents): string
    {
        foreach (preg_split('/\R/', $contents) as $line) {
            if (trim($line) !== '') {
                return substr_count($line, ';') > substr_count($line, ',') ? ';' : ',';
            }
        }

        return ',';
    }

    /**
     * @param  resource  $stream
     * @return list<array{fila: int, data: array<string, string>}>
     */
    private function parse($stream, string $contents, string $separator): array
    {
        $columns = null;
        $rows = [];
        $line = 1;

        while (true) {
            $start = ftell($stream);
            $record = fgetcsv($stream, null, $separator, '"', '');

            if ($record === false) {
                break;
            }

            $fila = $line;
            $line += substr_count(substr($contents, $start, ftell($stream) - $start), "\n");
            $cells = array_map(fn (?string $cell) => trim((string) $cell), $record);

            if ($cells === [] || implode('', $cells) === '') {
                continue;
            }

            if ($columns === null) {
                $columns = $this->headerColumns($cells);

                continue;
            }

            if (count($rows) === self::MAX_ROWS) {
                throw new ImportFileException('El archivo supera el máximo de '.self::MAX_ROWS.' filas.');
            }

            $rows[] = ['fila' => $fila, 'data' => $this->rowData($columns, $cells)];
        }

        if ($rows === []) {
            throw new ImportFileException('El archivo no tiene filas para importar.');
        }

        return $rows;
    }

    /**
     * @param  list<string>  $cells
     * @return array<int, string> Column name of each known position in the header.
     */
    private function headerColumns(array $cells): array
    {
        $columns = [];
        $required = [...self::REQUIRED, ...array_keys(VehiculoFields::EQUIPMENT_FIELDS)];

        foreach ($cells as $position => $name) {
            $name = mb_strtolower($name);

            if (in_array($name, [...$required, ...self::OPTIONAL], true)) {
                $columns[$position] = $name;
            }
        }

        $missing = array_values(array_diff($required, $columns));

        if ($missing !== []) {
            throw new ImportFileException('Faltan las columnas obligatorias: '.implode(', ', $missing).'. Descargá la plantilla actualizada.');
        }

        return $columns;
    }

    /**
     * @param  array<int, string>  $columns
     * @param  list<string>  $cells
     * @return array<string, string>
     */
    private function rowData(array $columns, array $cells): array
    {
        $data = [];

        foreach ($columns as $position => $name) {
            $data[$name] = $cells[$position] ?? '';
        }

        return $data;
    }
}
