<?php

namespace Tests\Unit\Services\Resale;

use App\Services\Resale\AcaraPriceReader;
use App\Services\Resale\ValueRetentionCalculator;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use UnexpectedValueException;

class AcaraPriceReaderTest extends TestCase
{
    public function test_hu05_reads_positioned_prices_and_preserves_source_identity(): void
    {
        $pdf = $this->pdf([$this->table()]);
        $result = (new AcaraPriceReader)->read($pdf);
        $row = $result['rows'][0];

        $this->assertSame('2026-10-19', $result['source_date']);
        $this->assertSame(hash('sha256', $pdf), $result['sha256']);
        $this->assertSame('CHEVROLET', $row['make']);
        $this->assertSame('Onix', $row['model']);
        $this->assertSame('JOY 1.4 MT (L20)', $row['version']);
        $this->assertSame('ARS', $row['currency']);
        $this->assertSame(1, $row['page']);
        $this->assertNull($row['zero_km_price']);
        $this->assertSame([2024 => '19800000', 2023 => null, 2022 => '17869500', 2021 => '16976000'], $row['values']);
        $point = ['snapshot_id' => $result['snapshot_id'], 'version_id' => $row['version_id'], 'currency' => 'ARS'];
        $score = (new ValueRetentionCalculator)->threeYearScore(
            $point + ['model_year' => 2024, 'price' => $row['values'][2024]],
            $point + ['model_year' => 2021, 'price' => $row['values'][2021]]
        );
        $this->assertEqualsWithDelta(85.737373737, $score, 1e-8);
        $this->assertSame($result, (new AcaraPriceReader)->read($pdf));
    }

    public function test_continuations_currency_decimals_and_numeric_version_names(): void
    {
        $second = [[12, 520, '17.220'], [95, 520, 'u$s']];
        foreach (['51.000,50', '-', '49.300,00', '-', '-'] as $i => $value) {
            $second[] = [130 + 50 * $i, 520, $value];
        }
        $second[] = [12, 20, 'Precios al: 19/10/2026'];
        $result = (new AcaraPriceReader)->read($this->pdf([$this->table(), $second]));
        $row = $result['rows'][1];
        $this->assertSame(['CHEVROLET', 'Onix', '17.220', 'USD', 2], array_map(fn ($key) => $row[$key], ['make', 'model', 'version', 'currency', 'page']));
        $this->assertSame('51000.50', $row['zero_km_price']);
        $this->assertSame('49300.00', $row['values'][2023]);
        $this->assertNotSame($result['rows'][0]['version_id'], $row['version_id']);
    }

    public function test_new_header_resets_model_and_uses_its_own_years(): void
    {
        $second = $this->table();
        $second[0][2] = 'TOYOTA';
        $second[2][2] = '2025';
        $second[6][2] = '2008';
        $result = (new AcaraPriceReader)->read($this->pdf([$this->table(), $second]));
        $this->assertSame('TOYOTA', $result['rows'][1]['make']);
        $this->assertSame('2008', $result['rows'][1]['model']);
        $this->assertSame('19800000', $result['rows'][1]['values'][2025]);
    }

    public function test_source_date_is_document_wide_not_printed_on_every_page(): void
    {
        $first = $this->table();
        array_pop($first);
        $last = $this->table();
        array_push($last, [98, 20, ' '], [98, 10, 'Importes en pesos redondeados sin decimales']);
        $result = (new AcaraPriceReader)->read($this->pdf([$first, $last]));
        $this->assertSame('2026-10-19', $result['source_date']);
        $this->assertCount(2, $result['rows']);
    }

