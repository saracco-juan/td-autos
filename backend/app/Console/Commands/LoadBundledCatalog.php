<?php

namespace App\Console\Commands;

use App\Services\Catalog\FixedAcaraCatalog;
use Database\Seeders\Support\LocalAcaraCatalogData;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Throwable;

/**
 * Loads the bundled fixed ACARA catalog (the same data `db:local` uses) when the database has none, so a deployed
 * environment has a catalog without a shell or the ACARA PDF. It runs on every container start: a database that
 * already holds a catalog (this one or another imported from a PDF) is never touched.
 */
final class LoadBundledCatalog extends Command
{
    protected $signature = 'catalog:load-bundled {--path= : Bundled catalog file (default: the repository asset)}';

    protected $description = 'Load the bundled fixed ACARA catalog once when the database has none';

    public function handle(FixedAcaraCatalog $catalog): int
    {
        try {
            if (DB::table('catalog_import')->exists()) {
                $this->info($this->sameAsBundle() ? 'Bundled ACARA catalog already loaded; no changes.'
                    : 'Bundled ACARA catalog skipped: another catalog is already loaded.');

                return self::SUCCESS;
            }
            $snapshot = (new LocalAcaraCatalogData)->load($this->option('path') ?: null);
            $catalog->import($snapshot);
            $this->info('Bundled ACARA catalog loaded ('.count($snapshot['rows']).' rows).');

            return self::SUCCESS;
        } catch (Throwable $error) {
            report($error);
            $this->error('Bundled ACARA catalog not loaded: '.$error->getMessage());

            return self::FAILURE;
        }
    }

    private function sameAsBundle(): bool
    {
        try {
            $bundled = (new LocalAcaraCatalogData)->load($this->option('path') ?: null);
        } catch (Throwable) {
            return false;
        }

        return DB::table('catalog_import')->value('sha256') === $bundled['sha256'];
    }
}
