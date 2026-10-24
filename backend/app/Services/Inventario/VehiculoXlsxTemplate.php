<?php

namespace App\Services\Inventario;

use avadim\FastExcelWriter\DataValidation\DataValidation;
use avadim\FastExcelWriter\Excel;
use avadim\FastExcelWriter\RichText\RichText;
use avadim\FastExcelWriter\Sheet;
use RuntimeException;

/** UH22: disposable native workbook; the server still validates every imported identity. */
final class VehiculoXlsxTemplate
{
    public function contents(array $entries): string
    {
        $excel = Excel::create(['Inventario', 'Catalogo'], ['temp_dir' => sys_get_temp_dir()]);
        $main = $excel->sheet();
        $headers = VehiculoImportColumns::headers();
        $main->setFreeze('B2')->setColFormats(array_fill(0, count($headers), '@'));
        $main->setColWidths(array_map(fn ($name) => max(16, strlen($name) + 2), $headers));
        $main->writeHeader($headers, ['font-bold' => true, 'fill-color' => '#E8EEF4']);
        $lists = $excel->getSheet('Catalogo')->setStateVeryHidden();
        $tree = [];
        foreach ($entries as $entry) {
            $tree[$entry['marca']][$entry['modelo']][] = $entry['version'];
        }
        $row = 1;
        $this->list($lists, 'brands', array_keys($tree), $row);
        $brandIndex = 0;
        foreach ($tree as $models) {
            $brandIndex++;
            $this->list($lists, 'models_'.$brandIndex, array_keys($models), $row);
            $modelIndex = 0;
            foreach ($models as $versions) {
                $modelIndex++;
                $this->list($lists, "versions_{$brandIndex}_{$modelIndex}", array_values(array_unique($versions)), $row);
            }
        }
        $brandMatch = 'MATCH($B2,brands,0)';
        $models = 'INDIRECT("models_"&'.$brandMatch.')';
        $formulas = ['B' => '=brands', 'C' => '='.$models,
            'D' => '=INDIRECT("versions_"&'.$brandMatch.'&"_"&MATCH($C2,'.$models.',0))'];
        foreach ($formulas as $column => $formula) {
            $validation = DataValidation::dropDown($formula)->allowBlank(false)
                ->setError('Elegí una opción del catálogo. Si cambiás la marca o el modelo, volvé a elegir la versión.')
                ->setPrompt('Elegí primero la marca, después el modelo y la versión.');
            $main->addDataValidation($column.'2:'.$column.(VehiculoImportColumns::MAX_ROWS + 1), $validation);
        }
        $path = tempnam(sys_get_temp_dir(), 'inventory-xlsx-');
        if ($path === false) {
            throw new RuntimeException('Could not allocate workbook storage.');
        }
        try {
            if (! $excel->save($path)) {
                throw new RuntimeException('Could not save workbook.');
            }
            $contents = file_get_contents($path);
            if ($contents === false) {
                throw new RuntimeException('Could not read workbook.');
            }

            return $contents;
        } finally {
            unlink($path);
        }
    }

    private function list(Sheet $sheet, string $name, array $values, int &$row): void
    {
        $start = $row;
        foreach ($values as $value) {
            $sheet->writeTo('A'.$row++, (new RichText)->addText($value));
        }
        $sheet->addNamedRange('A'.$start.':A'.($row - 1), $name);
    }
}
