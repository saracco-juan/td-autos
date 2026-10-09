<?php

namespace Tests\Unit\Transferencia;

use App\Support\TransferenciaChecklist;
use PHPUnit\Framework\TestCase;

class TransferenciaChecklistTest extends TestCase
{
    public function test_catalog_has_four_numbered_stages_with_15_items_and_8_mandatory(): void
    {
        $stages = TransferenciaChecklist::stages();

        $this->assertCount(4, $stages);
        $this->assertSame([1, 2, 3, 4], array_column($stages, 'numero'));
        $this->assertCount(15, TransferenciaChecklist::codes());
        $this->assertCount(8, TransferenciaChecklist::mandatoryCodes());
    }

    public function test_items_and_mandatory_items_per_stage(): void
    {
        $stages = TransferenciaChecklist::stages();

        $this->assertSame([3, 5, 4, 3], array_map(fn ($stage) => count($stage['items']), $stages));
        $this->assertSame([0, 5, 3, 0], array_map(
            fn ($stage) => count(array_filter($stage['items'], fn ($item) => $item['obligatorio'])),
            $stages,
        ));
    }

    public function test_stages_expose_the_json_shape_the_api_returns(): void
    {
        $stage = TransferenciaChecklist::stages()[1];

        $this->assertSame(['numero', 'titulo', 'ayuda', 'items'], array_keys($stage));
        $this->assertSame('Documentación', $stage['titulo']);
        $this->assertSame('Juntá estos papeles antes de ir al registro.', $stage['ayuda']);
        $this->assertSame(['codigo', 'texto', 'obligatorio'], array_keys($stage['items'][0]));
        $this->assertSame('DNI del comprador y del vendedor', $stage['items'][0]['texto']);
        $this->assertTrue($stage['items'][0]['obligatorio']);
        $this->assertFalse(TransferenciaChecklist::stages()[0]['items'][0]['obligatorio']);
    }

    public function test_stages_three_and_four_have_no_hint(): void
    {
        $stages = TransferenciaChecklist::stages();

        $this->assertNull($stages[2]['ayuda']);
        $this->assertNull($stages[3]['ayuda']);
        $this->assertSame('Revisá esto antes de entregar dinero.', $stages[0]['ayuda']);
    }

    public function test_codes_are_unique_snake_case_and_fit_the_column(): void
    {
        $codes = TransferenciaChecklist::codes();

        $this->assertSame($codes, array_values(array_unique($codes)));
        foreach ($codes as $code) {
            $this->assertMatchesRegularExpression('/^[a-z][a-z0-9]*(_[a-z0-9]+)*$/', $code);
            $this->assertLessThanOrEqual(100, strlen($code));
        }
    }

    public function test_mandatory_codes_are_a_subset_of_the_codes_in_catalog_order(): void
    {
        $this->assertSame([], array_diff(TransferenciaChecklist::mandatoryCodes(), TransferenciaChecklist::codes()));
        $this->assertSame(
            array_values(array_intersect(TransferenciaChecklist::codes(), TransferenciaChecklist::mandatoryCodes())),
            TransferenciaChecklist::mandatoryCodes(),
        );
        $this->assertContains('documentacion_dni', TransferenciaChecklist::mandatoryCodes());
        $this->assertNotContains('antes_informe_dominio', TransferenciaChecklist::mandatoryCodes());
    }

    public function test_exists_tells_known_codes_from_unknown_ones(): void
    {
        $this->assertTrue(TransferenciaChecklist::exists('documentacion_dni'));
        $this->assertFalse(TransferenciaChecklist::exists('does_not_exist'));
        $this->assertFalse(TransferenciaChecklist::exists(''));
    }
}
