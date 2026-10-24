<?php

namespace App\Services\Inventario;

use avadim\FastExcelReader\Excel;
use RuntimeException;
use Throwable;
use XMLReader;
use ZipArchive;

/** UH22: bounded native XLSX input; no CSV fallback or formula evaluation. */
final class VehiculoXlsxReader
{
    public function read(string $contents): array
    {
        if (strlen($contents) > 2 * 1024 * 1024 || ! str_starts_with($contents, 'PK')) {
            throw new ImportFileException('Elegí un archivo XLSX válido de hasta 2 MB.');
        }
        $path = tempnam(sys_get_temp_dir(), 'inventory-read-');
        if ($path === false) {
            throw new RuntimeException('Could not allocate import storage.');
        }
        try {
            if (file_put_contents($path, $contents) === false) {
                throw new RuntimeException('Could not write import storage.');
            }
            $this->checkArchive($path);
            $sheet = Excel::openXlsx($path)->sheet('Inventario');
            if ($sheet === null) {
                throw new ImportFileException('Falta la hoja Inventario. Descargá la plantilla actualizada.');
            }
            $columns = null;
            $rows = [];
            $failure = null;
            // Exhaust bounded input before rejecting: the library closes streams at exhaustion.
            foreach ($sheet->nextRow([], Excel::KEYS_COL_ZERO_BASED | Excel::KEYS_ROW_ONE_BASED) as $number => $cells) {
                if ($failure !== null) {
                    continue;
                }
                $cells = array_map(fn ($value) => trim((string) $value), $cells);
                if (implode('', $cells) === '') {
                    continue;
                }
                if ($columns === null) {
                    try {
                        $columns = $this->columns($cells);
                    } catch (ImportFileException $error) {
                        $failure = $error;
                    }

                    continue;
                }
                if (count($rows) === VehiculoImportColumns::MAX_ROWS) {
                    $failure = new ImportFileException('El archivo supera el máximo de 500 filas.');

                    continue;
                }
                $data = [];
                foreach ($columns as $position => $name) {
                    $data[$name] = $cells[$position] ?? '';
                }
                $rows[] = ['fila' => $number, 'data' => $data];
            }
            if ($failure !== null) {
                throw $failure;
            }
            if ($rows === []) {
                throw new ImportFileException('El archivo no tiene filas para importar.');
            }

            return $rows;
        } catch (ImportFileException $error) {
            throw $error;
        } catch (Throwable $error) {
            throw new ImportFileException('El archivo XLSX no se puede leer. Descargá la plantilla actualizada.', 0, $error);
        } finally {
            unlink($path);
        }
    }

    private function columns(array $cells): array
    {
        $cells = array_map(fn ($name) => mb_strtolower($name), $cells);
        $columns = array_intersect($cells, VehiculoImportColumns::headers());
        $required = array_diff(VehiculoImportColumns::headers(), ['descripcion']);
        if (count(array_unique($columns)) !== count($columns) || array_diff($required, $columns) !== []) {
            throw new ImportFileException('Faltan columnas obligatorias o hay columnas repetidas. Descargá la plantilla actualizada.');
        }

        return $columns;
    }

    private function checkArchive(string $path): void
    {
        $zip = new ZipArchive;
        if ($zip->open($path) !== true) {
            throw new ImportFileException('El archivo no es un XLSX válido.');
        }
        try {
            if ($zip->numFiles > 256 || $zip->locateName('xl/workbook.xml') === false
                || $zip->locateName('[Content_Types].xml') === false) {
                throw new ImportFileException('La estructura del archivo XLSX no es válida.');
            }
            $size = 0;
            for ($i = 0; $i < $zip->numFiles; $i++) {
                $part = $zip->statIndex($i);
                $size += $part['size'];
                if ($size > 20 * 1024 * 1024 || ($part['encryption_method'] ?? 0) !== 0
                    || str_contains($part['name'], '\\') || str_contains($part['name'], ':')
                    || str_starts_with($part['name'], '/') || in_array('..', explode('/', $part['name']), true)) {
                    throw new ImportFileException('El archivo XLSX excede los límites o contiene partes no admitidas.');
                }
            }
            for ($i = 0; $i < $zip->numFiles; $i++) {
                $name = $zip->getNameIndex($i);
                if (str_ends_with($name, '.xml') || str_ends_with($name, '.rels')) {
                    $this->checkXml($zip->getFromIndex($i));
                } elseif (str_ends_with($name, 'vbaProject.bin')) {
                    throw new ImportFileException('No se admiten macros en el archivo.');
                }
            }
        } finally {
            $zip->close();
        }
    }

    private function checkXml(string $contents): void
    {
        $previous = libxml_use_internal_errors(true);
        $xml = new XMLReader;
        try {
            if (! $xml->XML($contents, null, LIBXML_NONET | LIBXML_COMPACT)) {
                throw new ImportFileException('El archivo contiene XML inválido.');
            }
            while ($xml->read()) {
                if ($xml->nodeType === XMLReader::DOC_TYPE) {
                    throw new ImportFileException('No se admiten definiciones de entidades XML.');
                }
                if ($xml->nodeType !== XMLReader::ELEMENT) {
                    continue;
                }
                if ($xml->localName === 'f') {
                    throw new ImportFileException('No se admiten fórmulas en las celdas. Guardá los valores antes de importar.');
                }
                if (($xml->localName === 'row' && (int) $xml->getAttribute('r') > 10000)
                    || str_contains((string) $xml->getAttribute('ContentType'), 'macroEnabled')) {
                    throw new ImportFileException('El archivo contiene una estructura no admitida.');
                }
            }
            if (libxml_get_errors() !== []) {
                throw new ImportFileException('El archivo contiene XML inválido.');
            }
        } finally {
            $xml->close();
            libxml_clear_errors();
            libxml_use_internal_errors($previous);
        }
    }
}
