<?php

namespace App\Support;

use App\Models\Vehiculo;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Where and how vehicle photos are stored. The disk comes from configuration:
 * local in development and tests, object storage in production.
 */
final class VehiculoFotos
{
    public static function disk(): Filesystem
    {
        return Storage::disk(config('filesystems.vehicle_photos_disk'));
    }

    public static function url(string $path): string
    {
        return self::disk()->url($path);
    }

    /**
     * Store the files under the vehicle's folder with generated names and create one row per file,
     * numbered from $firstOrder in the given order. Returns the stored paths so the caller can
     * delete them if the surrounding work fails later.
     *
     * @param  list<UploadedFile>  $files
     * @return list<string>
     */
    public static function store(Vehiculo $vehiculo, array $files, int $firstOrder = 1): array
    {
        $stored = [];

        try {
            foreach (array_values($files) as $index => $file) {
                $name = Str::uuid().'.'.($file->guessExtension() ?? $file->extension());
                $path = self::disk()->putFileAs("vehiculos/{$vehiculo->id}", $file, $name, 'public');

                if ($path === false) {
                    throw new \RuntimeException('The photo could not be stored.');
                }

                $stored[] = $path;
                $vehiculo->fotos()->create(['ubicacion_archivo' => $path, 'orden' => $firstOrder + $index]);
            }
        } catch (\Throwable $e) {
            self::forget($stored);

            throw $e;
        }

        return $stored;
    }

    /**
     * Delete stored files; used to leave no orphans when a write fails after storing them.
     *
     * @param  list<string>  $paths
     */
    public static function forget(array $paths): void
    {
        if ($paths !== []) {
            self::disk()->delete($paths);
        }
    }
}