    #[DataProvider('invalidTables')]
    public function test_ambiguous_or_malformed_document_never_returns_partial_rows(string $case): void
    {
        $table = $this->table();
        match ($case) {
            'amount' => $table[11][2] = '19,800,000',
            'zero' => $table[11][2] = '0',
            'currency' => $table[9][2] = 'EUR',
            'duplicate year' => $table[3][2] = '2024',
            'shifted cell' => $table[11][0] = 230,
            'misaligned cell' => $table[11][1] = 300,
            'missing cell' => array_splice($table, 11, 1),
            'missing model' => array_splice($table, 6, 1),
            'date' => $table[15][2] = 'Precios al: 31/02/2026',
            'mixed dates' => $table[15][2] = 'Precios al: 20/10/2026',
            'missing date' => array_pop($table),
        };
        $this->expectException(UnexpectedValueException::class);
        (new AcaraPriceReader)->read($this->pdf($case === 'missing date' ? [$table] : [$this->table(), $table]));
    }

    public static function invalidTables(): array
    {
        return array_map(fn ($case) => [$case], ['amount', 'zero', 'currency', 'duplicate year', 'shifted cell', 'misaligned cell', 'missing cell', 'missing model', 'date', 'mixed dates', 'missing date']);
    }

    public function test_empty_and_truncated_pdfs_are_rejected(): void
    {
        foreach (['', '%PDF-1.4 invalid %%EOF', substr($this->pdf([$this->table()]), 0, -10), $this->pdf([[]])] as $pdf) {
            try {
                (new AcaraPriceReader)->read($pdf);
                $this->fail('Invalid PDF was accepted.');
            } catch (UnexpectedValueException) {
                $this->addToAssertionCount(1);
            }
        }
    }

    /** Small synthetic positioned PDF: no network, vendor PDF or production data required. */
    private function table(): array
    {
        $tokens = [[12, 410, 'CHEVROLET'], [120, 410, '0km']];
        foreach ([2024, 2023, 2022, 2021] as $i => $year) {
            $tokens[] = [170 + 50 * $i, 410, (string) $year];
        }
        array_push($tokens, [12, 340, 'Onix'], [12, 327, 'JOY 1.4 MT'], [12, 317, '(L20)'], [95, 322, '$']);
        foreach (['-', '19.800.000', '-', '17.869.500', '16.976.000'] as $i => $price) {
            $tokens[] = [130 + 50 * $i, 322, $price];
        }
        $tokens[] = [12, 20, 'Precios al: 19/10/2026'];

        return $tokens;
    }

    private function pdf(array $pages): string
    {
        $objects = ['<< /Type /Catalog /Pages 2 0 R >>', '', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'];
        $kids = [];
        foreach ($pages as $tokens) {
            $id = count($objects) + 1;
            $kids[] = "$id 0 R";
            $stream = '';
            foreach ($tokens as [$x, $y, $text]) {
                $text = strtr($text, ['\\' => '\\\\', '(' => '\\(', ')' => '\\)']);
                $stream .= "BT /F1 8.4 Tf 1 0 0 1 $x $y Tm ($text) Tj ET\n";
            }
            $objects[] = '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Resources << /Font << /F1 3 0 R >> >> /Contents '.($id + 1).' 0 R >>';
            $objects[] = '<< /Length '.strlen($stream)." >>\nstream\n$stream".'endstream';
        }
        $objects[1] = '<< /Type /Pages /Kids ['.implode(' ', $kids).'] /Count '.count($kids).' >>';
        $pdf = "%PDF-1.4\n";
        $offsets = [0];
        foreach ($objects as $i => $object) {
            $offsets[] = strlen($pdf);
            $pdf .= ($i + 1)." 0 obj\n$object\nendobj\n";
        }
        $xref = strlen($pdf);
        $pdf .= "xref\n0 ".count($offsets)."\n0000000000 65535 f \n";
        foreach (array_slice($offsets, 1) as $offset) {
            $pdf .= sprintf("%010d 00000 n \n", $offset);
        }

        return $pdf.'trailer << /Size '.count($offsets)." /Root 1 0 R >>\nstartxref\n$xref\n%%EOF\n";
    }
}
