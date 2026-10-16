<?php

namespace Tests\Feature\Marketplaces;

use App\Services\Marketplaces\ListingQuery;
use App\Services\Marketplaces\ListingSource;
use App\Services\Marketplaces\MercadoLibreApiSource;
use App\Services\Marketplaces\MercadoLibreSourceFactory;
use App\Services\Marketplaces\RecordedMercadoLibreSource;
use InvalidArgumentException;
use Tests\TestCase;

class MercadoLibreSourceFactoryTest extends TestCase
{
    public function test_defaults_to_the_recorded_source(): void
    {
        $source = app(MercadoLibreSourceFactory::class)->make();

        $this->assertInstanceOf(RecordedMercadoLibreSource::class, $source);
        $this->assertNotEmpty($source->search(new ListingQuery));
    }

    public function test_api_driver_returns_the_api_source(): void
    {
        config(['services.mercadolibre.driver' => 'api']);

        $this->assertInstanceOf(MercadoLibreApiSource::class, app(MercadoLibreSourceFactory::class)->make());
    }

    public function test_unknown_driver_throws(): void
    {
        config(['services.mercadolibre.driver' => 'carrier-pigeon']);

        $this->expectException(InvalidArgumentException::class);

        app(MercadoLibreSourceFactory::class)->make();
    }

    public function test_result_is_a_listing_source(): void
    {
        $this->assertInstanceOf(ListingSource::class, app(MercadoLibreSourceFactory::class)->make());
    }
}
