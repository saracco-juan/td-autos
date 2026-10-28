<?php

namespace Tests\Feature\Portales;

use App\Models\ModeloReferencia;
use Illuminate\Foundation\Testing\RefreshDatabase;
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
        $this->assertNull($ranger->imagen_url);
        $this->assertNull($ranger->imagen_autor);
        $this->assertSame(2, ModeloReferencia::query()->count());
    }

    public function test_it_stores_the_photo_credit_of_a_model_that_has_one(): void
    {
        $this->artisan('portales:load-models', ['--path' => $this->fixture('valid.json')])->assertSuccessful();

        $etios = ModeloReferencia::query()->where('modelo', 'Etios')->firstOrFail();
        $this->assertSame('https://upload.wikimedia.org/wikipedia/commons/thumb/b/b7/Etios.jpg/500px-Etios.jpg', $etios->imagen_url);
        $this->assertSame('Maxi-Napo-99', $etios->imagen_autor);
        $this->assertSame('CC BY 4.0', $etios->imagen_licencia);
        $this->assertSame('https://commons.wikimedia.org/wiki/File:Etios.jpg', $etios->imagen_pagina);
    }

    public function test_a_photo_needs_all_four_fields_or_none_and_nothing_is_stored(): void
    {
        $this->artisan('portales:load-models', ['--path' => $this->fixture('partial-image.json')])
            ->expectsOutputToContain('Portal models not loaded: TOYOTA Etios: the photo needs imagen_url, imagen_autor, imagen_licencia and imagen_pagina, or none')
            ->assertFailed();

        $this->assertSame(0, ModeloReferencia::query()->count());
    }

    public function test_a_removed_photo_is_cleared_on_the_next_run(): void
    {
        $this->artisan('portales:load-models', ['--path' => $this->fixture('valid.json')])->assertSuccessful();
        ModeloReferencia::query()->where('modelo', 'Ranger')->update(['imagen_url' => 'x', 'imagen_autor' => 'x', 'imagen_licencia' => 'x', 'imagen_pagina' => 'x']);

        $this->artisan('portales:load-models', ['--path' => $this->fixture('valid.json')])
            ->expectsOutputToContain('0 created, 1 updated, 1 unchanged')->assertSuccessful();

        $this->assertNull(ModeloReferencia::query()->where('modelo', 'Ranger')->value('imagen_url'));
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

    private function fixture(string $name): string
    {
        return base_path('tests/Fixtures/portal-models/'.$name);
    }
}
