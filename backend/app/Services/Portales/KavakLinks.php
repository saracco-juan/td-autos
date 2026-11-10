<?php

namespace App\Services\Portales;

/**
 * Kavak Argentina. It encodes filters as path segments, and only two were verified on the real site:
 * `{brand}/{model}/automatico` and `{brand}/{model}/manual`. Query strings are NOT safe (`?transmission=` loses the
 * model, `?year=` changes the page), and year ranges and price were not verified, so nothing else is sent. Kavak's
 * stock is small: an over-specific page can show "0 resultados", which is why only the transmission goes.
 */
final class KavakLinks implements PortalLinkStrategy
{
    private const BASE = 'https://www.kavak.com/ar/usados/';

    /** @var array<string, string> PortalSearch transmission => Kavak path segment. */
    private const TRANSMISSIONS = ['automatica' => 'automatico', 'manual' => 'manual'];

    public function portal(): string
    {
        return 'kavak';
    }

    public function name(): string
    {
        return 'Kavak';
    }

    public function url(PortalSearch $search): ?string
    {
        $route = $search->routes[$this->portal()] ?? null;

        if ($route === null) {
            return null;
        }
        $transmission = self::TRANSMISSIONS[$search->transmission ?? ''] ?? null;

        return self::BASE.$route.($transmission === null ? '' : '/'.$transmission);
    }
}
