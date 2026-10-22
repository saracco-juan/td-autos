<?php

namespace Tests\Feature\Resale;

use App\Services\Resale\DnrpaActivitySource;
use DateTimeImmutable;
use Illuminate\Support\Facades\Http;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;
use ZipArchive;

class DnrpaActivitySourceTest extends TestCase
{
    private const API = 'https://datos.jus.gob.ar/api/3/action/package_show?id=transferencias-de-autos';

    private const ROOT = 'https://datos.jus.gob.ar/dataset/f6932e82-a039-4462-968d-7dcda77d1a3e/resource/1bde10bd-0067-4f1d-8e8e-e73ca2dec57f/download/';

    private array $options = [];

    public function test_hu05_acquires_six_months_once_per_year_with_only_aggregate_provenance(): void
    {
        $zip = $this->archive();
        $this->fake($this->metadata(), $zip);
        $source = new DnrpaActivitySource;
        Http::assertNothingSent();
        $result = $source->fetch($this->catalog(), new DateTimeImmutable('2026-10-21'));
        $this->assertSame(['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09'], $result['activity']['months']);
        $this->assertSame(6, $result['activity']['transfers']);
        $this->assertSame(6, $result['activity']['identified']);
        $this->assertSame(0, $result['activity']['unmatched']);
        $this->assertSame(100, $result['activity']['models'][0]['score']);
        $this->assertCount(6, $result['snapshots']);
        $this->assertSame(['catalog-1'], array_values(array_unique(array_column($result['snapshots'], 'catalog_snapshot_id'))));
        $this->assertSame(hash('sha256', $zip), $result['archives'][2026]['sha256']);
        $this->assertSame(self::ROOT.'dnrpa-transferencias-autos-2026.zip', $result['archives'][2026]['url']);
        $this->assertSame(self::API, $result['source_url']);
        $this->assertStringNotContainsString('PRIVATE_HOLDER', json_encode($result));
        Http::assertSentCount(2);
        foreach ($this->options as $options) {
            $this->assertTrue($options['verify']);
            $this->assertFalse($options['allow_redirects']);
            $this->assertFalse($options['decode_content']);
            $this->assertSame(20, $options['connect_timeout']);
            $this->assertSame(90, $options['timeout']);
            $this->assertFalse(is_resource($options['sink']), 'Temporary download must be closed.');
        }
    }

    public function test_year_boundary_uses_two_archives_and_ignores_future_resources(): void
    {
        $meta = $this->metadata('202602');
        $meta['result']['resources'][] = $this->resource('2025');
        $meta['result']['resources'][] = $this->resource('202603');
        $this->fake($meta, $this->archive(['202601', '202602']), $this->archive(['202509', '202510', '202511', '202512']));
        $result = (new DnrpaActivitySource)->fetch($this->catalog(), new DateTimeImmutable('2026-03-21'));
        $this->assertSame(['2025-09', '2026-02', 6], [$result['activity']['window_start'], $result['activity']['window_end'], $result['activity']['transfers']]);
        Http::assertSentCount(3);
    }

    #[DataProvider('failures')]
    public function test_rejects_invalid_evidence_without_partial_results(string $case): void
    {
        $meta = $this->metadata();
        $zip = $this->archive();
        if ($case === 'envelope') {
            $meta['success'] = false;
        } elseif ($case === 'no-month') {
            array_shift($meta['result']['resources']);
        } elseif ($case === 'missing-year') {
            array_pop($meta['result']['resources']);
        } elseif ($case === 'duplicate-year') {
            $meta['result']['resources'][] = $this->resource('2026');
        } elseif (in_array($case, ['http', 'foreign-host', 'path'], true)) {
            $meta['result']['resources'][1]['url'] = match ($case) {
                'http' => str_replace('https:', 'http:', $meta['result']['resources'][1]['url']),
                'foreign-host' => 'https://example.com/file.zip',
                default => self::ROOT.'../file.zip',
            };
        } elseif ($case === 'missing-month') {
            $zip = $this->archive(['202604', '202605', '202606', '202607', '202608']);
        } elseif ($case === 'duplicate-member') {
            $zip = str_replace('autos-202608.csv', 'autos-202609.csv', $zip);
        } elseif ($case === 'too-many-members') {
            $zip = $this->archive(array_merge(['202604', '202605', '202606', '202607', '202608', '202609'], range(202701, 202720)));
        } elseif ($case === 'corrupt-crc') {
            $zip = str_replace('2026-09-01', '2026-09-02', $zip);
        } elseif ($case === 'invalid-csv') {
            $zip = $this->archive(['202604', '202605', '202606', '202607', '202608', '202609'], 'wrong header');
        } elseif ($case === 'oversized-member') {
            $zip = $this->archive(['202609'], str_repeat('x', 64 * 1024 * 1024 + 1));
        } elseif ($case === 'bad-zip') {
            $zip = 'not a ZIP';
        }
        $this->fake($meta, $zip, null, $case);
        $this->expectException(\Exception::class);
        try {
            (new DnrpaActivitySource)->fetch($this->catalog(), new DateTimeImmutable('2026-10-21'));
        } finally {
            foreach ($this->options as $options) {
                $this->assertFalse(is_resource($options['sink']), 'Failed acquisitions must close temporary downloads.');
            }
        }
    }

