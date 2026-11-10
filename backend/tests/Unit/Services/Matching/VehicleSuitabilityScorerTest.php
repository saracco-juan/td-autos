<?php

namespace Tests\Unit\Services\Matching;

use App\Models\Vehiculo;
use App\Services\Matching\RunningRequirementsScorer;
use App\Services\Matching\VehicleSuitabilityScorer;
use App\Support\DiagnosticoOptions;
use App\Support\VehiculoFields;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

class VehicleSuitabilityScorerTest extends TestCase
{
    private function vehicle(array $overrides = [], bool $equipped = true): Vehiculo
    {
        return new Vehiculo(array_replace(array_fill_keys(array_keys(VehiculoFields::EQUIPMENT_FIELDS), $equipped), [
            'anio' => 2016, 'kilometraje' => 150000, 'combustible' => 'diesel',
            'turbo' => true, 'transmision' => 'automatica',
            'consumo_urbano' => '6.00', 'consumo_ruta' => '12.00',
        ], $overrides));
    }

    private function scorer(): VehicleSuitabilityScorer
    {
        return new VehicleSuitabilityScorer(new RunningRequirementsScorer);
    }

    #[DataProvider('equipmentWeights')]
    public function test_each_declared_feature_contributes_its_full_weight(string $method, string $field, int $points): void
    {
        $scorer = $this->scorer();
        $this->assertSame(0, $scorer->$method($this->vehicle([], false)));
        $this->assertSame($points, $scorer->$method($this->vehicle([$field => true], false)));
        $this->assertNull($scorer->$method($this->vehicle([$field => null], false)));
    }

    public static function equipmentWeights(): array
    {
        $groups = [
            'safetyScore' => [
                'control_estabilidad' => 25, 'frenos_abs' => 15, 'airbags_frontales' => 15,
                'airbags_laterales' => 5, 'airbags_cortina' => 5, 'isofix' => 5,
                'frenado_autonomo' => 15, 'asistencia_carril' => 5, 'punto_ciego' => 5,
                'recordatorio_cinturon' => 5, 'asistencia_velocidad' => 2, 'monitoreo_conductor' => 3,
            ],
            'comfortScore' => [
                'volante_regulable' => 20, 'climatizador_bizona' => 15, 'butacas_calefaccionadas' => 10,
                'android_auto_apple_carplay' => 15, 'sensores_estacionamiento' => 10,
                'velocidad_crucero' => 15, 'camara_retroceso' => 15,
            ],
        ];
        $cases = [];
        foreach ($groups as $method => $weights) {
            foreach ($weights as $field => $points) {
                $cases[$method.' '.$field] = [$method, $field, $points];
            }
        }

        return $cases;
    }

    public function test_safety_extras_compensate_missing_points_without_exceeding_100(): void
    {
        $scorer = $this->scorer();
        $this->assertSame(100, $scorer->safetyScore($this->vehicle()));
        $this->assertSame(100, $scorer->safetyScore($this->vehicle(['asistencia_velocidad' => false, 'monitoreo_conductor' => false])));
        $this->assertSame(100, $scorer->safetyScore($this->vehicle(['isofix' => false])));
        $this->assertSame(90, $scorer->safetyScore($this->vehicle(['frenos_abs' => false])));
        $this->assertSame(100, $scorer->comfortScore($this->vehicle(['aire_acondicionado' => null])));
    }

    #[DataProvider('contextWeights')]
    public function test_contextual_equipment_counts_only_relevant_features(string $field, int $city, int $road): void
    {
        $vehicle = $this->vehicle([$field => true], false);
        $this->assertSame($city, $this->scorer()->equipmentScore($vehicle, 'ciudad'));
        $this->assertSame($road, $this->scorer()->equipmentScore($vehicle, 'ruta'));
    }

    public static function contextWeights(): array
    {
        return [
            ['aire_acondicionado', 40, 40], ['climatizador_bizona', 40, 40],
            ['sensores_estacionamiento', 20, 0], ['camara_retroceso', 20, 0],
            ['velocidad_crucero', 0, 40], ['android_auto_apple_carplay', 20, 20],
        ];
    }

    public function test_context_climate_is_one_known_or_group_and_unknown_is_not_absent(): void
    {
        $scorer = $this->scorer();
        foreach (['ciudad', 'ruta'] as $use) {
            $this->assertSame(100, $scorer->equipmentScore($this->vehicle(), $use));
            $this->assertSame(40, $scorer->equipmentScore($this->vehicle(['aire_acondicionado' => true, 'climatizador_bizona' => true], false), $use));
            foreach (['aire_acondicionado', 'climatizador_bizona'] as $field) {
                $this->assertNull($scorer->equipmentScore($this->vehicle([$field => null], false), $use));
                $this->assertSame(100, $scorer->equipmentScore($this->vehicle([$field => null]), $use));
            }
            $this->assertNull($scorer->equipmentScore($this->vehicle(['android_auto_apple_carplay' => null]), $use));
        }
        foreach (['sensores_estacionamiento', 'camara_retroceso'] as $field) {
            $this->assertNull($scorer->equipmentScore($this->vehicle([$field => null]), 'ciudad'));
            $this->assertSame(100, $scorer->equipmentScore($this->vehicle([$field => null]), 'ruta'));
        }
        $this->assertSame(100, $scorer->equipmentScore($this->vehicle(['velocidad_crucero' => null]), 'ciudad'));
        $this->assertNull($scorer->equipmentScore($this->vehicle(['velocidad_crucero' => null]), 'ruta'));
        $this->assertNull($scorer->equipmentScore($this->vehicle(), 'mixto'));
        $this->assertNull($scorer->equipmentScore($this->vehicle(), 'unknown'));
    }

