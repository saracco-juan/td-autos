<?php

namespace Tests\Unit\Services\Portales;

use App\Models\Diagnostico;
use App\Models\ModeloReferencia;
use App\Models\TipoCarroceria;
use App\Services\Portales\ModelFit;
use App\Services\Portales\ModelRecommendation;
use App\Services\Portales\ModelRecommender;
use Tests\TestCase;

class ModelRecommenderTest extends TestCase
{
    private const BODIES = [1 => 'Sedán', 2 => 'Hatchback', 3 => 'SUV', 4 => 'Pickup'];

    private int $nextId = 0;

    /** @var array<int, ModelFit> */
    private array $fits = [];

    /**
     * @param  array<string, mixed>  $changes  `body` picks the body type id (default 2, Hatchback).
     * @param  array<string, mixed>  $fit  Overrides of the fit: years, min, max, usd.
     */
    private function model(string $marca, string $modelo, array $changes = [], array $fit = []): ModeloReferencia
    {
        $body = $changes['body'] ?? 2;
        unset($changes['body']);
        $model = new ModeloReferencia($changes + [
            'marca' => $marca, 'modelo' => $modelo, 'tipo_carroceria_id' => $body, 'plazas' => 5,
            'tiene_manual' => true, 'tiene_automatica' => true, 'combustibles' => ['nafta'], 'consumo' => 'medio',
            'seguridad_estrellas' => null, 'usos' => ['ciudad', 'ruta'],
            'ruta_mercadolibre' => strtolower($marca).'/'.strtolower($modelo), 'ruta_kavak' => strtolower($marca).'/'.strtolower($modelo),
        ]);
        $model->forceFill(['id' => ++$this->nextId]);
        $model->setRelation('tipoCarroceria', (new TipoCarroceria)->forceFill(['id' => $body, 'nombre' => self::BODIES[$body]]));
        $years = $fit['years'] ?? [2020, 2021];
        $this->fits[$model->id] = new ModelFit($model->id, $years, max($years), $fit['min'] ?? 15000000, $fit['max'] ?? 22000000, $fit['usd'] ?? false);

        return $model;
    }

    /**
     * @param  list<int>  $bodies
     */
    private function diagnosis(array $changes = [], array $bodies = [2]): Diagnostico
    {
        $diagnosis = new Diagnostico($changes + [
            'presupuesto_maximo' => 20000000, 'uso_principal' => 'ciudad', 'pasajeros' => 4,
            'transmision_preferida' => 'indiferente', 'prioridad_comprador' => 'mantenimiento', 'estado' => 'completo',
        ]);
        $diagnosis->setRelation('carrocerias', collect($bodies)->map(
            fn (int $id) => (new TipoCarroceria)->forceFill(['id' => $id, 'nombre' => self::BODIES[$id]])));

        return $diagnosis;
    }

    /**
     * @param  list<ModeloReferencia>  $models
     * @return list<ModelRecommendation>
     */
    private function recommend(array $models, ?Diagnostico $diagnosis = null): array
    {
        return (new ModelRecommender)->recommend($models, $this->fits, $diagnosis ?? $this->diagnosis());
    }

    /**
     * @param  list<ModelRecommendation>  $recommendations
     * @return list<string>
     */
    private function names(array $recommendations): array
    {
        return array_map(fn (ModelRecommendation $r) => $r->payload['marca'].' '.$r->payload['modelo'], $recommendations);
    }

    public function test_only_models_of_the_chosen_bodies_with_enough_seats_and_the_transmission_remain(): void
    {
        $models = [
            $this->model('A', 'Hatch'),
            $this->model('A', 'Sedan', ['body' => 1]),
            $this->model('A', 'Suv', ['body' => 3]),
            $this->model('A', 'Small', ['plazas' => 4]),
            $this->model('A', 'Manual', ['tiene_automatica' => false]),
            $this->model('A', 'Auto', ['tiene_manual' => false]),
        ];

        $this->assertEqualsCanonicalizing(['A Hatch', 'A Small', 'A Manual', 'A Auto'], $this->names($this->recommend($models)));
        $this->assertEqualsCanonicalizing(['A Hatch', 'A Sedan', 'A Small', 'A Manual', 'A Auto'],
            $this->names($this->recommend($models, $this->diagnosis([], [1, 2]))));
        $this->assertEqualsCanonicalizing(['A Hatch', 'A Manual', 'A Auto'],
            $this->names($this->recommend($models, $this->diagnosis(['pasajeros' => 5]))));
        $this->assertEqualsCanonicalizing(['A Hatch', 'A Small', 'A Auto'],
            $this->names($this->recommend($models, $this->diagnosis(['transmision_preferida' => 'automatica']))));
        $this->assertEqualsCanonicalizing(['A Hatch', 'A Small', 'A Manual'],
            $this->names($this->recommend($models, $this->diagnosis(['transmision_preferida' => 'manual']))));
    }

