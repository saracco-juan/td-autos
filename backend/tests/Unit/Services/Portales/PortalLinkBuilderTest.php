<?php

namespace Tests\Unit\Services\Portales;

use App\Services\Portales\PortalLink;
use App\Services\Portales\PortalLinkBuilder;
use App\Services\Portales\PortalSearch;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class PortalLinkBuilderTest extends TestCase
{
    private const MERCADO_LIBRE = 'https://autos.mercadolibre.com.ar/';

    private function search(array $changes = []): PortalSearch
    {
        return new PortalSearch(...array_replace([
            'routes' => ['mercadolibre' => 'toyota/etios', 'kavak' => 'toyota/etios'],
        ], $changes));
    }

    /** @return array<string, string> Portal key => url. */
    private function urls(PortalSearch $search): array
    {
        $links = (new PortalLinkBuilder)->build($search);

        return array_combine(
            array_map(fn (PortalLink $link) => $link->portal, $links),
            array_map(fn (PortalLink $link) => $link->url, $links),
        );
    }

    public function test_mercado_libre_combines_every_filter_in_the_verified_url_format(): void
    {
        $urls = $this->urls($this->search([
            'transmission' => 'automatica', 'fuel' => 'nafta', 'yearFrom' => 2018, 'yearTo' => 2020,
            'zone' => 'bsas-gba-sur', 'maxKm' => 100000, 'maxPriceArs' => 20000000, 'body' => 'sedan', 'doors' => 4,
        ]));

        $this->assertSame(
            self::MERCADO_LIBRE.'toyota/etios/automatica/nafta/2018-2020/bsas-gba-sur/'
            .'_KILOMETERS_0km-100000km_PriceRange_0ARS-20000000ARS_VEHICLE*BODY*TYPE_452758_DOORS_4-4',
            $urls['mercadolibre'],
        );
    }

    public function test_mercado_libre_without_filters_is_the_model_page(): void
    {
        $this->assertSame(self::MERCADO_LIBRE.'toyota/etios/', $this->urls($this->search())['mercadolibre']);
    }

    public function test_mercado_libre_uses_a_single_year_when_the_range_is_one_year(): void
    {
        $url = $this->urls($this->search(['yearFrom' => 2019, 'yearTo' => 2019]))['mercadolibre'];

        $this->assertSame(self::MERCADO_LIBRE.'toyota/etios/2019/', $url);
    }

    #[DataProvider('bodies')]
    public function test_mercado_libre_maps_the_known_body_types_and_skips_the_rest(string $body, string $expected): void
    {
        $this->assertSame(
            self::MERCADO_LIBRE.'toyota/etios/'.$expected,
            $this->urls($this->search(['body' => $body]))['mercadolibre'],
        );
    }

    /** @return array<string, array{string, string}> */
    public static function bodies(): array
    {
        return [
            'sedan' => ['sedan', '_VEHICLE*BODY*TYPE_452758'],
            'hatchback' => ['hatchback', '_VEHICLE*BODY*TYPE_479344'],
            'a body ML has no verified id for' => ['pickup', ''],
        ];
    }

    public function test_kavak_takes_the_model_and_the_transmission_ignoring_the_rest(): void
    {
        $urls = $this->urls($this->search([
            'transmission' => 'automatica', 'fuel' => 'nafta', 'yearFrom' => 2018, 'yearTo' => 2020,
            'zone' => 'bsas-gba-sur', 'maxKm' => 100000, 'maxPriceArs' => 20000000, 'body' => 'sedan', 'doors' => 4,
        ]));

        $this->assertSame('https://www.kavak.com/ar/usados/toyota/etios/automatico', $urls['kavak']);
    }

    public function test_kavak_maps_a_manual_transmission_to_its_own_segment(): void
    {
        $this->assertSame(
            'https://www.kavak.com/ar/usados/toyota/etios/manual',
            $this->urls($this->search(['transmission' => 'manual']))['kavak'],
        );
    }

    public function test_kavak_without_a_known_transmission_is_the_model_page(): void
    {
        $this->assertSame('https://www.kavak.com/ar/usados/toyota/etios', $this->urls($this->search())['kavak']);
        $this->assertSame(
            'https://www.kavak.com/ar/usados/toyota/etios',
            $this->urls($this->search(['transmission' => 'cvt']))['kavak'],
        );
    }

    public function test_a_portal_without_a_route_for_the_model_gets_no_link(): void
    {
        $urls = $this->urls($this->search(['routes' => ['kavak' => 'toyota/etios']]));

        $this->assertSame(['kavak'], array_keys($urls));
    }

    public function test_links_come_named_and_in_a_stable_order(): void
    {
        $links = (new PortalLinkBuilder)->build($this->search());

        $this->assertSame(['mercadolibre', 'kavak'], array_map(fn (PortalLink $link) => $link->portal, $links));
        $this->assertSame(['Mercado Libre', 'Kavak'], array_map(fn (PortalLink $link) => $link->name, $links));
    }
}