    #[DataProvider('usageCases')]
    public function test_usage_formulas_and_monthly_adjustment_keep_fractional_points(string $use, string $monthly, float $expected): void
    {
        $this->assertEqualsWithDelta($expected, $this->scorer()->usageScore($this->vehicle(), $use, $monthly, 2026), 0.0000001);
    }

    public static function usageCases(): array
    {
        return [
            ['ciudad', 'menos_500', 100], ['ruta', 'no_sabe', 76], ['mixto', 'no_sabe', 88],
            ['trabajo', 'no_sabe', 51.5625], ['ciudad', '500_1500', 98.578125],
            ['ciudad', '1500_3000', 97.15625], ['ciudad', 'mas_3000', 95.734375],
            ['ruta', 'mas_3000', 70.834375], ['mixto', 'mas_3000', 82.534375],
        ];
    }

    public function test_work_uses_running_costs_only_and_monthly_adjustment_cannot_change_it(): void
    {
        $vehicle = $this->vehicle(array_fill_keys(array_keys(VehiculoFields::EQUIPMENT_FIELDS), null));
        foreach (DiagnosticoOptions::KILOMETROS_MENSUALES as $monthly) {
            $this->assertSame(51.5625, $this->scorer()->usageScore($vehicle, 'trabajo', $monthly, 2026));
        }
    }

    public function test_missing_components_propagate_only_when_the_selected_formula_needs_them(): void
    {
        $scorer = $this->scorer();
        $vehicle = $this->vehicle(['kilometraje' => null, 'consumo_ruta' => null, 'frenos_abs' => null]);
        $this->assertSame(100.0, $scorer->usageScore($vehicle, 'ciudad', 'no_sabe', 2026));
        $this->assertNull($scorer->usageScore($vehicle, 'ciudad', 'mas_3000', 2026));
        foreach (['ruta', 'mixto', 'trabajo'] as $use) {
            $this->assertNull($scorer->usageScore($vehicle, $use, 'no_sabe', 2026));
        }
        $vehicle = $this->vehicle(['consumo_urbano' => null]);
        $this->assertSame(76.0, $scorer->usageScore($vehicle, 'ruta', 'no_sabe', 2026));
        foreach (['unknown', 'hibrido', 'electrico'] as $fuel) {
            $this->assertNull($scorer->usageScore($this->vehicle(['combustible' => $fuel]), 'ciudad', 'no_sabe', 2026));
        }
        $this->assertNull($scorer->usageScore($this->vehicle(), 'unknown', 'no_sabe', 2026));
        $this->assertNull($scorer->usageScore($this->vehicle(), 'ciudad', 'unknown', 2026));
    }

    public function test_automatic_maximum_is_below_100_after_positive_monthly_adjustment(): void
    {
        $vehicle = $this->vehicle(['anio' => 2026, 'kilometraje' => 0, 'combustible' => 'nafta', 'turbo' => false, 'consumo_ruta' => 6]);
        foreach (['ciudad', 'ruta', 'mixto'] as $use) {
            $this->assertSame(100.0, $this->scorer()->usageScore($vehicle, $use, 'no_sabe', 2026));
            $this->assertEqualsWithDelta(99.8125, $this->scorer()->usageScore($vehicle, $use, 'mas_3000', 2026), 0.0000001);
        }
        $vehicle->transmision = 'manual';
        foreach (DiagnosticoOptions::USO_PRINCIPAL as $use) {
            foreach (DiagnosticoOptions::KILOMETROS_MENSUALES as $monthly) {
                $this->assertSame(100.0, $this->scorer()->usageScore($vehicle, $use, $monthly, 2026));
            }
        }
    }

    public function test_gnc_reuses_the_consumption_override_without_litre_readings(): void
    {
        $vehicle = $this->vehicle([
            'anio' => 2026, 'kilometraje' => 0, 'combustible' => 'gnc', 'turbo' => false,
            'transmision' => 'manual', 'consumo_urbano' => null, 'consumo_ruta' => null,
        ]);
        $this->assertSame(100.0, $this->scorer()->usageScore($vehicle, 'mixto', 'no_sabe', 2026));
        $this->assertSame(99.25, $this->scorer()->usageScore($vehicle, 'trabajo', 'mas_3000', 2026));
    }

    public function test_explicit_year_and_scoring_do_not_mutate_facts(): void
    {
        $vehicle = $this->vehicle(['anio' => 2023, 'kilometraje' => 0, 'combustible' => 'nafta', 'turbo' => false, 'transmision' => 'manual']);
        $before = $vehicle->getAttributes();
        $scorer = $this->scorer();
        $this->assertSame(80.0, $scorer->usageScore($vehicle, 'trabajo', 'no_sabe', 2026));
        $this->assertSame(75.3125, $scorer->usageScore($vehicle, 'trabajo', 'no_sabe', 2030));
        $scorer->safetyScore($vehicle);
        $scorer->comfortScore($vehicle);
        $scorer->equipmentScore($vehicle, 'ciudad');
        $this->assertSame($before, $vehicle->getAttributes());
    }
}