    public function test_models_without_a_fitting_year_are_left_out(): void
    {
        $models = [$this->model('A', 'Fits'), $this->model('A', 'Dear')];
        unset($this->fits[2]);

        $this->assertSame(['A Fits'], $this->names($this->recommend($models)));
    }

    public function test_models_are_ordered_by_use_and_priority_score(): void
    {
        $models = [
            $this->model('A', 'Thirsty', ['consumo' => 'alto']),
            $this->model('A', 'Frugal', ['consumo' => 'bajo']),
            $this->model('A', 'Highway', ['consumo' => 'bajo', 'usos' => ['ruta']]),
        ];

        $this->assertSame(['A Frugal', 'A Highway', 'A Thirsty'],
            $this->names($this->recommend($models, $this->diagnosis(['prioridad_comprador' => 'consumo']))));
    }

    public function test_ties_go_to_more_fitting_years_then_brand_then_model(): void
    {
        $models = [
            $this->model('B', 'Z'),
            $this->model('B', 'A'),
            $this->model('A', 'Z'),
            $this->model('C', 'Old', [], ['years' => [2018, 2019, 2020]]),
        ];

        $this->assertSame(['C Old', 'A Z', 'B A', 'B Z'], $this->names($this->recommend($models)));
        $this->assertSame(['C Old', 'A Z', 'B A', 'B Z'], $this->names($this->recommend(array_reverse($models))));
    }

    public function test_it_returns_at_most_eight_models(): void
    {
        $models = [];
        foreach (range(1, 11) as $number) {
            $models[] = $this->model('A', sprintf('M%02d', $number));
        }

        $names = $this->names($this->recommend($models));

        $this->assertCount(8, $names);
        $this->assertSame('A M01', $names[0]);
    }

    public function test_the_payload_describes_the_model_its_prices_and_the_reasons(): void
    {
        $model = $this->model('TOYOTA', 'Etios', ['consumo' => 'bajo', 'usos' => ['ciudad']],
            ['years' => [2019, 2020, 2021], 'min' => 15000000, 'max' => 22000000, 'usd' => true]);

        $recommendation = $this->recommend([$model], $this->diagnosis(['prioridad_comprador' => 'consumo']))[0];

        $this->assertTrue($recommendation->usedUsd);
        $this->assertSame([
            'id' => $model->id, 'marca' => 'TOYOTA', 'modelo' => 'Etios', 'carroceria' => 'Hatchback',
            'anios' => ['desde' => 2019, 'hasta' => 2021],
            'precio' => ['desde_ars' => 15000000, 'hasta_ars' => 22000000, 'anio_referencia' => 2021],
            'motivos' => ['Consumo bajo', 'Apto para ciudad', '5 plazas'],
        ], array_intersect_key($recommendation->payload, array_flip(['id', 'marca', 'modelo', 'carroceria', 'anios', 'precio', 'motivos'])));
    }

    public function test_reasons_cover_safety_work_and_a_fallback_so_there_are_always_at_least_two(): void
    {
        $safe = $this->model('A', 'Safe', ['seguridad_estrellas' => 5, 'usos' => ['trabajo']]);
        $plain = $this->model('A', 'Plain', ['usos' => ['trabajo']]);

        $work = $this->recommend([$safe], $this->diagnosis(['uso_principal' => 'trabajo', 'prioridad_comprador' => 'seguridad']))[0];
        $mixed = $this->recommend([$safe], $this->diagnosis(['uso_principal' => 'mixto', 'prioridad_comprador' => 'seguridad']))[0];
        $fallback = $this->recommend([$plain], $this->diagnosis(['uso_principal' => 'ciudad']))[0];

        $this->assertSame(['Seguridad 5 estrellas', 'Apto para trabajo', '5 plazas'], $work->payload['motivos']);
        $this->assertSame(['Seguridad 5 estrellas', '5 plazas'], $mixed->payload['motivos']);
        $this->assertSame(['5 plazas', 'Carrocería Hatchback'], $fallback->payload['motivos']);
    }

