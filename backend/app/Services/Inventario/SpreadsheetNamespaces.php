<?php

namespace App\Services\Inventario;

use RuntimeException;
use XMLReader;
use XMLWriter;

/** Adapter for the reader's bare-name comparisons; only validated XML reaches here. */
final class SpreadsheetNamespaces
{
    private const MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';

    public static function normalize(string $contents): string
    {
        $reader = new XMLReader;
        if (! $reader->XML($contents, null, LIBXML_NONET | LIBXML_COMPACT)) {
            throw new RuntimeException('Could not normalize spreadsheet XML.');
        }
        $writer = new XMLWriter;
        $writer->openMemory();
        $writer->startDocument('1.0', 'UTF-8');
        $changed = false;
        $defaults = [];
        try {
            while ($reader->read()) {
                if ($reader->nodeType === XMLReader::ELEMENT) {
                    $main = $reader->namespaceURI === self::MAIN;
                    $changed = $changed || ($main && $reader->prefix !== '');
                    $writer->startElement($main ? $reader->localName : $reader->name);
                    $parentDefault = $defaults[$reader->depth - 1] ?? '';
                    $default = ($main || $reader->prefix === '') ? $reader->namespaceURI : $parentDefault;
                    if ($reader->moveToFirstAttribute()) {
                        do {
                            if ($reader->name === 'xmlns') {
                                if (! $main) {
                                    $default = $reader->value;
                                }
                            } else {
                                // Keep prefix bindings and qualified attributes exactly as declared.
                                $writer->writeAttribute($reader->name, $reader->value);
                            }
                        } while ($reader->moveToNextAttribute());
                        $reader->moveToElement();
                    }
                    if ($default !== $parentDefault) {
                        $writer->writeAttribute('xmlns', $default);
                    }
                    $defaults[$reader->depth] = $default;
                    if ($reader->isEmptyElement) {
                        $writer->endElement();
                    }
                } elseif ($reader->nodeType === XMLReader::END_ELEMENT) {
                    $writer->endElement();
                } elseif (in_array($reader->nodeType, [XMLReader::TEXT, XMLReader::WHITESPACE, XMLReader::SIGNIFICANT_WHITESPACE], true)) {
                    $writer->text($reader->value);
                } elseif ($reader->nodeType === XMLReader::CDATA) {
                    $writer->writeCdata($reader->value);
                } elseif ($reader->nodeType === XMLReader::COMMENT) {
                    $writer->writeComment($reader->value);
                } elseif ($reader->nodeType === XMLReader::PI) {
                    $writer->writePi($reader->name, $reader->value);
                }
            }
            $writer->endDocument();

            return $changed ? $writer->outputMemory() : $contents;
        } finally {
            $reader->close();
        }
    }
}
