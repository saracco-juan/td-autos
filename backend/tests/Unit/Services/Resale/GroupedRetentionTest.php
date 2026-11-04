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
        $car = new Vehiculo(array_replace(['marca' => 'Example', 'modelo' => 'Hatch', 'anio' => 2025,
            'version' => $label, 'motor' => '1.2', 'transmision' => 'manual', 'potencia' => 75,
            'potencia_unidad' => 'CV', 'combustible' => 'nafta'], $facts));
        $car->id = 1;

        return (new ResaleScorer)->scores([$car], ['snapshot' => ['snapshot_id' => 'acara:1', 'rows' => $rows],
            'stale' => false], ['snapshot' => ['activity' => ['models' => [['make' => 'example',
                'model' => 'hatch', 'special' => [], 'score' => 60]]]], 'stale' => false])[1];
    }

    public function test_exact_catalog_link_uses_its_year_evidence_without_label_matching(): void
    {
        $old = $this->row('350 F-Sport', [2022 => 100, 2021 => 90]);
        $new = $this->row('350 F-Sport (L23)', [2025 => 120, 2024 => 108]);
        $result = $this->score('Imported label', [$old, $new], ['acara_version_id' => $new['version_id'],
            'motor' => null, 'potencia' => null]);
        $this->assertSame($new['version_id'], $result['reference']['version_id']);
        $base = $this->row('Base', [2024 => 100, 2023 => 90]);
        $result = $this->score('Base', [$base], ['acara_version_id' => $base['version_id']]);
        $this->assertNotNull($result['estimate']);
    }

    public function test_exact_link_resolves_catalog_labels_without_parsing_listing_facts(): void
    {
        $row = $this->row('1.2TSI Core MT6 (75cv)');
        $result = $this->score('Imported label', [$row], ['acara_version_id' => $row['version_id']]);
        $this->assertNotNull($result['estimate']);
    }
}