    public function test_mixed_use_is_a_reason_only_for_models_that_list_city_and_highway(): void
    {
        $model = $this->model('A', 'Both');

        $motivos = $this->recommend([$model], $this->diagnosis(['uso_principal' => 'mixto']))[0]->payload['motivos'];

        $this->assertSame(['Apto para ciudad y ruta', '5 plazas'], $motivos);
    }

    public function test_links_carry_only_the_transmission_years_body_and_budget_filters(): void
    {
        $sedan = $this->model('TOYOTA', 'Corolla', ['body' => 1, 'ruta_kavak' => null], ['years' => [2018, 2021]]);

        $links = $this->recommend([$sedan], $this->diagnosis(['transmision_preferida' => 'automatica'], [1]))[0]->payload['links'];

        $this->assertSame([['portal' => 'mercadolibre', 'nombre' => 'Mercado Libre',
            'url' => 'https://autos.mercadolibre.com.ar/toyota/corolla/automatica/2018-2021/_PriceRange_0ARS-20000000ARS_VEHICLE*BODY*TYPE_452758']], $links);
    }

    public function test_the_kavak_link_carries_the_transmission_and_no_other_filter(): void
    {
        $model = $this->model('FORD', 'Fiesta', [], ['years' => [2022, 2023]]);

        $links = $this->recommend([$model], $this->diagnosis(['transmision_preferida' => 'manual']))[0]->payload['links'];

        $this->assertSame('https://www.kavak.com/ar/usados/ford/fiesta/manual', $links[1]['url']);
    }

    public function test_every_portal_with_a_route_gets_a_link_and_no_cap_adds_no_price_filter(): void
    {
        $model = $this->model('FORD', 'Fiesta', [], ['years' => [2022, 2023]]);

        $links = $this->recommend([$model], $this->diagnosis(['presupuesto_maximo' => null]))[0]->payload['links'];

        $this->assertSame(['mercadolibre', 'kavak'], array_column($links, 'portal'));
        $this->assertSame('https://autos.mercadolibre.com.ar/ford/fiesta/2022-2023/_VEHICLE*BODY*TYPE_479344', $links[0]['url']);
        $this->assertSame('https://www.kavak.com/ar/usados/ford/fiesta', $links[1]['url']);
    }

    public function test_bodies_the_portals_do_not_filter_by_add_no_body_filter_or_chip(): void
    {
        $suv = $this->model('JEEP', 'Renegade', ['body' => 3], ['years' => [2020]]);

        $recommendation = $this->recommend([$suv], $this->diagnosis([], [3]))[0];

        $this->assertSame('https://autos.mercadolibre.com.ar/jeep/renegade/2020/_PriceRange_0ARS-20000000ARS', $recommendation->payload['links'][0]['url']);
        $this->assertSame(['2020', 'Hasta $ 20.000.000'], $recommendation->payload['filtros']);
    }

    public function test_the_chips_name_what_the_links_filter(): void
    {
        $model = $this->model('VOLKSWAGEN', 'Polo', [], ['years' => [2018, 2019, 2021]]);

        $with = $this->recommend([$model], $this->diagnosis(['transmision_preferida' => 'manual']))[0]->payload['filtros'];
        $without = $this->recommend([$model], $this->diagnosis(['presupuesto_maximo' => null]))[0]->payload['filtros'];

        $this->assertSame(['Manual', 'Hatchback', '2018–2021', 'Hasta $ 20.000.000'], $with);
        $this->assertSame(['Hatchback', '2018–2021'], $without);
    }

    public function test_a_budget_stored_as_a_decimal_string_is_read_in_whole_pesos(): void
    {
        $model = $this->model('FORD', 'Ka');

        $payload = $this->recommend([$model], $this->diagnosis(['presupuesto_maximo' => '25000000.00']))[0]->payload;

        $this->assertStringContainsString('_PriceRange_0ARS-25000000ARS', $payload['links'][0]['url']);
        $this->assertContains('Hasta $ 25.000.000', $payload['filtros']);
    }
}
