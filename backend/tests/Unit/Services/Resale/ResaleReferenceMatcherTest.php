<?php

namespace Tests\Unit\Services\Resale;

use App\Models\Vehiculo;
use App\Services\Resale\ResaleScorer;
use PHPUnit\Framework\TestCase;

class ResaleReferenceMatcherTest extends TestCase
{
    private function score(string $label, array $versions, array $facts = []): array
    {
        $car = new Vehiculo(array_replace(['marca' => 'Test', 'modelo' => 'Example',
            'version' => $label, 'anio' => 2021, 'transmision' => 'automatica'], $facts));
        $car->id = 1;
        $rows = array_map(fn ($v) => is_array($v) ? $v : ['make' => 'Test', 'model' => 'Example',
            'version' => $v, 'version_id' => $v, 'currency' => 'ARS',
            'values' => [2021 => 100, 2018 => 80]], $versions);

        return (new ResaleScorer)->scores([$car], ['snapshot' => ['snapshot_id' => 'acara:test',
            'source_date' => '2026-10-19', 'rows' => $rows], 'stale' => false],
            ['snapshot' => ['activity' => ['models' => [['make' => 'test', 'model' => 'example',
                'special' => [], 'score' => 60]]]], 'stale' => false])[1];
    }

    public function test_natural_labels_resolve_unique_technical_references(): void
    {
        foreach ([
            ['Feel Pack 1.6 AT', '1.6 Feel Pack AT (115cv) (L18)'],
            ['Highline 1.6 AT', '1.6 Highline Tiptronic (110cv)'],
            ['XEi 1.8 CVT', 'XEI 1.8 CVT (140cv) (L18)'],
            ['EXL 1.8 CVT', '1.8 i-VTEC EX-L CVT 2WD (140cv) (L21)'],
            ['EXL 2.0 CVT', '2.0 EX-L CVT PaddleShift 7 Sedán (154cv) (L17)'],
            ['EXS 1.8 AT', '1.8 EXS AT Sedán (140cv) (L12)'],
            ['Drive 1.3 CVT', '1.3 Drive CVT (99cv)'],
            ['Allure Pack 1.6 THP AT', 'Allure Pack 1.6 THP Tiptronic (163cv) 4Ptas. (L20)'],
            ['Advance 1.6 AT', '1.6 Advance AT (107cv) 4Ptas.'],
            ['Fill Pack 1.6 AT', '1.6 Feel Pack AT (115cv) (L18)'],
        ] as [$label, $reference]) {
            $result = $this->score($label, [$reference]);
            $this->assertSame(70.0, $result['score'], $label);
            $this->assertSame($reference, $result['comparison']['version_id'], $label);
        }
    }

    public function test_never_chooses_another_trim_or_conflicting_technical_identity(): void
    {
        $reference = '1.6 Feel Pack AT (115cv) (L18)';
        foreach ([
            ['Feel 1.6 AT', []], ['Feel Pack Plus 1.6 AT', []],
            ['Feel Pack 2.0 AT', []], ['Feel Pack 1.6 MT', []],
            ['Feel Pack 1.6 CVT', []], ['Feel Pack 1.6 AT (L23)', []],
            ['Feel Pack 1.6 AT', ['motor' => '2.0']],
            ['Feel Pack 1.6 AT', ['potencia' => 163, 'potencia_unidad' => 'CV']],
            ['Feel Pack 1.6 AT', ['transmision' => 'manual']],
            ['Feel Pack 1.6 AT', ['marca' => 'Other']],
            ['Feel Pack 1.6 AT', ['modelo' => 'Other']],
            ['', []],
        ] as [$label, $facts]) {
            $this->assertNull($this->score($label, [$reference], $facts)['retention_score'], $label);
        }
        $this->assertNull($this->score($reference, [$reference], ['motor' => '2.0'])['score']);
        $this->assertNull($this->score('Feel Pack 1.6 AT', ['1.6 Feel Pack (115cv)'])['score']);
        $this->assertNull($this->score('Base', ['Base L20'])['score']);
    }

    public function test_ambiguity_abstains_and_exact_trim_beats_typo_candidates(): void
    {
        $this->assertSame(70.0, $this->score('BÁSE---', ['Base'])['score']);
        $feel = '1.6 Feel Pack AT (115cv) (L18)';
        $fell = '1.6 Fell Pack AT (115cv) (L18)';
        $this->assertNull($this->score('Fill Pack 1.6 AT', [$feel, $fell])['score']);
        $this->assertNull($this->score('Feel Pack 1.6 AT', [$feel, $feel])['score']);
        $this->assertSame($feel, $this->score('Feel Pack 1.6 AT', [$feel, $fell])['comparison']['version_id']);
        $this->assertNull($this->score('Feel Pack 1.6 AT', [$feel, str_replace('L18', 'L20', $feel)])['score']);
    }

    public function test_model_year_disambiguates_without_stitching_generations(): void
    {
        $row = ['make' => 'Test', 'model' => 'Example', 'version' => 'XEI 1.8 CVT (140cv) (L18)',
            'version_id' => 'L18', 'currency' => 'ARS', 'values' => [2021 => 100]];
        $older = array_replace($row, ['version' => 'XEI 1.8 CVT (140cv) (L14)',
            'version_id' => 'L14', 'values' => [2018 => 80]]);
        $result = $this->score('XEi 1.8 CVT', [$row, $older]);
        $this->assertNull($result['score']);
        $this->assertSame('L18', $result['reference']['version_id']);
        $this->assertSame(60, $result['activity_score']);
        $this->assertNull($result['comparison']);
    }

    public function test_family_activity_does_not_require_a_price_reference_and_keeps_special_groups(): void
    {
        $this->assertSame(60, $this->score('Unknown', [])['activity_score']);
        $this->assertNull($this->score('Unknown', [])['score']);
        $this->assertNull($this->score('GTI', [])['activity_score']);
        $this->assertNull($this->score('Base', [], ['combustible' => 'diesel'])['activity_score']);
    }

    public function test_real_catalog_endpoint_pairs_preserve_currency_and_retention(): void
    {
        foreach ([
            ['Feel Pack 1.6 AT', '1.6 Feel Pack AT (115cv) (L18)', 2021, 23629300, 21975200, 'ARS'],
            ['Highline 1.6 AT', '1.6 Highline Tiptronic (110cv)', 2022, 27961800, 24154400, 'ARS'],
            ['Advance 1.6 AT', '1.6 Advance AT (107cv) 4Ptas.', 2018, 12180, 10400, 'USD'],
        ] as [$label, $reference, $year, $price, $older, $currency]) {
            $row = ['make' => 'Test', 'model' => 'Example', 'version' => $reference,
                'version_id' => $reference, 'currency' => $currency, 'values' => [$year => $price, $year - 3 => $older]];
            $result = $this->score($label, [$row], ['anio' => $year]);
            $this->assertEqualsWithDelta($older / $price * 100, $result['retention_score'], 0.000001);
            $this->assertSame($currency, $result['comparison']['currency']);
        }
    }
}
