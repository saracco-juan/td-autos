<?php

namespace App\Services\Resale;

use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use RuntimeException;
use Throwable;

/** Background acquisition only; recommendations consume current() without HTTP or parsing. */
final class AcaraPriceSource
{
    private const URL = 'https://api.acara.org.ar/api/v1/prices/download-vehicule-processed-pdf?file=acara_precios.pdf';

    private const SNAPSHOT_KEY = 'resale.acara.last-valid.v1';

    private const ATTEMPT_KEY = 'resale.acara.attempt.v1';

    private const MAX_BYTES = 25 * 1024 * 1024;

    public function current(): array
    {
        $snapshot = Cache::get(self::SNAPSHOT_KEY);
        $stale = $snapshot !== null && CarbonImmutable::parse($snapshot['fetched_at'])->addDays(14)->lessThanOrEqualTo(now());

        return ['snapshot' => $snapshot, 'stale' => $stale,
            'warning' => $snapshot === null ? 'acara_unavailable' : ($stale ? 'acara_stale' : null)];
    }

    public function refresh(): array
    {
        $now = now()->toImmutable();
        // Claim before I/O, including failed attempts; readers continue using the previous snapshot.
        if (Cache::add(self::ATTEMPT_KEY, true, $now->addDays(14))) {
            try {
                $snapshot = $this->fetch();
                $previous = Cache::get(self::SNAPSHOT_KEY);
                if ($snapshot['source_date'] > $now->toDateString()
                    || ($previous !== null && $snapshot['source_date'] < $previous['source_date'])) {
                    throw new RuntimeException('ACARA source date moved backwards or is in the future.');
                }
                // One atomic write preserves all source rows, including conflicting duplicate labels.
                $snapshot += ['source' => 'ACARA', 'source_url' => self::URL, 'fetched_at' => $now->toISOString()];
                if (! Cache::forever(self::SNAPSHOT_KEY, $snapshot)) {
                    throw new RuntimeException('ACARA snapshot could not be stored.');
                }
            } catch (Throwable $error) {
                Log::warning('ACARA refresh failed; previous snapshot retained.', ['exception' => $error::class]);
            }
        }

        return $this->current();
    }

    private function fetch(): array
    {
        $sink = tmpfile();
        if ($sink === false) {
            throw new RuntimeException('ACARA temporary download could not be opened.');
        }
        try {
            $options = ['verify' => true, 'decode_content' => false,
                'progress' => function ($total, $downloaded): void {
                    if (max($total, $downloaded) > self::MAX_BYTES) {
                        throw new RuntimeException('ACARA download exceeds the size limit.');
                    }
                },
            ];
            // Use existing Windows trust, never disable certificate or hostname verification.
            if (PHP_OS_FAMILY === 'Windows' && defined('CURLSSLOPT_NATIVE_CA')) {
                $options['curl'][CURLOPT_SSL_OPTIONS] = CURLSSLOPT_NATIVE_CA;
            }
            $response = Http::withHeaders(['Accept' => 'application/pdf, application/octet-stream'])
                ->connectTimeout(20)->timeout(60)->withoutRedirecting()->sink($sink)->withOptions($options)->get(self::URL);
            if ($response->status() !== 200 || fstat($sink)['size'] > self::MAX_BYTES) {
                throw new RuntimeException('ACARA download was rejected.');
            }
            rewind($sink);

            return (new AcaraPriceReader)->read(stream_get_contents($sink, self::MAX_BYTES + 1));
        } finally {
            if (is_resource($sink)) {
                fclose($sink);
            }
        }
    }
}
