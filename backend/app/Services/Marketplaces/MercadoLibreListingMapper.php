<?php

namespace App\Services\Marketplaces;

/**
 * Maps the `/sites/MLA/search` response of Mercado Libre to ExternalListing, whether it came from
 * the live API or from a recorded file.
 */
class MercadoLibreListingMapper
{
    public const KEY = 'mercadolibre';

    /**
     * @param  array<string, mixed>  $body
     * @return list<ExternalListing>
     *
     * @throws SourceUnavailableException when `results` is missing or is not a list.
     */
    public function mapResponse(array $body): array
    {
        $results = $body['results'] ?? null;

        if (! is_array($results) || ! array_is_list($results)) {
            throw new SourceUnavailableException(self::KEY, 'malformed response: results is not a list');
        }

        $listings = [];
        foreach ($results as $result) {
            $listing = is_array($result) ? $this->map($result) : null;
            if ($listing !== null) {
                $listings[] = $listing;
            }
        }

        return $listings;
    }

    /**
     * Map one result; null when it lacks the id, title or permalink the portal cannot do without.
     *
     * @param  array<string, mixed>  $result
     */
    public function map(array $result): ?ExternalListing
    {
        $id = $this->text($result['id'] ?? null);
        $title = $this->text($result['title'] ?? null);
        $permalink = $this->text($result['permalink'] ?? null);

        if ($id === null || $title === null || $permalink === null) {
            return null;
        }

        $attributes = $this->attributes($result['attributes'] ?? []);
        $year = $this->text($attributes['VEHICLE_YEAR']['value_name'] ?? null);
        $price = $result['price'] ?? null;

        return new ExternalListing(
            marketplace: self::KEY,
            externalId: $id,
            title: $title,
            marca: $this->text($attributes['BRAND']['value_name'] ?? null),
            modelo: $this->text($attributes['MODEL']['value_name'] ?? null),
            version: $this->text($attributes['TRIM']['value_name'] ?? null),
            anio: $year !== null && ctype_digit($year) ? (int) $year : null,
            kilometraje: $this->kilometers($attributes['KILOMETERS'] ?? []),
            precio: is_int($price) || is_float($price) ? $price : null,
            moneda: $this->text($result['currency_id'] ?? null),
            transmision: $this->text($attributes['TRANSMISSION']['value_name'] ?? null),
            combustible: $this->text($attributes['FUEL_TYPE']['value_name'] ?? null),
            carroceria: $this->text($attributes['VEHICLE_BODY_TYPE']['value_name'] ?? null),
            ubicacion: $this->location($result['location'] ?? null) ?? $this->location($result['seller_address'] ?? null),
            urlOriginal: $permalink,
            imagenUrl: $this->secure($this->text($result['thumbnail'] ?? null)),
        );
    }

    /**
     * @return array<string, array<string, mixed>> Attributes indexed by id.
     */
    private function attributes(mixed $attributes): array
    {
        $indexed = [];
        foreach (is_array($attributes) ? $attributes : [] as $attribute) {
            if (is_array($attribute) && is_string($attribute['id'] ?? null)) {
                $indexed[$attribute['id']] = $attribute;
            }
        }

        return $indexed;
    }

    /**
     * @param  array<string, mixed>  $attribute  The KILOMETERS attribute.
     */
    private function kilometers(array $attribute): ?int
    {
        $number = $attribute['value_struct']['number'] ?? null;
        if (is_int($number) || is_float($number)) {
            return (int) $number;
        }

        // "112.500 km" becomes 112500: the digits are all that matters.
        $digits = preg_replace('/\D/', '', $this->text($attribute['value_name'] ?? null) ?? '');

        return $digits === '' ? null : (int) $digits;
    }

    private function location(mixed $location): ?string
    {
        if (! is_array($location)) {
            return null;
        }

        $parts = array_filter([
            $this->text($location['city']['name'] ?? null),
            $this->text($location['state']['name'] ?? null),
        ]);

        return $parts === [] ? null : implode(', ', $parts);
    }

    private function secure(?string $url): ?string
    {
        return $url === null ? null : preg_replace('#^http://#i', 'https://', $url);
    }

    private function text(mixed $value): ?string
    {
        if (! is_string($value)) {
            return null;
        }

        $value = trim($value);

        return $value === '' ? null : $value;
    }
}
