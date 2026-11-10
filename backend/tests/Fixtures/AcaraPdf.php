<?php

namespace Tests\Fixtures;

final class AcaraPdf
{
    public static function make(string $date = '19/10/2026'): string
    {
        $tokens = [[12, 410, 'TOYOTA'], [120, 410, '0km'], [170, 410, '2024'], [220, 410, '2021'], [12, 390, 'Corolla']];
        foreach ([370 => '19.800.000', 350 => '21.000.000'] as $y => $price) {
            array_push($tokens, [12, $y, 'XLI CVT'], [95, $y, '$'], [130, $y, '-'], [180, $y, $price], [230, $y, '16.976.000']);
        }
        $tokens[] = [12, 20, 'Precios al: '.$date];
        $stream = '';
        foreach ($tokens as [$x, $y, $text]) {
            $stream .= "BT /F1 8 Tf 1 0 0 1 $x $y Tm ($text) Tj ET\n";
        }
        $objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [4 0 R] /Count 1 >>',
            '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
            '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Resources << /Font << /F1 3 0 R >> >> /Contents 5 0 R >>',
            '<< /Length '.strlen($stream)." >>\nstream\n$stream".'endstream'];
        $pdf = "%PDF-1.4\n";
        $offsets = [];
        foreach ($objects as $i => $object) {
            $offsets[] = strlen($pdf);
            $pdf .= ($i + 1)." 0 obj\n$object\nendobj\n";
        }
        $xref = strlen($pdf);
        $pdf .= "xref\n0 6\n0000000000 65535 f \n";
        foreach ($offsets as $offset) {
            $pdf .= sprintf("%010d 00000 n \n", $offset);
        }

        return $pdf."trailer << /Size 6 /Root 1 0 R >>\nstartxref\n$xref\n%%EOF\n";
    }
}
