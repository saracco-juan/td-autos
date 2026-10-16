<?php

namespace App\Services\Marketplaces;

use Illuminate\Support\Str;
use JsonException;

/**
 * Mercado Libre listings read from a recorded `/sites/MLA/search` response. The search API is
 * closed to the app, so the demo runs on this file (RNF06).
 */
class RecordedMercadoLibreSource implements ListingSource
{
    public function __construct(
        private readonly string $path,
        private readonly MercadoLibreListingMapper $mapper = new MercadoLibreListingMapper,
    ) {}

    public function key(): string
    {
        return MercadoLibreListingMapper::KEY;
    }

    public function label(): string
    {
        return 'Mercado Libre';
    }

    public function search(ListingQuery $query): array
    {
        $listings = $this->mapper->mapResponse($this->read());

        if ($query->text === null) {
            return $listings;
        }

        $words = preg_split('/\s+/', $this->fold($query->text));

        return array_values(array_filter($listings, function (ExternalListing $listing) use ($words): bool {
            $haystack = $this->fold(implode(' ', [$listing->title, $listing->marca, $listing->modelo, $listing->version]));

            foreach ($words as $word) {
                if (! str_contains($haystack, $word)) {
                    return false;
                }
            }

            return true;
        }));
    }

    /**
     * @return array<string, mixed>
     */
    private function read(): array
    {
        $content = is_file($this->path) ? @file_get_contents($this->path) : false;

        if ($content === false) {
            throw new SourceUnavailableException($this->key(), 'recorded file is not readable');
        }

        try {
            $body = json_decode($content, true, flags: JSON_THROW_ON_ERROR);
        } catch (JsonException $e) {
            throw new SourceUnavailableException($this->key(), 'recorded file is not valid JSON', $e);
        }

        if (! is_array($body)) {
            throw new SourceUnavailableException($this->key(), 'recorded file is not a JSON object');
        }

        return $body;
    }

    /** Lowercase and strip accents so "Citroën" matches "citroen". */
    private function fold(string $text): string
    {
        return mb_strtolower(Str::ascii($text));
    }
}
