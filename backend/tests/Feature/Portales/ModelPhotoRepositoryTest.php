<?php

namespace Tests\Feature\Portales;

use App\Models\Concesionaria;
use App\Models\Suscripcion;
use App\Models\Vehiculo;
use App\Models\VehiculoConcesionaria;
use App\Repositories\ModelPhotoRepository;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class ModelPhotoRepositoryTest extends TestCase
{
    use RefreshDatabase;

    private function dealer(): Concesionaria
    {
        $dealer = Concesionaria::factory()->active()->create();
        Suscripcion::factory()->create(['concesionaria_id' => $dealer->id, 'estado' => 'activa',
            'vigente_hasta' => now()->addMonth()->toDateString()]);

        return $dealer;
    }

    /** @param  list<string>  $photos  Stored locations, in cover order. */
    private function car(string $marca, string $modelo, array $photos, ?Concesionaria $dealer = null, bool $visible = true): Vehiculo
    {
        $dealer ??= $this->dealer();
        $car = Vehiculo::factory()->create(['marca' => $marca, 'modelo' => $modelo]);
        VehiculoConcesionaria::factory()->create(['vehiculo_id' => $car->id, 'concesionaria_id' => $dealer->id, 'visible' => $visible]);
        foreach ($photos as $order => $location) {
            $car->fotos()->create(['ubicacion_archivo' => $location, 'orden' => $order + 1]);
        }

        return $car;
    }

    /**
     * @param  list<array{marca: string, modelo: string}>  $models
     * @return array<string, string>
     */
    private function resolve(array $models, Concesionaria ...$operative): array
    {
        return (new ModelPhotoRepository)->coverUrls($models, array_map(fn (Concesionaria $dealer) => $dealer->id, $operative));
    }

    public function test_the_photo_is_the_cover_of_a_visible_vehicle_of_an_operative_dealer(): void
    {
        $dealer = $this->dealer();
        $this->car('TOYOTA', 'Etios', ['https://example.test/cover.jpg', 'https://example.test/second.jpg'], $dealer);

        $urls = $this->resolve([['marca' => 'TOYOTA', 'modelo' => 'Etios']], $dealer);

        $this->assertSame(['https://example.test/cover.jpg'], array_values($urls));
        $this->assertSame('https://example.test/cover.jpg', $urls[ModelPhotoRepository::key('TOYOTA', 'Etios')]);
    }

    public function test_a_stored_file_is_served_through_the_vehicle_photos_disk_url(): void
    {
        $dealer = $this->dealer();
        $this->car('TOYOTA', 'Etios', ['vehiculos/1/a.jpg'], $dealer);

        $url = array_values($this->resolve([['marca' => 'TOYOTA', 'modelo' => 'Etios']], $dealer))[0];

        $this->assertStringEndsWith('/vehiculos/1/a.jpg', $url);
        $this->assertStringStartsWith('http', $url);
    }

    public function test_a_vehicle_of_a_dealer_that_is_not_operative_is_ignored(): void
    {
        $operative = $this->dealer();
        $notOperative = $this->dealer();
        $this->car('TOYOTA', 'Etios', ['https://example.test/not-operative.jpg'], $notOperative);

        $this->assertSame([], $this->resolve([['marca' => 'TOYOTA', 'modelo' => 'Etios']], $operative));
    }

    public function test_a_hidden_vehicle_is_ignored(): void
    {
        $dealer = $this->dealer();
        $this->car('TOYOTA', 'Etios', ['https://example.test/hidden.jpg'], $dealer, visible: false);

        $this->assertSame([], $this->resolve([['marca' => 'TOYOTA', 'modelo' => 'Etios']], $dealer));
    }

    public function test_an_external_listing_is_ignored(): void
    {
        $dealer = $this->dealer();
        $this->car('TOYOTA', 'Etios', ['https://example.test/external.jpg'], $dealer)->update(['origen' => 'externo']);

        $this->assertSame([], $this->resolve([['marca' => 'TOYOTA', 'modelo' => 'Etios']], $dealer));
    }

    public function test_the_newest_vehicle_wins(): void
    {
        $dealer = $this->dealer();
        $this->car('TOYOTA', 'Etios', ['https://example.test/older.jpg'], $dealer);
        $this->car('TOYOTA', 'Etios', ['https://example.test/newest.jpg'], $dealer);
        $this->car('TOYOTA', 'Corolla', ['https://example.test/other-model.jpg'], $dealer);

        $urls = $this->resolve([['marca' => 'TOYOTA', 'modelo' => 'Etios']], $dealer);

        $this->assertSame(['https://example.test/newest.jpg'], array_values($urls));
    }

    public function test_vehicles_without_photos_are_skipped(): void
    {
        $dealer = $this->dealer();
        $this->car('TOYOTA', 'Etios', ['https://example.test/with-photo.jpg'], $dealer);
        $this->car('TOYOTA', 'Etios', [], $dealer);

        $urls = $this->resolve([['marca' => 'TOYOTA', 'modelo' => 'Etios']], $dealer);

        $this->assertSame(['https://example.test/with-photo.jpg'], array_values($urls));
    }

    public function test_a_model_without_a_matching_vehicle_has_no_entry(): void
    {
        $dealer = $this->dealer();
        $this->car('TOYOTA', 'Etios', ['https://example.test/a.jpg'], $dealer);

        $this->assertSame([], $this->resolve([['marca' => 'FORD', 'modelo' => 'Ka']], $dealer));
        $this->assertSame([], $this->resolve([], $dealer));
        $this->assertSame([], (new ModelPhotoRepository)->coverUrls([['marca' => 'TOYOTA', 'modelo' => 'Etios']], []));
    }

    public function test_the_match_ignores_case_and_needs_the_same_spelling(): void
    {
        $dealer = $this->dealer();
        $this->car('Toyota', 'ETIOS', ['https://example.test/mixed-case.jpg'], $dealer);
        $this->car('TOYOTA', 'Etios Cross', ['https://example.test/other-spelling.jpg'], $dealer);

        $urls = $this->resolve([['marca' => 'TOYOTA', 'modelo' => 'Etios']], $dealer);

        $this->assertSame(['https://example.test/mixed-case.jpg'], array_values($urls));
    }

    public function test_the_cover_is_the_photo_with_the_lowest_order(): void
    {
        $dealer = $this->dealer();
        $car = $this->car('TOYOTA', 'Etios', [], $dealer);
        $car->fotos()->create(['ubicacion_archivo' => 'https://example.test/third.jpg', 'orden' => 3]);
        $car->fotos()->create(['ubicacion_archivo' => 'https://example.test/first.jpg', 'orden' => 1]);

        $urls = $this->resolve([['marca' => 'TOYOTA', 'modelo' => 'Etios']], $dealer);

        $this->assertSame(['https://example.test/first.jpg'], array_values($urls));
    }

    public function test_all_the_models_are_resolved_with_two_queries(): void
    {
        $dealer = $this->dealer();
        $models = [];
        foreach (['Etios', 'Corolla', 'Yaris', 'Hilux', 'Gol', 'Polo', 'Ka', 'Fiesta', 'Focus'] as $name) {
            $this->car('MARCA', $name, ["https://example.test/$name.jpg"], $dealer);
            $models[] = ['marca' => 'MARCA', 'modelo' => $name];
        }

        DB::enableQueryLog();
        $urls = $this->resolve($models, $dealer);
        $queries = DB::getQueryLog();
        DB::disableQueryLog();

        $this->assertCount(9, $urls);
        $this->assertCount(2, $queries);
    }
}
