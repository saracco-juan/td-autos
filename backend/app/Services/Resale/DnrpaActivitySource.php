<?php

namespace App\Services\Resale;

use DateTimeImmutable;
use Illuminate\Support\Facades\Http;
use RuntimeException;
use Throwable;
use ZipArchive;

/** Background acquisition only; no persistence, raw-row extraction or recommendation I/O. */
final class DnrpaActivitySource
{
    private const DATASET = 'f6932e82-a039-4462-968d-7dcda77d1a3e';

    private const API = 'https://datos.jus.gob.ar/api/3/action/package_show?id=transferencias-de-autos';

    public function fetch(array $catalog, DateTimeImmutable $asOf, ?string $knownMonth = null): ?array
    {
        if (! class_exists(ZipArchive::class)) {
            throw new RuntimeException('DNRPA acquisition requires the PHP ZIP extension.');
        }
        $metadata = $this->download(self::API, 2 * 1024 * 1024);
        try {
            $data = json_decode(stream_get_contents($metadata), true);
        } finally {
            fclose($metadata);
        }
        if (($data['success'] ?? null) !== true || ($data['result']['id'] ?? null) !== self::DATASET
            || ! is_array($data['result']['resources'] ?? null)) {
            throw new RuntimeException('Invalid DNRPA metadata.');
        }
        $calculator = new DnrpaActivityCalculator;
        $latest = null;
        $years = [];
        foreach ($data['result']['resources'] as $resource) {
            if (! preg_match('/^DNRPA\. Transferencias de autos - (\d{4}|\d{6})$/D', $resource['name'] ?? '', $match)) {
                continue;
            }
            $period = $match[1];
            $format = strlen($period) === 4 ? 'zip' : 'csv';
            $url = $resource['url'] ?? '';
            $pattern = '~^https://datos\.jus\.gob\.ar/dataset/'.self::DATASET.'/resource/[a-f0-9-]{36}/download/dnrpa-transferencias-autos-'.$period.'\.'.$format.'$~D';
            if (strtolower($resource['format'] ?? '') !== $format || ! preg_match($pattern, $url)) {
                throw new RuntimeException('Untrusted DNRPA resource.');
            }
            if ($format === 'zip') {
                if (isset($years[$period])) {
                    throw new RuntimeException('Duplicate DNRPA annual resource.');
                }
                $years[$period] = $url;
            } else {
                $month = substr($period, 0, 4).'-'.substr($period, 4);
                if ($calculator->monthsEndingAt($month, $asOf) !== null && ($latest === null || $month > $latest)) {
                    $latest = $month;
                }
            }
        }
        $months = $latest === null ? null : $calculator->monthsEndingAt($latest, $asOf);
        if ($months === null) {
            throw new RuntimeException('No closed DNRPA month available.');
        }
        if ($knownMonth !== null && $latest < $knownMonth) {
            throw new RuntimeException('DNRPA source month moved backwards.');
        }
        if ($latest === $knownMonth) {
            return null;
        }
        $snapshots = $archives = [];
        foreach (array_unique(array_map(fn ($month) => substr($month, 0, 4), $months)) as $year) {
            if (! isset($years[$year])) {
                throw new RuntimeException('Missing DNRPA annual archive.');
            }
            $sink = $this->download($years[$year], 80 * 1024 * 1024);
            $zip = new ZipArchive;
            $opened = false;
            try {
                $path = stream_get_meta_data($sink)['uri'];
                $opened = $zip->open($path, ZipArchive::RDONLY | ZipArchive::CHECKCONS) === true;
                if (! $opened || $zip->numFiles > 24) {
                    throw new RuntimeException('Invalid DNRPA archive.');
                }
                $archives[$year] = ['url' => $years[$year], 'sha256' => hash_file('sha256', $path)];
                foreach ($months as $month) {
                    if (str_starts_with($month, $year.'-')) {
                        $snapshots[] = $this->readMonth($zip, $month, $catalog);
                    }
                }
            } finally {
                if ($opened) {
                    $zip->close();
                }
                fclose($sink);
            }
        }
        $activity = $calculator->calculate($snapshots, $asOf);
        if ($activity === null) {
            throw new RuntimeException('Incomplete DNRPA acquisition.');
        }

        return ['activity' => $activity, 'snapshots' => $snapshots, 'archives' => $archives, 'source_url' => self::API];
    }

    private function readMonth(ZipArchive $zip, string $month, array $catalog): array
    {
        $name = 'dnrpa-transferencias-autos-'.str_replace('-', '', $month).'.csv';
        $indices = [];
        for ($i = 0; $i < $zip->numFiles; $i++) {
            if ($zip->getNameIndex($i) === $name) {
                $indices[] = $i;
            }
        }
        if (count($indices) !== 1 || ($stat = $zip->statIndex($indices[0])) === false
            || $stat['size'] <= 0 || $stat['size'] > 64 * 1024 * 1024) {
            throw new RuntimeException('Missing, duplicate or oversized DNRPA month.');
        }
        // Verify the full payload before parsing; never write an uncompressed CSV to disk.
        $stream = $zip->getStreamIndex($indices[0]);
        if ($stream === false) {
            throw new RuntimeException('Unreadable DNRPA month.');
        }
        try {
            $crc = hash_init('crc32b');
            $bytes = hash_update_stream($crc, $stream, $stat['size'] + 1);
            if ($bytes !== $stat['size'] || hash_final($crc) !== sprintf('%08x', $stat['crc'])) {
                throw new RuntimeException('Corrupt DNRPA month.');
            }
        } finally {
            fclose($stream);
        }
        $stream = $zip->getStreamIndex($indices[0]);
        try {
            return (new DnrpaActivityReader)->read($stream, $month, $catalog);
        } finally {
            if (is_resource($stream)) {
                fclose($stream);
            }
        }
    }

    private function download(string $url, int $limit): mixed
    {
        $sink = tmpfile();
        if ($sink === false) {
            throw new RuntimeException('DNRPA temporary download unavailable.');
        }
        try {
            $options = ['verify' => true, 'decode_content' => false,
                'progress' => function ($total, $downloaded) use ($limit): void {
                    if (max($total, $downloaded) > $limit) {
                        throw new RuntimeException('DNRPA download exceeds the size limit.');
                    }
                }];
            if (PHP_OS_FAMILY === 'Windows' && defined('CURLSSLOPT_NATIVE_CA')) {
                $options['curl'][CURLOPT_SSL_OPTIONS] = CURLSSLOPT_NATIVE_CA;
            }
            $response = Http::connectTimeout(20)->timeout(90)->withoutRedirecting()
                ->sink($sink)->withOptions($options)->get($url);
            if ($response->status() !== 200 || fstat($sink)['size'] > $limit) {
                throw new RuntimeException('DNRPA download rejected.');
            }
            rewind($sink);

            return $sink;
        } catch (Throwable $error) {
            fclose($sink);
            throw $error;
        }
    }
}
