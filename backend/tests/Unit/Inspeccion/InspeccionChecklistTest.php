<?php

namespace Tests\Unit\Inspeccion;

use App\Support\InspeccionChecklist;
use PHPUnit\Framework\TestCase;

class InspeccionChecklistTest extends TestCase
{
    public function test_catalog_has_five_numbered_steps_with_28_items_and_10_critical(): void
    {
        $steps = InspeccionChecklist::steps();

        $this->assertCount(5, $steps);
        $this->assertSame([1, 2, 3, 4, 5], array_column($steps, 'numero'));
        $this->assertCount(28, InspeccionChecklist::codes());
        $this->assertCount(10, InspeccionChecklist::criticalCodes());
    }

    public function test_items_and_critical_items_per_step(): void
    {
        $steps = InspeccionChecklist::steps();

        $this->assertSame([4, 6, 6, 6, 6], array_map(fn ($step) => count($step['items']), $steps));
        $this->assertSame([2, 2, 3, 1, 2], array_map(
            fn ($step) => count(array_filter($step['items'], fn ($item) => $item['critico'])),
            $steps,
        ));
    }

    public function test_steps_expose_the_json_shape_the_api_returns(): void
    {
        $step = InspeccionChecklist::steps()[0];

        $this->assertSame(['numero', 'titulo', 'ayuda', 'items'], array_keys($step));
        $this->assertSame('Papeles del auto', $step['titulo']);
        $this->assertSame('Pedile al vendedor la cédula y el título del auto.', $step['ayuda']);
        $this->assertSame(['codigo', 'texto', 'critico'], array_keys($step['items'][0]));
        $this->assertSame('El vendedor es el titular o tiene autorización para vender', $step['items'][0]['texto']);
        $this->assertTrue($step['items'][0]['critico']);
        $this->assertFalse($step['items'][2]['critico']);
    }

    public function test_steps_four_and_five_have_no_hint(): void
    {
        $steps = InspeccionChecklist::steps();

        $this->assertNull($steps[3]['ayuda']);
        $this->assertNull($steps[4]['ayuda']);
        $this->assertNotNull($steps[0]['ayuda']);
    }

    public function test_codes_are_unique_snake_case_and_fit_the_column(): void
    {
        $codes = InspeccionChecklist::codes();

        $this->assertSame($codes, array_values(array_unique($codes)));
        foreach ($codes as $code) {
            $this->assertMatchesRegularExpression('/^[a-z][a-z0-9]*(_[a-z0-9]+)*$/', $code);
            $this->assertLessThanOrEqual(100, strlen($code));
        }
    }

    public function test_critical_codes_are_a_subset_of_the_codes(): void
    {
        $this->assertSame([], array_diff(InspeccionChecklist::criticalCodes(), InspeccionChecklist::codes()));
        $this->assertContains('papeles_titular', InspeccionChecklist::criticalCodes());
        $this->assertNotContains('papeles_vtv', InspeccionChecklist::criticalCodes());
    }

    public function test_exists_tells_known_codes_from_unknown_ones(): void
    {
        $this->assertTrue(InspeccionChecklist::exists('papeles_titular'));
        $this->assertFalse(InspeccionChecklist::exists('does_not_exist'));
        $this->assertFalse(InspeccionChecklist::exists(''));
    }
}
