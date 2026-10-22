<?php

namespace Tests\Unit\Support;

use App\Support\Patente;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

class PatenteTest extends TestCase
{
    /**
     * @return array<string, array{string, string}>
     */
    public static function rawPlates(): array
    {
        return [
            'already normalized' => ['AB123CD', 'AB123CD'],
            'lowercase' => ['ab123cd', 'AB123CD'],
            'spaces' => [' ab 123 cd ', 'AB123CD'],
            'dashes' => ['abc-123', 'ABC123'],
            'dots' => ['A.B.123.C.D', 'AB123CD'],
            'mixed separators' => ['ab-123 . cd', 'AB123CD'],
        ];
    }

    #[DataProvider('rawPlates')]
    public function test_normalize_uppercases_and_strips_separators(string $raw, string $expected): void
    {
        $this->assertSame($expected, Patente::normalize($raw));
    }

    /**
     * @return array<string, array{string, bool}>
     */
    public static function normalizedPlates(): array
    {
        return [
            'old format' => ['ABC123', true],
            'mercosur format' => ['AB123CD', true],
            'empty' => ['', false],
            'too short' => ['AB12', false],
            'old format with a letter at the end' => ['ABC12D', false],
            'mercosur format with a digit at the end' => ['AB123C4', false],
            'four letters first' => ['ABCD123', false],
            'digits only' => ['1234567', false],
            'too long' => ['AB123CDE', false],
            'lowercase is not normalized' => ['abc123', false],
            'separators are not normalized' => ['AB-123-CD', false],
            'non-ascii letters' => ['ÁB123CD', false],
            'trailing newline' => ["ABC123\n", false],
        ];
    }

    #[DataProvider('normalizedPlates')]
    public function test_is_valid_accepts_only_the_argentine_formats(string $plate, bool $expected): void
    {
        $this->assertSame($expected, Patente::isValid($plate));
    }
}
