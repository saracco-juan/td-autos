<?php

namespace App\Services\Portales;

/**
 * Kavak Argentina. Its URL only takes the model; no filter format was verified, so none is sent.
 */
final class KavakLinks implements PortalLinkStrategy
{
    private const BASE = 'https://www.kavak.com/ar/usados/';

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

        return $route === null ? null : self::BASE.$route;
    }
}
