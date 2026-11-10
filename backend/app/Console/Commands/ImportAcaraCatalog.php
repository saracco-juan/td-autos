<?php

namespace App\Console\Commands;

use App\Services\Catalog\FixedAcaraCatalog;
use App\Services\Resale\AcaraPriceReader;
use Illuminate\Console\Command;
use RuntimeException;
use Throwable;

final class ImportAcaraCatalog extends Command
{
    protected $signature = 'catalog:import-acara {path : Local ACARA PDF file (maximum 25 MiB)}';

    protected $description = 'Load the fixed ACARA catalog once; never download or replace existing data';

    public function handle(FixedAcaraCatalog $catalog, AcaraPriceReader $reader): int
    {
        try {
            $path = realpath($this->argument('path'));
            if ($path === false || ! is_file($path) || ! is_readable($path) || filesize($path) > 25 * 1024 * 1024) {
                throw new RuntimeException('Provide a readable local ACARA PDF no larger than 25 MiB.');
            }
            $bytes = file_get_contents($path, false, null, 0, 25 * 1024 * 1024 + 1);
            if ($bytes === false) {
                throw new RuntimeException('The local ACARA PDF could not be read.');
            }
            $snapshot = $reader->read($bytes);
            if ($snapshot['source_date'] > now()->toDateString()) {
                throw new RuntimeException('The ACARA source date cannot be in the future.');
            }
            $created = $catalog->import($snapshot);
            $this->info($created ? 'ACARA catalog imported ('.count($snapshot['rows']).' rows).' : 'ACARA catalog already loaded; no changes.');

            return self::SUCCESS;
        } catch (Throwable $error) {
            report($error);
            $this->error('ACARA catalog import failed: '.$error->getMessage());

            return self::FAILURE;
        }
    }
}
