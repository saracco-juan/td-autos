<?php

namespace Tests\Unit\Services\Portales;

use App\Models\ModeloReferencia;
use App\Services\Portales\ModelScorer;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class ModelScorerTest extends TestCase
{
    private function model(array $changes = []): ModeloReferencia
    {
        return new ModeloReferencia($changes + ['usos' => ['ciudad'], 'consumo' => 'medio', 'seguridad_estrellas' => null]);
    }

    public function test_a_use_the_model_lists_adds_one_point(): void
    {
        $scorer = new ModelScorer;

        $this->assertSame(2.0, $scorer->score($this->model(['usos' => ['ciudad']]), 'ciudad', 'mantenimiento'));
        $this->assertSame(1.0, $scorer->score($this->model(['usos' => ['ruta']]), 'ciudad', 'mantenimiento'));
        $this->assertSame(2.0, $scorer->score($this->model(['usos' => ['trabajo']]), 'trabajo', 'reventa'));
    }

    public function test_mixed_use_needs_a_model_that_lists_both_city_and_highway(): void
    {
        $scorer = new ModelScorer;

        $this->assertSame(2.0, $scorer->score($this->model(['usos' => ['ciudad', 'ruta']]), 'mixto', 'reventa'));
        $this->assertSame(1.0, $scorer->score($this->model(['usos' => ['ciudad']]), 'mixto', 'reventa'));
        $this->assertSame(1.0, $scorer->score($this->model(['usos' => ['ruta', 'trabajo']]), 'mixto', 'reventa'));
    }

    /** @return array<string, array{string, float}> */
    public static function consumptionClasses(): array
    {
        return ['low' => ['bajo', 3.0], 'medium' => ['medio', 2.0], 'high' => ['alto', 1.0]];
    }

    #[DataProvider('consumptionClasses')]
    public function test_the_consumption_priority_scores_the_consumption_class(string $class, float $expected): void
    {
        $this->assertSame($expected, (new ModelScorer)->score($this->model(['consumo' => $class]), 'ciudad', 'consumo'));
    }

    public function test_the_safety_priority_scales_the_stars_to_two_points_and_a_missing_rating_is_neutral(): void
    {
        $scorer = new ModelScorer;

        $this->assertSame(3.0, $scorer->score($this->model(['seguridad_estrellas' => 5]), 'ciudad', 'seguridad'));
        $this->assertEqualsWithDelta(2.2, $scorer->score($this->model(['seguridad_estrellas' => 3]), 'ciudad', 'seguridad'), 0.0001);
        $this->assertSame(0.0, $scorer->score($this->model(['seguridad_estrellas' => 0, 'usos' => []]), 'ciudad', 'seguridad'));
        $this->assertSame(2.0, $scorer->score($this->model(['seguridad_estrellas' => null]), 'ciudad', 'seguridad'));
    }

    public function test_maintenance_and_resale_are_neutral_for_every_model(): void
    {
        $scorer = new ModelScorer;

        foreach (['mantenimiento', 'reventa'] as $priority) {
            $this->assertSame(
                $scorer->score($this->model(['consumo' => 'bajo', 'seguridad_estrellas' => 5]), 'ciudad', $priority),
                $scorer->score($this->model(['consumo' => 'alto', 'seguridad_estrellas' => 0]), 'ciudad', $priority),
            );
        }
    }
}
