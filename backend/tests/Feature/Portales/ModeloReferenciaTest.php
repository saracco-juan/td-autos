<?php

namespace Tests\Feature\Portales;

use App\Models\ModeloReferencia;
use App\Models\TipoCarroceria;
use App\Repositories\ModeloReferenciaRepository;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class ModeloReferenciaTest extends TestCase
{
    use RefreshDatabase;

    public function test_the_table_has_the_expected_columns_and_a_unique_brand_model_pair(): void
    {
        $this->assertSame([
            'id', 'marca', 'modelo', 'tipo_carroceria_id', 'plazas', 'tiene_manual', 'tiene_automatica',
            'combustibles', 'consumo', 'seguridad_estrellas', 'usos', 'ruta_mercadolibre', 'ruta_kavak', 'nombres_inventario',
        ], Schema::getColumnListing('modelo_referencia'));

        $nullable = collect(Schema::getColumns('modelo_referencia'))->where('nullable', true)->pluck('name')->all();
        $this->assertEqualsCanonicalizing(['seguridad_estrellas', 'ruta_kavak', 'nombres_inventario'], $nullable);

        $unique = collect(Schema::getIndexes('modelo_referencia'))
            ->filter(fn (array $index) => $index['unique'] && ! $index['primary'])->pluck('columns')->all();
        $this->assertSame([['marca', 'modelo']], $unique);
    }

    public function test_it_casts_flags_and_lists_and_loads_the_body_type(): void
    {
        $this->makeModel('TOYOTA', 'Etios', ['combustibles' => ['nafta', 'gnc'], 'usos' => ['ciudad']]);

        $model = ModeloReferencia::query()->firstOrFail();

        $this->assertTrue($model->tiene_manual);
        $this->assertFalse($model->tiene_automatica);
        $this->assertSame(['nafta', 'gnc'], $model->combustibles);
        $this->assertSame(['ciudad'], $model->usos);
        $this->assertSame('Hatchback', $model->tipoCarroceria->nombre);
    }

    public function test_the_same_brand_and_model_cannot_be_stored_twice(): void
    {
        $this->makeModel('TOYOTA', 'Etios');

        $this->expectException(QueryException::class);
        $this->makeModel('TOYOTA', 'Etios');
    }

    public function test_the_repository_returns_every_model_ordered_by_brand_then_model_with_the_body_type(): void
    {
        $this->makeModel('VOLKSWAGEN', 'Gol');
        $this->makeModel('FORD', 'Ranger', ['tipo' => 'Pickup']);
        $this->makeModel('FORD', 'KA');

        $all = app(ModeloReferenciaRepository::class)->all();

        $this->assertSame(['FORD KA', 'FORD Ranger', 'VOLKSWAGEN Gol'], $all->map(fn ($m) => $m->marca.' '.$m->modelo)->all());
        $this->assertTrue($all->every(fn ($m) => $m->relationLoaded('tipoCarroceria')));
        $this->assertSame('Pickup', $all[1]->tipoCarroceria->nombre);
    }

    /**
     * @param  array<string, mixed>  $overrides
     */
    private function makeModel(string $marca, string $modelo, array $overrides = []): ModeloReferencia
    {
        $tipo = TipoCarroceria::query()->where('nombre', $overrides['tipo'] ?? 'Hatchback')->firstOrFail();
        unset($overrides['tipo']);

        return ModeloReferencia::query()->create($overrides + [
            'marca' => $marca,
            'modelo' => $modelo,
            'tipo_carroceria_id' => $tipo->id,
            'plazas' => 5,
            'tiene_manual' => true,
            'tiene_automatica' => false,
            'combustibles' => ['nafta'],
            'consumo' => 'bajo',
            'seguridad_estrellas' => null,
            'usos' => ['ciudad'],
            'ruta_mercadolibre' => strtolower($marca).'/'.strtolower($modelo),
            'ruta_kavak' => null,
        ]);
    }
}
