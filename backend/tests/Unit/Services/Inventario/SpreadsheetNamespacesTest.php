<?php

namespace Tests\Unit\Services\Inventario;

use App\Services\Inventario\SpreadsheetNamespaces;
use DOMDocument;
use DOMXPath;
use PHPUnit\Framework\TestCase;

class SpreadsheetNamespacesTest extends TestCase
{
    public function test_preserves_text_attributes_and_foreign_namespace_bindings(): void
    {
        $main = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
        $xml = '<x:worksheet xmlns:x="'.$main.'" xmlns="urn:foreign" xmlns:m="urn:metadata" m:keep="x:c">'
            .'<x:sheetData><x:row r="2"><x:c r="A2" t="inlineStr"><x:is><x:t xml:space="preserve">'
            .' Cañón &amp; &lt;modelo&gt; </x:t></x:is></x:c></x:row></x:sheetData>'
            .'<extension m:label="x:row"><![CDATA[<x:c>not markup</x:c>]]></extension></x:worksheet>';
        $normalized = SpreadsheetNamespaces::normalize($xml);
        $document = new DOMDocument;
        $this->assertTrue($document->loadXML($normalized, LIBXML_NONET));
        $xpath = new DOMXPath($document);
        $xpath->registerNamespace('s', $main);
        $xpath->registerNamespace('f', 'urn:foreign');
        $xpath->registerNamespace('m', 'urn:metadata');
        $this->assertSame('', $document->documentElement->prefix);
        $this->assertSame($main, $document->documentElement->lookupNamespaceURI('x'));
        $this->assertSame('x:c', $xpath->evaluate('string(/s:worksheet/@m:keep)'));
        $this->assertSame(' Cañón & <modelo> ', $xpath->evaluate('string(//s:t)'));
        $this->assertSame('preserve', $xpath->evaluate('string(//s:t/@xml:space)'));
        $this->assertSame('2', $xpath->evaluate('string(//s:row/@r)'));
        $this->assertSame('x:row', $xpath->evaluate('string(//f:extension/@m:label)'));
        $this->assertSame('<x:c>not markup</x:c>', $xpath->evaluate('string(//f:extension)'));
    }

    public function test_leaves_unprefixed_and_non_spreadsheet_xml_bytes_unchanged(): void
    {
        foreach (['<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"/>', '<x:other xmlns:x="urn:foreign"/>'] as $xml) {
            $this->assertSame($xml, SpreadsheetNamespaces::normalize($xml));
        }
    }
}
