<?php

namespace App\Services\Portales;

/**
 * Builds the search links of a model, one per portal that has a route for it. Pure: no external calls.
 */
final class PortalLinkBuilder
{
    /** @var list<PortalLinkStrategy> */
    private array $strategies;

    /** @param  list<PortalLinkStrategy>|null  $strategies  The portals to link, in display order. */
    public function __construct(?array $strategies = null)
    {
        $this->strategies = $strategies ?? [new MercadoLibreLinks, new KavakLinks];
    }

    /** @return list<PortalLink> */
    public function build(PortalSearch $search): array
    {
        $links = [];
        foreach ($this->strategies as $strategy) {
            $url = $strategy->url($search);
            if ($url !== null) {
                $links[] = new PortalLink($strategy->portal(), $strategy->name(), $url);
            }
        }

        return $links;
    }
}
