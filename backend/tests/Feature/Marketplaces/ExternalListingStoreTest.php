<?php

namespace Tests\Feature\Marketplaces;

use App\Models\FotoVehiculo;
use App\Models\Vehiculo;
use App\Services\Marketplaces\ExternalListing;
use App\Services\Marketplaces\ExternalListingStore;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class ExternalListingStoreTest extends TestCase
{
    use RefreshDatabase;

    /**
     * @param  array<string, mixed>  $overrides
     */
    private function listing(array $overrides = []): ExternalListing
    {
        return new ExternalListing(...array_merge([
            'marketplace' => 'mercadolibre',
            'externalId' => 'MLA1',
            'title' => 'Toyota Corolla 2.0 Xei 2019',
            'marca' => 'Toyota',
            'modelo' => 'Corolla',
            'version' => '2.0 Xei',
            'anio' => 2019,
            'kilometraje' => 62000,
            'precio' => 21500000,
            'moneda' => 'ARS',
            'transmision' => 'Automática',
            'combustible' => 'Diésel',
            'carroceria' => 'Pick-Up',
            'ubicacion' => 'Palermo, Capital Federal',
            'urlOriginal' => 'https://auto.mercadolibre.com.ar/MLA-1',
            'imagenUrl' => 'https://img.example.test/1.jpg',
        ], $overrides));
    }

    private function store(): ExternalListingStore
    {
        return new ExternalListingStore;
    }

    public function test_inserts_the_vehicle_and_its_publication(): void
    {
        $ids = $this->store()->sync([$this->listing()]);

        $vehiculo = Vehiculo::findOrFail($ids[0]);
        $this->assertSame('externo', $vehiculo->origen);
        $this->assertSame('Toyota', $vehiculo->marca);
        $this->assertSame('Corolla', $vehiculo->modelo);
        $this->assertSame(2019, $vehiculo->anio);
        $this->assertSame('ARS', $vehiculo->moneda);
        $this->assertSame('Palermo, Capital Federal', $vehiculo->ubicacion);
        $this->assertDatabaseHas('publicacion_externa', [
            'vehiculo_id' => $vehiculo->id,
            'marketplace' => 'mercadolibre',
            'external_id' => 'MLA1',
            'url_original' => 'https://auto.mercadolibre.com.ar/MLA-1',
        ]);
        $this->assertSame(['https://img.example.test/1.jpg'], $vehiculo->fotos->pluck('ubicacion_archivo')->all());
    }

    public function test_a_second_sync_updates_the_same_rows(): void
    {
        $first = $this->store()->sync([$this->listing()]);
        $second = $this->store()->sync([$this->listing(['precio' => 19900000, 'imagenUrl' => 'https://img.example.test/2.jpg'])]);

        $this->assertSame($first, $second);
        $this->assertSame(1, Vehiculo::count());
        $this->assertSame(1, DB::table('publicacion_externa')->count());
        $this->assertEquals(19900000, Vehiculo::find($first[0])->precio);
        $this->assertSame(['https://img.example.test/2.jpg'], FotoVehiculo::pluck('ubicacion_archivo')->all());
    }

    public function test_listing_without_an_image_has_no_photo(): void
    {
        $this->store()->sync([$this->listing(['imagenUrl' => null])]);

        $this->assertSame(0, FotoVehiculo::count());
    }

    public function test_normalizes_the_marketplace_wording_to_portal_values(): void
    {
        $ids = $this->store()->sync([$this->listing()]);

        $vehiculo = Vehiculo::with('tipoCarroceria')->find($ids[0]);
        $this->assertSame('automatica', $vehiculo->transmision);
        $this->assertSame('diesel', $vehiculo->combustible);
        $this->assertSame('Pickup', $vehiculo->tipoCarroceria->nombre);
    }

    public function test_unknown_values_become_null(): void
    {
        $ids = $this->store()->sync([$this->listing([
            'transmision' => 'Secuencial rara',
            'combustible' => 'Vapor',
            'carroceria' => 'Carruaje',
        ])]);

        $vehiculo = Vehiculo::find($ids[0]);
        $this->assertNull($vehiculo->transmision);
        $this->assertNull($vehiculo->combustible);
        $this->assertNull($vehiculo->tipo_carroceria_id);
    }

    public function test_returns_one_vehicle_id_per_listing_in_order(): void
    {
        $ids = $this->store()->sync([
            $this->listing(['externalId' => 'MLA1']),
            $this->listing(['externalId' => 'MLA2']),
        ]);

        $this->assertCount(2, $ids);
        $this->assertNotSame($ids[0], $ids[1]);
    }
}
