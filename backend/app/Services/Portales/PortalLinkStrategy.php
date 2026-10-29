<?php

namespace App\Services\Portales;

/**
 * How one portal writes a search in its URL. Adding a portal means verifying its URL format first.
 */
interface PortalLinkStrategy
{
    /** Stable key, also the key of the portal in `PortalSearch::$routes`. */
    public function portal(): string;

    /** Name shown to the buyer. */
    public function name(): string;

    /** The search URL, or null when the portal has no route for the model. */
    public function url(PortalSearch $search): ?string;
}
