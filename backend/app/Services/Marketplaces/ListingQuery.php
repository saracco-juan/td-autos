<?php

namespace App\Services\Marketplaces;

/**
 * What the buyer asked for. Free text only for now; a blank text means "everything".
 */
final class ListingQuery
{
    public readonly ?string $text;

    public function __construct(?string $text = null)
    {
        $text = trim($text ?? '');
        $this->text = $text === '' ? null : $text;
    }
}
