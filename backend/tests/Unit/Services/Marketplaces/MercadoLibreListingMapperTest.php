<?php

namespace Tests\Unit\Services\Marketplaces;

use App\Services\Marketplaces\MercadoLibreListingMapper;
use App\Services\Marketplaces\SourceUnavailableException;
use PHPUnit\Framework\TestCase;

class MercadoLibreListingMapperTest extends TestCase
{
    /**
     * @param  array<string, mixed>  $overrides
     * @return array<string, mixed>
     */
    private function item(array $overrides = []): array
    {
        return array_merge([
            'id' => 'MLA9000000001',
            'title' => 'Toyota Corolla 2.0 Xei Cvt 2019',
            'price' => 21500000,
            'currency_id' => 'ARS',
            'permalink' => 'https://auto.mercadolibre.com.ar/MLA-9000000001-demo-toyota-corolla',
            'thumbnail' => 'http://http2.mlstatic.com/D_demo-I.jpg',
            'location' => [
                'city' => ['id' => 'x', 'name' => 'Palermo'],
                'state' => ['id' => 'y', 'name' => 'Capital Federal'],
            ],
            'attributes' => [
                ['id' => 'BRAND', 'value_name' => 'Toyota'],
                ['id' => 'MODEL', 'value_name' => 'Corolla'],
                ['id' => 'TRIM', 'value_name' => '2.0 Xei Cvt'],
                ['id' => 'VEHICLE_YEAR', 'value_name' => '2019'],
                ['id' => 'KILOMETERS', 'value_name' => '62000 km', 'value_struct' => ['number' => 62000, 'unit' => 'km']],
                ['id' => 'TRANSMISSION', 'value_name' => 'Automática'],
                ['id' => 'FUEL_TYPE', 'value_name' => 'Nafta'],
                ['id' => 'VEHICLE_BODY_TYPE', 'value_name' => 'Sedán'],
            ],
        ], $overrides);
    }

    public function test_maps_a_full_result(): void
    {
        $listing = (new MercadoLibreListingMapper)->map($this->item());

        $this->assertNotNull($listing);
        $this->assertSame('mercadolibre', $listing->marketplace);
        $this->assertSame('MLA9000000001', $listing->externalId);
        $this->assertSame('Toyota Corolla 2.0 Xei Cvt 2019', $listing->title);
        $this->assertSame('Toyota', $listing->marca);
        $this->assertSame('Corolla', $listing->modelo);
        $this->assertSame('2.0 Xei Cvt', $listing->version);
        $this->assertSame(2019, $listing->anio);
        $this->assertSame(62000, $listing->kilometraje);
        $this->assertSame(21500000, $listing->precio);
        $this->assertSame('ARS', $listing->moneda);
        $this->assertSame('Automática', $listing->transmision);
        $this->assertSame('Nafta', $listing->combustible);
        $this->assertSame('Sedán', $listing->carroceria);
        $this->assertSame('Palermo, Capital Federal', $listing->ubicacion);
        $this->assertSame('https://auto.mercadolibre.com.ar/MLA-9000000001-demo-toyota-corolla', $listing->urlOriginal);
    }

    public function test_upgrades_the_thumbnail_to_https(): void
    {
        $listing = (new MercadoLibreListingMapper)->map($this->item());

        $this->assertSame('https://http2.mlstatic.com/D_demo-I.jpg', $listing->imagenUrl);
    }

    public function test_missing_attributes_and_fields_become_null(): void
    {
        $listing = (new MercadoLibreListingMapper)->map($this->item([
            'attributes' => [['id' => 'BRAND', 'value_name' => 'Fiat']],
            'thumbnail' => null,
            'location' => null,
            'price' => null,
            'currency_id' => null,
        ]));

        $this->assertSame('Fiat', $listing->marca);
        $this->assertNull($listing->modelo);
        $this->assertNull($listing->version);
        $this->assertNull($listing->anio);
        $this->assertNull($listing->kilometraje);
        $this->assertNull($listing->transmision);
        $this->assertNull($listing->combustible);
        $this->assertNull($listing->carroceria);
        $this->assertNull($listing->ubicacion);
        $this->assertNull($listing->imagenUrl);
        $this->assertNull($listing->precio);
        $this->assertNull($listing->moneda);
    }

    public function test_parses_kilometers_from_value_name_with_thousand_separators(): void
    {
        $listing = (new MercadoLibreListingMapper)->map($this->item([
            'attributes' => [['id' => 'KILOMETERS', 'value_name' => '112.500 km']],
        ]));

        $this->assertSame(112500, $listing->kilometraje);
    }

    public function test_parses_kilometers_from_value_struct_when_the_name_is_missing(): void
    {
        $listing = (new MercadoLibreListingMapper)->map($this->item([
            'attributes' => [['id' => 'KILOMETERS', 'value_name' => null, 'value_struct' => ['number' => 48000, 'unit' => 'km']]],
        ]));

        $this->assertSame(48000, $listing->kilometraje);
    }

    public function test_falls_back_to_seller_address_for_the_location(): void
    {
        $listing = (new MercadoLibreListingMapper)->map($this->item([
            'location' => [],
            'seller_address' => [
                'city' => ['name' => 'Rosario'],
                'state' => ['name' => 'Santa Fe'],
            ],
        ]));

        $this->assertSame('Rosario, Santa Fe', $listing->ubicacion);
    }

    public function test_skips_a_result_without_id_title_or_permalink(): void
    {
        $mapper = new MercadoLibreListingMapper;

        $this->assertNull($mapper->map($this->item(['permalink' => null])));
        $this->assertNull($mapper->map($this->item(['id' => ''])));
        $this->assertNull($mapper->map($this->item(['title' => null])));
    }

    public function test_map_response_skips_invalid_results(): void
    {
        $listings = (new MercadoLibreListingMapper)->mapResponse([
            'results' => [$this->item(), $this->item(['permalink' => null])],
        ]);

        $this->assertCount(1, $listings);
    }

    public function test_map_response_throws_when_results_is_missing_or_not_a_list(): void
    {
        $mapper = new MercadoLibreListingMapper;

        foreach ([[], ['results' => 'oops'], ['results' => ['a' => 1]]] as $body) {
            try {
                $mapper->mapResponse($body);
                $this->fail('Expected SourceUnavailableException');
            } catch (SourceUnavailableException $e) {
                $this->assertSame('mercadolibre', $e->sourceKey);
            }
        }
    }
}
