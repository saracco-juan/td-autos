<?php

namespace Tests\Unit\Services\Resale;

use App\Models\Vehiculo;
use App\Services\Resale\ResaleScorer;
use PHPUnit\Framework\TestCase;

class GroupedRetentionTest extends TestCase
{
    private function row(string $version, array $values = [2025 => 100, 2023 => 81]): array
    {
        return ['make' => 'Example', 'model' => 'Hatch', 'version' => $version,
            'version_id' => $version, 'currency' => 'ARS', 'values' => $values];
    }

    private function score(string $label, array $rows, array $facts = []): array
    {
        $body = $facts['_body'] ?? null;
        unset($facts['_body']);
        $car = new Vehiculo(array_replace(['marca' => 'Example', 'modelo' => 'Hatch', 'anio' => 2025,
            'version' => $label, 'motor' => '1.2', 'transmision' => 'manual', 'potencia' => 75,
            'potencia_unidad' => 'CV', 'combustible' => 'nafta'], $facts));
        $car->id = 1;
        if ($body !== null) {
            $car->setRelation('tipoCarroceria', (object) ['nombre' => $body]);
        }

        return (new ResaleScorer)->scores([$car], ['snapshot' => ['snapshot_id' => 'acara:1', 'rows' => $rows],
            'stale' => false], ['snapshot' => ['activity' => ['models' => [['make' => 'example',
                'model' => 'hatch', 'special' => [], 'score' => 60]]]], 'stale' => false])[1];
    }

    public function test_catalog_slash_names_are_alternatives_not_required_words(): void
    {
        $row = $this->row('3Ptas. 1.2 Expression / Pack / Authentique (75cv)');
        foreach (['Expression', 'Pack', 'Authentique'] as $alias) {
            $this->assertEqualsWithDelta(72.9, $this->score("3Ptas. 1.2 $alias", [$row])['retention_score'], 1e-9);
        }
    }

    public function test_close_price_versions_use_separate_curves_and_an_explicit_range(): void
    {
        $rows = [$this->row('1.2 Core MT (75cv)'), $this->row('1.2 Core Plus MT (75cv)', [2025 => 104, 2023 => 85])];
        $result = $this->score('1.2 MT', $rows);
        $this->assertNotNull($result['score']);
        $this->assertSame(2, $result['estimate']['reference_count']);
        $this->assertCount(2, $result['estimate']['curves']);
        $this->assertLessThan($result['estimate']['retention_range'][1], $result['estimate']['retention_range'][0]);
        $this->assertNull($result['comparison']);
        $this->assertEqualsWithDelta(72.9, $result['estimate']['curves'][0]['retained_percent'], 1e-9);
    }

    public function test_groups_reject_price_chains_disjoint_years_and_duplicate_identities(): void
    {
        $base = $this->row('1.2 Core MT (75cv)');
        foreach ([[$base, $base], [$base, $this->row('1.2 Plus MT (75cv)', [2025 => 110, 2023 => 89.1])],
            [$base, $this->row('1.2 Plus MT (75cv)', [2024 => 100, 2022 => 81])],
            [$base, $this->row('1.2 Plus MT (75cv)', [2025 => 104, 2023 => 84.24]),
                $this->row('1.2 Extra MT (75cv)', [2025 => 108, 2023 => 87.48])]] as $rows) {
            $this->assertNull($this->score('1.2 MT', $rows)['estimate']);
        }
        foreach (['1.6 MT', '1.2 AT', '1.2 MT (L23)', '5Ptas. 1.2 MT'] as $label) {
            $this->assertNull($this->score($label, [$this->row('3Ptas. 1.2 Core MT (75cv) (L15)'),
                $this->row('3Ptas. 1.2 Plus MT (75cv) (L15)')])['estimate']);
        }
    }

    public function test_year_evidence_beats_old_exact_label_and_missing_current_year_is_not_a_gate(): void
    {
        $old = $this->row('350 F-Sport', [2022 => 100, 2021 => 90]);
        $new = $this->row('350 F-Sport (L23)', [2025 => 120, 2024 => 108]);
        $result = $this->score('350 F-Sport', [$old, $new], ['motor' => null, 'potencia' => null]);
        $this->assertSame($new['version_id'], $result['reference']['version_id']);
        $result = $this->score('Base', [$this->row('Base', [2024 => 100, 2023 => 90])]);
        $this->assertNotNull($result['estimate']);
    }

    public function test_attached_engine_and_numbered_gearbox_labels_use_general_technical_rules(): void
    {
        $result = $this->score('Core 1.2 TSI 6MT', [$this->row('1.2TSI Core MT6 (75cv)')]);
        $this->assertNotNull($result['estimate']);
    }

    public function test_related_model_inference_is_general_explicit_and_secondary_to_exact_evidence(): void
    {
        $row = array_replace($this->row('1.2 Core MT (75cv) 5Ptas.'), ['model' => 'Hatch MK']);
        $result = $this->score('Core 1.2 MT', [$row], ['_body' => 'Hatchback']);
        $this->assertNotNull($result['score']);
        $this->assertSame(60, $result['activity_score']);
        $this->assertSame(['approximate' => true, 'listing_model' => 'Hatch', 'reference_model' => 'Hatch MK'], $result['model_match']);
        $this->assertNull($result['comparison']);
        $exact = $this->row('1.2 Core MT (75cv) 5Ptas.');
        $this->assertNull($this->score('Core 1.2 MT', [$row, $exact], ['_body' => 'Hatchback'])['model_match']);
    }

    public function test_related_models_abstain_on_ambiguity_or_insufficient_technical_evidence(): void
    {
        $row = array_replace($this->row('1.2 Core MT (75cv) 5Ptas.'), ['model' => 'Hatch MK']);
        foreach ([[$row, array_replace($row, ['model' => 'Hatch Other', 'version_id' => 'other'])],
            [array_replace($row, ['make' => 'Another'])], [array_replace($row, ['model' => 'Hatchback'])],
            [array_replace($row, ['model' => 'Hatch GTI'])], [array_replace($row, ['model' => 'Hatch Diesel'])],
            [array_replace($row, ['version' => '1.6 Core MT (75cv) 5Ptas.'])],
            [array_replace($row, ['version' => '1.2 Core AT (75cv) 5Ptas.'])],
            [array_replace($row, ['version' => '1.2 Core MT (75cv) 4Ptas.'])],
            [array_replace($row, ['values' => [2024 => 100, 2023 => 90]])]] as $rows) {
            $this->assertNull($this->score('Core 1.2 MT', $rows, ['_body' => 'Hatchback'])['estimate']);
        }
        $this->assertNull($this->score('Core 1.2 MT', [$row])['estimate']);
        $this->assertNull($this->score('Core 1.2 MT', [$row], ['_body' => 'Hatchback', 'potencia' => null])['estimate']);
    }
}
