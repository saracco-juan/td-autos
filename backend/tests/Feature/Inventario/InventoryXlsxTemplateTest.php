<?php

namespace Tests\Feature\Inventario;

use App\Models\Concesionaria;
use App\Models\User;
use App\Models\Vehiculo;
use App\Services\Catalog\FixedAcaraCatalog;
use App\Services\Inventario\VehiculoImportColumns;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;
use ZipArchive;

/** UH22: catalog-backed native workbook, without changing inventory. */
class InventoryXlsxTemplateTest extends TestCase
{
    use InteractsWithVehiculos;
    use RefreshDatabase;

    private const URL = '/api/concesionaria/vehiculos/importar/plantilla';

    public function test_template_requires_an_authenticated_active_dealer(): void
    {
        $this->getJson(self::URL)->assertUnauthorized();
        $this->actingAs(User::factory()->create())->getJson(self::URL)->assertForbidden();
        $this->actingAs(Concesionaria::factory()->create()->usuario)
            ->getJson(self::URL)->assertForbidden();
    }

    public function test_unavailable_catalog_does_not_return_a_broken_workbook(): void
    {
        Http::preventStrayRequests();
        $this->actingAs($this->dealer())->getJson(self::URL)->assertStatus(503)
            ->assertJsonPath('message', 'El catálogo no está disponible. Intentá de nuevo más tarde.');
        $this->assertDatabaseCount('vehiculo', 0);
    }

    public function test_workbook_contains_catalog_lists_headers_and_dependent_dropdowns(): void
    {
        Http::preventStrayRequests();
        $this->seedVehicleCatalog(); // Versions without prices remain selectable.
        $snapshot = Cache::store('catalog')->get(FixedAcaraCatalog::cacheKey());
        foreach ([['Corolla', 'XEI Plus'], ['Yaris', 'XLS CVT']] as [$model, $version]) {
            $snapshot['rows'][] = ['make' => 'Toyota', 'model' => $model, 'version' => $version,
                'version_id' => $this->catalogId('Toyota', $model, $version), 'currency' => 'ARS', 'values' => []];
        }
        Cache::store('catalog')->forever(FixedAcaraCatalog::cacheKey(), $snapshot);
        $count = Vehiculo::query()->count();
        $response = $this->actingAs($this->dealer())->get(self::URL)->assertOk()
            ->assertHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
            ->assertHeader('Content-Disposition', 'attachment; filename="plantilla-inventario.xlsx"');
        $path = tempnam(sys_get_temp_dir(), 'xlsx-test-');
        try {
            file_put_contents($path, $response->getContent());
            $zip = new ZipArchive;
            $this->assertTrue($zip->open($path));
            try {
                $book = simplexml_load_string($zip->getFromName('xl/workbook.xml'));
                $main = simplexml_load_string($zip->getFromName('xl/worksheets/sheet1.xml'));
                $lists = $zip->getFromName('xl/sharedStrings.xml');
                $this->assertSame('Inventario', (string) $book->sheets->sheet[0]['name']);
                $this->assertSame('veryHidden', (string) $book->sheets->sheet[1]['state']);
                $this->assertSame(VehiculoImportColumns::headers(), array_map(
                    fn ($cell) => (string) $cell->is->t, iterator_to_array($main->sheetData->row[0]->c, false),
                ));
                $this->assertStringContainsString('Toyota', $lists);
                $this->assertStringContainsString('XEI 2.0 CVT', $lists);
                $this->assertStringContainsString('Ford', $lists);
                $this->assertStringContainsString('Yaris', $lists);
                $this->assertStringContainsString('XEI Plus', $lists);
                $names = [];
                foreach ($book->definedNames->definedName as $name) {
                    $names[(string) $name['name']] = (string) $name;
                }
                $this->assertArrayHasKey('brands', $names);
                $this->assertArrayHasKey('models_1', $names);
                $this->assertArrayHasKey('versions_2_1', $names);
                $this->assertArrayHasKey('versions_2_2', $names);
                $rules = $main->dataValidations->dataValidation;
                $this->assertCount(3, $rules);
                $this->assertSame('B2:B501', (string) $rules[0]['sqref']);
                $this->assertSame('brands', (string) $rules[0]->formula1);
                $this->assertSame('C2:C501', (string) $rules[1]['sqref']);
                $this->assertStringContainsString('MATCH($B2,brands,0)', (string) $rules[1]->formula1);
                $this->assertSame('D2:D501', (string) $rules[2]['sqref']);
                $this->assertStringContainsString('MATCH($C2,INDIRECT(', (string) $rules[2]->formula1);
            } finally {
                $zip->close();
            }
        } finally {
            unlink($path);
        }
        $this->assertSame($count, Vehiculo::query()->count());
        Http::assertNothingSent();
    }

    public function test_catalog_labels_are_literal_text_not_executable_formulas(): void
    {
        $this->seedVehicleCatalog();
        $snapshot = Cache::store('catalog')->get(FixedAcaraCatalog::cacheKey());
        $snapshot['rows'][0]['version'] = '=1+1 & <text>';
        Cache::store('catalog')->forever(FixedAcaraCatalog::cacheKey(), $snapshot);
        $response = $this->actingAs($this->dealer())->get(self::URL)->assertOk();
        $path = tempnam(sys_get_temp_dir(), 'xlsx-text-test-');
        $zip = new ZipArchive;
        try {
            file_put_contents($path, $response->getContent());
            $this->assertTrue($zip->open($path));
            $this->assertStringNotContainsString('<f>', $zip->getFromName('xl/worksheets/sheet2.xml'));
            $this->assertStringContainsString('=1+1 &amp; &lt;text&gt;', $zip->getFromName('xl/sharedStrings.xml'));
        } finally {
            $zip->close();
            unlink($path);
        }
    }
}
