<?php

namespace Tests\Unit\Services\Resale;

use App\Services\Resale\DnrpaActivityReader;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use UnexpectedValueException;

class DnrpaActivityReaderTest extends TestCase
{
    private function catalog(): array
    {
        $rows = [];
        foreach ([['Volkswagen', 'Gol', '1.6'], ['Volkswagen', 'Gol Trend', '1.6'],
            ['Toyota', 'Corolla', 'XEI'], ['Toyota', 'Corolla Cross', 'SEG'],
            ['Volkswagen', 'Vento', '2.5'], ['Volkswagen', 'Golf', 'Comfortline'],
            ['Volkswagen', 'Golf', 'GTI'], ['Volkswagen', 'Golf', 'Diesel'],
            ['Peugeot', '408', 'Allure']] as [$make, $model, $version]) {
            $rows[] = compact('make', 'model', 'version');
        }

        return ['snapshot_id' => 'acara:test', 'rows' => $rows];
    }

    private function stream(array $rows)
    {
        $stream = fopen('php://memory', 'w+');
        fputcsv($stream, ['tramite_fecha', 'automotor_marca_descripcion', 'automotor_modelo_descripcion', 'titular_genero'], ',', '"', '');
        foreach ($rows as $row) {
            fputcsv($stream, ['2026-09-15', ...$row, 'PRIVATE_TEST_VALUE'], ',', '"', '');
        }
        rewind($stream);

        return $stream;
    }

    private function read(array $rows, ?array $catalog = null): array
    {
        $stream = $this->stream($rows);
        try {
            $result = (new DnrpaActivityReader)->read($stream, '2026-09', $catalog ?? $this->catalog());
            $this->assertIsResource($stream);

            return $result;
        } finally {
            fclose($stream);
        }
    }

    public function test_hu05_groups_ordinary_versions_and_uses_the_longest_complete_model(): void
    {
        $result = $this->read([
            [' VÓLKSWAGEN ', 'GOL TREND 1.6'], ['Volkswagen', 'Gol Trend, 1.6 Highline'],
            ['Toyota', 'COROLLA CROSS SEG 2.0 CVT'], ['Toyota', 'COROLLA XEI 1.8'],
            ['Volkswagen', 'VOLKSWAGEN VENTO 2.5'],
        ]);

        $this->assertSame(5, $result['transfers']);
        $this->assertSame(5, $result['identified']);
        $this->assertSame(0, $result['unmatched']);
        $this->assertSame('2026-09', $result['month']);
        $this->assertSame('acara:test', $result['catalog_snapshot_id']);
        $this->assertSame([
            ['make' => 'toyota', 'model' => 'corolla', 'special' => [], 'transfers' => 1],
            ['make' => 'toyota', 'model' => 'corolla cross', 'special' => [], 'transfers' => 1],
            ['make' => 'volkswagen', 'model' => 'gol trend', 'special' => [], 'transfers' => 2],
            ['make' => 'volkswagen', 'model' => 'vento', 'special' => [], 'transfers' => 1],
        ], $result['models']);
        $this->assertStringNotContainsString('PRIVATE_TEST_VALUE', json_encode($result));
        $this->assertStringNotContainsString('titular', json_encode($result));
    }

    public function test_special_markers_require_whole_tokens_and_catalog_corroboration(): void
    {
        $rows = [['Volkswagen', 'Golf GTI 2.0'], ['Volkswagen', 'Golf Diesel'],
            ['Volkswagen', 'Golf Comfortline'], ['Volkswagen', 'Golf TDI'],
            ['Volkswagen', 'Golf GTIline'], ['Toyota', 'Corolla GTI']];
        $models = $this->read($rows)['models'];
        $golf = array_values(array_filter($models, fn ($row) => $row['model'] === 'golf'));

        $this->assertSame([[], ['diesel'], ['gti']], array_column($golf, 'special'));
        $this->assertSame([3, 1, 1], array_column($golf, 'transfers'));
        $this->assertSame([], $models[0]['special']);
        $this->assertSame(1, $models[0]['transfers']);
    }

