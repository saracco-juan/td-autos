<?php

namespace Tests\Unit\Services\Marketplaces;

use App\Services\Marketplaces\ListingQuery;
use App\Services\Marketplaces\RecordedMercadoLibreSource;
use App\Services\Marketplaces\SourceUnavailableException;
use PHPUnit\Framework\TestCase;

class RecordedMercadoLibreSourceTest extends TestCase
{
    private function source(): RecordedMercadoLibreSource
    {
        return new RecordedMercadoLibreSource(dirname(__DIR__, 4).'/database/data/mercadolibre/search-autos.json');
    }

    public function test_identifies_itself(): void
    {
        $this->assertSame('mercadolibre', $this->source()->key());
        $this->assertSame('Mercado Libre', $this->source()->label());
    }

    public function test_maps_the_recorded_file(): void
    {
        $listings = $this->source()->search(new ListingQuery);

        $this->assertGreaterThanOrEqual(20, count($listings));
        foreach ($listings as $listing) {
            $this->assertSame('mercadolibre', $listing->marketplace);
            $this->assertStringStartsWith('https://', $listing->urlOriginal);
        }
        $this->assertCount(count($listings), array_unique(array_map(fn ($l) => $l->externalId, $listings)));
    }

    public function test_demo_listings_have_no_photo_so_nothing_points_at_a_real_cdn(): void
    {
        foreach ($this->source()->search(new ListingQuery) as $listing) {
            $this->assertNull($listing->imagenUrl, "{$listing->externalId} must not hotlink an image");
        }
    }

    public function test_filters_by_text(): void
    {
        $listings = $this->source()->search(new ListingQuery('corolla'));

        $this->assertNotEmpty($listings);
        foreach ($listings as $listing) {
            $this->assertSame('Corolla', $listing->modelo);
        }
    }

    public function test_text_filter_ignores_case_and_accents(): void
    {
        $listings = $this->source()->search(new ListingQuery('CITROEN'));

        $this->assertNotEmpty($listings);
        foreach ($listings as $listing) {
            $this->assertSame('Citroën', $listing->marca);
        }
    }

    public function test_every_word_must_match(): void
    {
        $all = $this->source()->search(new ListingQuery('toyota'));
        $narrow = $this->source()->search(new ListingQuery('toyota inexistente'));

        $this->assertNotEmpty($all);
        $this->assertSame([], $narrow);
    }

    public function test_blank_text_returns_everything(): void
    {
        $this->assertSame(
            count($this->source()->search(new ListingQuery)),
            count($this->source()->search(new ListingQuery('   ')))
        );
    }

    public function test_missing_file_throws(): void
    {
        $this->expectException(SourceUnavailableException::class);

        (new RecordedMercadoLibreSource('/nonexistent/file.json'))->search(new ListingQuery);
    }

    public function test_invalid_json_throws(): void
    {
        $path = tempnam(sys_get_temp_dir(), 'meli');
        file_put_contents($path, '{not json');

        try {
            $this->expectException(SourceUnavailableException::class);
            (new RecordedMercadoLibreSource($path))->search(new ListingQuery);
        } finally {
            unlink($path);
        }
    }
}