    public static function failures(): array
    {
        return array_map(fn ($case) => [$case], ['envelope', 'no-month', 'missing-year', 'duplicate-year', 'http', 'foreign-host', 'path', 'missing-month', 'duplicate-member', 'too-many-members', 'corrupt-crc', 'invalid-csv', 'oversized-member', 'bad-zip', '503', 'redirect', 'connection', 'oversized-metadata', 'progress', 'archive-progress', 'oversized-archive']);
    }

    public function test_known_month_checks_only_metadata_and_rejects_a_backwards_month(): void
    {
        $this->fake($this->metadata(), $this->archive());
        $source = new DnrpaActivitySource;
        $this->assertNull($source->fetch($this->catalog(), new DateTimeImmutable('2026-10-21'), '2026-09'));
        Http::assertSentCount(1);
        $this->expectException(\RuntimeException::class);
        $source->fetch($this->catalog(), new DateTimeImmutable('2026-10-21'), '2026-10');
    }

    private function catalog(): array
    {
        return ['snapshot_id' => 'catalog-1', 'rows' => [['make' => 'Toyota', 'model' => 'Corolla', 'version' => 'XLI']]];
    }

    private function resource(string $period): array
    {
        $format = strlen($period) === 4 ? 'ZIP' : 'CSV';

        return ['name' => 'DNRPA. Transferencias de autos - '.$period, 'format' => $format,
            'url' => self::ROOT.'dnrpa-transferencias-autos-'.$period.'.'.strtolower($format)];
    }

    private function metadata(string $latest = '202609'): array
    {
        return ['success' => true, 'result' => ['id' => 'f6932e82-a039-4462-968d-7dcda77d1a3e', 'resources' => [$this->resource($latest), $this->resource('2026')]]];
    }

    private function fake(array $meta, string $zip, ?string $previous = null, string $case = ''): void
    {
        Http::preventStrayRequests();
        Http::fake(function ($request, $options) use ($meta, $zip, $previous, $case) {
            $this->options[] = $options;
            if ($case === 'progress' || ($case === 'archive-progress' && $request->url() !== self::API)) {
                ($options['progress'])(0, 81 * 1024 * 1024, 0, 0);
            }
            if ($case === 'oversized-archive' && $request->url() !== self::API) {
                ftruncate($options['sink'], 80 * 1024 * 1024 + 1);
            }
            if ($case === 'connection') {
                return Http::failedConnection();
            }
            $body = $request->url() === self::API ? ($case === 'oversized-metadata' ? str_repeat('x', 2 * 1024 * 1024 + 1) : json_encode($meta)) : (str_contains($request->url(), '2025.zip') ? $previous : $zip);

            return Http::response($body, $case === '503' ? 503 : ($case === 'redirect' ? 302 : 200));
        });
    }

    private function archive(array $months = ['202604', '202605', '202606', '202607', '202608', '202609'], ?string $csv = null): string
    {
        $path = tempnam(sys_get_temp_dir(), 'dnrpa-test-');
        $zip = new ZipArchive;
        $zip->open($path, ZipArchive::CREATE | ZipArchive::OVERWRITE);
        foreach ($months as $month) {
            $name = 'dnrpa-transferencias-autos-'.$month.'.csv';
            $zip->addFromString($name, $csv ?? "tramite_fecha,automotor_marca_descripcion,automotor_modelo_descripcion,titular_nombre\n".substr($month, 0, 4).'-'.substr($month, 4)."-01,Toyota,Corolla XLI,PRIVATE_HOLDER\n");
            if ($csv === null) {
                $zip->setCompressionName($name, ZipArchive::CM_STORE);
            }
        }
        $zip->close();
        $bytes = file_get_contents($path);
        unlink($path);

        return $bytes;
    }
}