    public function test_unknown_brands_models_and_partial_numeric_names_do_not_invent_activity(): void
    {
        $result = $this->read([['Missing', 'Golf'], ['Toyota', 'Unknown'], ['Volkswagen', 'Golfish']]);

        $this->assertSame(3, $result['transfers']);
        $this->assertSame(3, $result['unmatched']);
        $this->assertSame(0, $result['identified']);
        $this->assertSame([], $result['models']);
    }

    public function test_numeric_model_names_match_exactly_or_at_a_complete_boundary(): void
    {
        $result = $this->read([['Peugeot', '408'], ['Peugeot', '408 Allure 2.0'], ['Peugeot', '4080']]);

        $this->assertSame(2, $result['identified']);
        $this->assertSame(1, $result['unmatched']);
        $this->assertSame('408', $result['models'][0]['model']);
    }

    public function test_missing_source_identity_is_unmatched_without_discarding_the_month(): void
    {
        $result = $this->read([['Volkswagen', ''], ['', 'Golf'], ['', ''], ['Volkswagen', 'Golf']]);

        $this->assertSame(4, $result['transfers']);
        $this->assertSame(1, $result['identified']);
        $this->assertSame(3, $result['unmatched']);
        $this->assertSame(1, $result['models'][0]['transfers']);
    }

    #[DataProvider('invalidCsv')]
    public function test_rejects_the_whole_invalid_month_without_leaking_row_values(string $csv, string $month): void
    {
        $stream = fopen('php://memory', 'w+');
        fwrite($stream, $csv);
        rewind($stream);
        try {
            (new DnrpaActivityReader)->read($stream, $month, $this->catalog());
            $this->fail('Expected invalid monthly input to be rejected.');
        } catch (UnexpectedValueException $error) {
            $this->assertStringNotContainsString('PRIVATE', $error->getMessage());
        } finally {
            fclose($stream);
        }
    }

    public static function invalidCsv(): array
    {
        $header = "tramite_fecha,automotor_marca_descripcion,automotor_modelo_descripcion\n";

        return [
            'missing header' => ["PRIVATE\n", '2026-09'],
            'wrong width' => [$header."2026-09-15,Volkswagen,Golf,PRIVATE\n", '2026-09'],
            'duplicate header' => ["tramite_fecha,tramite_fecha,automotor_modelo_descripcion\n", '2026-09'],
            'wrong month after valid row' => [$header."2026-09-15,Volkswagen,Golf\n2026-08-15,PRIVATE,Golf\n", '2026-09'],
            'impossible day' => [$header."2026-09-31,PRIVATE,Golf\n", '2026-09'],
            'invalid month' => [$header, '2026-13'],
            'empty month' => [$header, '2026-09'],
        ];
    }

    public function test_catalog_provenance_and_complete_identity_are_required(): void
    {
        $this->expectException(UnexpectedValueException::class);
        $this->read([['Toyota', 'Corolla']], ['snapshot_id' => 'acara:test', 'rows' => [['make' => 'Toyota']]]);
    }

    public function test_bom_and_reordered_columns_are_supported_without_returning_extra_fields(): void
    {
        $stream = fopen('php://memory', 'w+');
        fwrite($stream, "\xEF\xBB\xBFautomotor_modelo_descripcion,titular_genero,tramite_fecha,automotor_marca_descripcion\nGolf,PRIVATE,2026-09-01,Volkswagen\n");
        rewind($stream);
        try {
            $result = (new DnrpaActivityReader)->read($stream, '2026-09', $this->catalog());
            $this->assertSame(['source', 'month', 'catalog_snapshot_id', 'transfers', 'identified', 'unmatched', 'models'], array_keys($result));
            $this->assertSame([['make' => 'volkswagen', 'model' => 'golf', 'special' => [], 'transfers' => 1]], $result['models']);
        } finally {
            fclose($stream);
        }
    }
}
