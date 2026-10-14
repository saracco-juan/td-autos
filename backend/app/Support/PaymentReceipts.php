<?php

namespace App\Support;

use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Where and how payment receipt files are stored: a private disk from configuration,
 * under comprobantes/{dealer id}/{uuid}/{readable name}.
 */
final class PaymentReceipts
{
    public const EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png'];

    public const MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

    public const MAX_KB = 5120;

    public static function disk(): Filesystem
    {
        return Storage::disk(config('filesystems.receipts_disk'));
    }

    /**
     * Store the file privately and return its path.
     */
    public static function store(int $dealerId, UploadedFile $file): string
    {
        $base = Str::slug(pathinfo($file->getClientOriginalName(), PATHINFO_FILENAME)) ?: 'comprobante';
        $extension = $file->guessExtension() ?? strtolower($file->getClientOriginalExtension());
        $path = self::disk()->putFileAs("comprobantes/{$dealerId}/".Str::uuid(), $file, "{$base}.{$extension}");

        if ($path === false) {
            throw new \RuntimeException('The payment receipt could not be stored.');
        }

        return $path;
    }

    public static function forget(string $path): void
    {
        self::disk()->delete($path);
    }

    /**
     * The name shown to people for a stored path.
     */
    public static function fileName(string $path): string
    {
        return basename($path);
    }
}
