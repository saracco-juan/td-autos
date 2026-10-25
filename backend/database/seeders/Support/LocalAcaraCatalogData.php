<?php

namespace Database\Seeders\Support;

use RuntimeException;

/** Fixed public catalog facts, exported without inventory or developer configuration. */
final class LocalAcaraCatalogData
{
    public const ASSET = 'seeders/assets/acara-2026-10-19.json.gz';

    private const SHA256 = 'e539beb9174b8dd482af077e839fb0e5d00f9dd720eacafdcb332a1f8a9bfbfe';

    public function load(?string $path = null): array
    {
        $path ??= database_path(self::ASSET);
        if (! is_file($path) || ! is_readable($path)) {
            throw new RuntimeException('The bundled ACARA catalog is missing or unreadable.');
        }
        $bytes = file_get_contents($path, false, null, 0, 2 * 1024 * 1024 + 1);
        if ($bytes === false || ! hash_equals(self::SHA256, hash('sha256', $bytes))) {
            throw new RuntimeException('The bundled ACARA catalog failed its integrity check.');
        }
        $json = gzdecode($bytes, 8 * 1024 * 1024);
        if ($json === false) {
            throw new RuntimeException('The bundled ACARA catalog cannot be decompressed.');
        }
        $snapshot = json_decode($json, true, 512, JSON_THROW_ON_ERROR);
        if (! is_array($snapshot) || ($snapshot['source_date'] ?? null) !== '2026-10-19'
            || ($snapshot['sha256'] ?? null) !== '6cf7e22ccf5813fb150b7998806139ba5ced50a2d2a8eceb61862f8eb9ca8b04'
            || count($snapshot['rows'] ?? []) !== 7390) {
            throw new RuntimeException('The bundled ACARA catalog has unexpected provenance or rows.');
        }

        return $snapshot;
    }
}
