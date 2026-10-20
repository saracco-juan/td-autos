<?php

namespace Tests\Unit\Services\Matching;

use App\Models\Diagnostico;
use App\Models\TipoCarroceria;
use App\Models\Vehiculo;
use App\Models\VehiculoConcesionaria;
use App\Services\Matching\DealershipRanker;
use App\Support\VehiculoFields;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class DealershipRankerTest extends TestCase
{
    private function diagnosis(array $changes = []): Diagnostico
    {
        $diagnosis = new Diagnostico(array_replace([
            'estado' => 'completo', 'presupuesto_maximo' => 20000000,
            'uso_principal' => 'ciudad', 'pasajeros' => 4,
            'kilometros_mensuales' => 'menos_500', 'transmision_preferida' => 'manual',
            'prioridad_comprador' => 'consumo',
        ], $changes));

        $body = new TipoCarroceria;
        $body->id = 1;

        return $diagnosis->setRelation('carrocerias', collect([$body]));
    }

    private function vehicle(int $id = 1, array $changes = [], array $ownership = []): Vehiculo
    {
        $vehicle = new Vehiculo(array_replace(array_fill_keys(array_keys(VehiculoFields::EQUIPMENT_FIELDS), true), [
            'origen' => 'concesionaria', 'tipo_carroceria_id' => 1,
            'marca' => 'Test', 'modelo' => 'Example', 'anio' => 2025,
            'kilometraje' => 20000, 'precio' => '20000000.00', 'moneda' => 'ARS',
            'combustible' => 'nafta', 'transmision' => 'manual', 'plazas' => 5,
            'motor' => '1.6', 'turbo' => false, 'potencia' => 110, 'potencia_unidad' => 'CV',
            'consumo_urbano' => '6.00', 'consumo_ruta' => '5.00', 'ubicacion' => 'Test city',
        ], $changes));
        $vehicle->id = $id;

        return $vehicle->setRelation('propiedad', new VehiculoConcesionaria(array_replace([
            'vehiculo_id' => $id, 'concesionaria_id' => 7, 'visible' => true,
        ], $ownership)));
    }

    private function rank(array $vehicles, array $diagnosis = [], ?float $rate = 1000): array
    {
        return app(DealershipRanker::class)->rank($vehicles, $this->diagnosis($diagnosis), [7], 2026, $rate);
    }

    public function test_concrete_listings_rank_by_score_then_price_then_id_without_grouping(): void
    {
        $cars = [$this->vehicle(3), $this->vehicle(2), $this->vehicle(1, ['precio' => 19000000])];
        $result = $this->rank($cars);
        $this->assertSame('ready', $result['status']);
        $this->assertSame([1, 2, 3], array_column($result['results'], 'listing_id'));
        $this->assertSame(100.0, $result['results'][0]['score']);
        $this->assertSame([], $result['results'][0]['warnings']);
        $this->assertSame(19000000.0, $result['results'][0]['price_ars']);
        $this->assertSame(19000.0, $result['results'][0]['price_usd']);
        $this->assertSame(['usage' => 100.0, 'body' => 100, 'priority' => 100, 'comfort' => 100], $result['results'][0]['components']);
    }

    #[DataProvider('excludedCars')]
    public function test_ineligible_or_incomplete_facts_never_enter_ranking(array $changes, array $ownership = []): void
    {
        $this->assertSame([], $this->rank([$this->vehicle(1, $changes, $ownership)])['results']);
    }

    public static function excludedCars(): array
    {
        return [
            'external' => [['origen' => 'externo']], 'hidden' => [[], ['visible' => false]],
            'inactive dealer' => [[], ['concesionaria_id' => 8]], 'seats' => [['plazas' => 3]],
            'transmission' => [['transmision' => 'automatica']], 'hybrid' => [['combustible' => 'hibrido']],
            'electric' => [['combustible' => 'electrico']], 'unknown equipment' => [['asistencia_velocidad' => null]],
            'unknown engine' => [['motor' => null]], 'power' => [['potencia' => null]],
            'missing road consumption' => [['consumo_ruta' => null]], 'invalid price' => [['precio' => 0]],
            'invalid equipment' => [['frenos_abs' => 2]], 'invalid seats' => [['plazas' => 0]],
        ];
    }

    public function test_missing_loaded_ownership_or_incomplete_diagnosis_does_not_query_database(): void
    {
        $car = $this->vehicle()->unsetRelation('propiedad');
        $this->assertSame([], $this->rank([$car])['results']);
        $result = $this->rank([$this->vehicle()], ['estado' => 'requiere_confirmacion']);
        $this->assertSame('diagnosis_incomplete', $result['status']);
        $this->assertSame([], $result['results']);
        $this->assertSame('resale_pending', $this->rank([$this->vehicle()], ['prioridad_comprador' => 'reventa'])['status']);
    }

    #[DataProvider('budgetCases')]
    public function test_budget_boundaries_and_proportional_penalty(float $price, ?float $expected): void
    {
        $results = $this->rank([$this->vehicle(1, ['precio' => $price])])['results'];
        if ($expected === null) {
            $this->assertSame([], $results);

            return;
        }
        $this->assertEqualsWithDelta($expected, $results[0]['score'], 0.000001);
        $this->assertSame($price > 20000000 ? ['budget_exceeded'] : [], $results[0]['warnings']);
        $this->assertEqualsWithDelta(100 - $expected, $results[0]['budget_penalty'], 0.000001);
    }

    public static function budgetCases(): array
    {
        return [[20000000, 100], [20500000, 95], [21000000, 90], [21000000.01, null]];
    }

    public function test_overbudget_requires_perfect_adjusted_use_priority_and_body_not_general_comfort(): void
    {
        $car = $this->vehicle(1, ['precio' => 20600000, 'volante_regulable' => false, 'climatizador_bizona' => false]);
        $row = $this->rank([$car])['results'][0];
        $this->assertSame(65, $row['components']['comfort']);
        $this->assertEqualsWithDelta(90.5, $row['score'], 0.000001);
        foreach ([['tipo_carroceria_id' => 2], ['consumo_urbano' => 7], ['transmision' => 'automatica']] as $changes) {
            $this->assertSame([], $this->rank([$this->vehicle(1, ['precio' => 21000000] + $changes)], [
                'transmision_preferida' => 'indiferente', 'kilometros_mensuales' => '500_1500',
            ])['results']);
        }
        $this->assertSame([], $this->rank([$this->vehicle(1, ['precio' => 21000000, 'frenos_abs' => false])],
            ['prioridad_comprador' => 'seguridad'])['results']);
    }

    public function test_body_preference_threshold_and_top_ten_use_unrounded_scores(): void
    {
        $cars = array_map(fn ($id) => $this->vehicle($id), range(1, 12));
        $this->assertCount(10, $this->rank($cars)['results']);
        $mismatch = $this->rank([$this->vehicle(1, ['tipo_carroceria_id' => 2])])['results'][0];
        $this->assertSame(85.0, $mismatch['score']);
        $this->assertSame(['body_mismatch'], $mismatch['warnings']);
        $this->assertSame([], $this->rank([])['results']);
        $low = $this->vehicle(1, ['tipo_carroceria_id' => 2, 'consumo_urbano' => 12.1]);
        $this->assertSame([], $this->rank([$low])['results']);
    }

    public function test_usd_conversion_missing_quote_and_uncapped_budget(): void
    {
        $car = $this->vehicle(1, ['moneda' => 'USD', 'precio' => 21000]);
        $row = $this->rank([$car])['results'][0];
        $this->assertSame(21000000.0, $row['price_ars']);
        $this->assertSame(21000.0, $row['price_usd']);
        $this->assertSame('USD', $row['published_currency']);
        $this->assertSame([], $this->rank([$car], [], null)['results']);
        $this->assertNull($this->rank([$this->vehicle()], [], null)['results'][0]['price_usd']);
        $this->assertSame(100.0, $this->rank([$car], ['presupuesto_maximo' => null])['results'][0]['score']);
        $this->assertCount(1, $this->rank([$this->vehicle(1, ['combustible' => 'gnc', 'consumo_urbano' => null,
            'consumo_ruta' => null, 'transmision' => 'automatica'])], ['transmision_preferida' => 'indiferente'])['results']);
    }

    public function test_minimum_is_inclusive_but_a_score_rounding_to_70_is_not_admitted(): void
    {
        $noComfort = array_fill_keys(['volante_regulable', 'climatizador_bizona', 'butacas_calefaccionadas',
            'android_auto_apple_carplay', 'sensores_estacionamiento', 'velocidad_crucero', 'camara_retroceso'], false);
        $car = $this->vehicle(1, $noComfort + ['tipo_carroceria_id' => 2, 'frenos_abs' => false,
            'isofix' => false, 'asistencia_velocidad' => false, 'monitoreo_conductor' => false]);
        $this->assertSame(70.0, $this->rank([$car], ['uso_principal' => 'trabajo',
            'prioridad_comprador' => 'seguridad'])['results'][0]['score']);
        $near = $this->vehicle(1, $noComfort + ['tipo_carroceria_id' => 2, 'frenos_abs' => false]);
        // Route usage 85.6, body 50, consumption 100, comfort 0 => 69.96, not 70.
        $this->assertSame([], $this->rank([$near], ['uso_principal' => 'ruta',
            'kilometros_mensuales' => '1500_3000'])['results']);
    }

    public function test_diagnosis_changes_recalculate_and_both_body_choices_have_equal_preference(): void
    {
        $car = $this->vehicle(1, ['consumo_urbano' => 8, 'consumo_ruta' => 5, 'plazas' => 5]);
        $city = $this->rank([$car])['results'][0];
        $road = $this->rank([$car], ['uso_principal' => 'ruta'])['results'][0];
        $this->assertGreaterThan($city['score'], $road['score']);
        $this->assertSame([], $this->rank([$car], ['pasajeros' => 6])['results']);
        $this->assertCount(1, $this->rank([$this->vehicle(1, ['plazas' => 6])], ['pasajeros' => 6])['results']);
        $diagnosis = $this->diagnosis();
        $second = new TipoCarroceria;
        $second->id = 2;
        $diagnosis->carrocerias->push($second);
        $rows = app(DealershipRanker::class)->rank([$this->vehicle(2, ['tipo_carroceria_id' => 2]),
            $this->vehicle(1)], $diagnosis, [7], 2026, 1000)['results'];
        $this->assertSame([1, 2], array_column($rows, 'listing_id'));
        $this->assertSame([100.0, 100.0], array_column($rows, 'score'));
        $ranked = $this->rank([$this->vehicle(1, ['precio' => 19000000, 'consumo_urbano' => 8]),
            $this->vehicle(2)])['results'];
        $this->assertSame([2, 1], array_column($ranked, 'listing_id'));
        $this->assertSame(97.5, $this->rank([$this->vehicle(1, ['transmision' => 'automatica'])], [
            'prioridad_comprador' => 'mantenimiento', 'transmision_preferida' => 'indiferente',
        ])['results'][0]['components']['priority']);
    }
}
