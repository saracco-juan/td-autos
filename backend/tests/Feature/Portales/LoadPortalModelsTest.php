<?php

namespace Tests\Feature\Portales;

use App\Models\ModeloReferencia;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class LoadPortalModelsTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_creates_the_rows_resolving_the_body_type_name(): void
    {
        $this->artisan('portales:load-models', ['--path' => $this->fixture('valid.json')])
            ->expectsOutputToContain('2 created, 0 updated, 0 unchanged')
            ->assertSuccessful();

        $ranger = ModeloReferencia::query()->where('modelo', 'Ranger')->firstOrFail();
        $this->assertSame('Pickup', $ranger->tipoCarroceria->nombre);
        $this->assertSame(['nafta', 'diesel'], $ranger->combustibles);
        $this->assertSame(4, $ranger->seguridad_estrellas);
        $this->assertNull($ranger->ruta_kavak);
        $this->assertSame(2, ModeloReferencia::query()->count());
    }

    public function test_a_second_run_changes_nothing(): void
    {
        $this->artisan('portales:load-models', ['--path' => $this->fixture('valid.json')])->assertSuccessful();

        $this->artisan('portales:load-models', ['--path' => $this->fixture('valid.json')])
            ->expectsOutputToContain('0 created, 0 updated, 2 unchanged')
            ->assertSuccessful();

        $this->assertSame(2, ModeloReferencia::query()->count());
    }

    public function test_a_changed_row_is_updated_in_place(): void
    {
        $this->artisan('portales:load-models', ['--path' => $this->fixture('valid.json')])->assertSuccessful();
        $id = ModeloReferencia::query()->where('modelo', 'Etios')->value('id');
        ModeloReferencia::query()->where('modelo', 'Etios')->update(['consumo' => 'alto', 'plazas' => 4]);

        $this->artisan('portales:load-models', ['--path' => $this->fixture('valid.json')])
            ->expectsOutputToContain('0 created, 1 updated, 1 unchanged')
            ->assertSuccessful();

        $etios = ModeloReferencia::query()->findOrFail($id);
        $this->assertSame('bajo', $etios->consumo);
        $this->assertSame(5, $etios->plazas);
    }

    public function test_an_unknown_body_type_fails_naming_the_row_and_stores_nothing(): void
    {
        $this->artisan('portales:load-models', ['--path' => $this->fixture('unknown-body.json')])
            ->expectsOutputToContain('Portal models not loaded: TOYOTA Etios: unknown body type "Hovercraft"')
            ->assertFailed();

        $this->assertSame(0, ModeloReferencia::query()->count());
    }

    public function test_a_missing_file_fails(): void
    {
        $this->artisan('portales:load-models', ['--path' => $this->fixture('missing.json')])
            ->expectsOutputToContain('Portal models not loaded')
            ->assertFailed();
    }

    public function test_it_stores_the_inventory_names_and_a_second_run_leaves_them_unchanged(): void
    {
        $this->artisan('portales:load-models', ['--path' => $this->fixture('with-aliases.json')])->assertSuccessful();

        $this->assertSame(['Etios Hatch', 'Etios X'], ModeloReferencia::query()->where('modelo', 'Etios')->value('nombres_inventario'));
        $this->assertNull(ModeloReferencia::query()->where('modelo', 'Ranger')->value('nombres_inventario'));

        $this->artisan('portales:load-models', ['--path' => $this->fixture('with-aliases.json')])
            ->expectsOutputToContain('0 created, 0 updated, 2 unchanged')
            ->assertSuccessful();
    }

    public function test_a_changed_alias_list_updates_the_row(): void
    {
        $this->artisan('portales:load-models', ['--path' => $this->fixture('valid.json')])->assertSuccessful();

        $this->artisan('portales:load-models', ['--path' => $this->fixture('with-aliases.json')])
            ->expectsOutputToContain('0 created, 1 updated, 1 unchanged')
            ->assertSuccessful();
    }

    #[DataProvider('invalidAliases')]
    public function test_invalid_inventory_names_fail_and_store_nothing(string $fixture): void
    {
        $this->artisan('portales:load-models', ['--path' => $this->fixture($fixture)])
            ->expectsOutputToContain('Portal models not loaded: TOYOTA Etios: nombres_inventario must be a list of non-empty strings')
            ->assertFailed();

        $this->assertSame(0, ModeloReferencia::query()->count());
    }

    /** @return array<string, array{string}> */
    public static function invalidAliases(): array
    {
        return [
            'not a list' => ['aliases-not-a-list.json'],
            'blank name' => ['aliases-blank.json'],
            'non-string name' => ['aliases-non-string.json'],
        ];
    }

    private function fixture(string $name): string
    {
        return base_path('tests/Fixtures/portal-models/'.$name);
    }
}
